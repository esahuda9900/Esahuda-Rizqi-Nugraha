# SDLG Warranty Claim Web App — Architecture Baseline

## High-level architecture

```text
Browser
  |
  | authenticated Supabase client
  v
Frontend (index.html shell + modules/*.js + runtime scripts)
  |
  +--> Supabase Auth
  |
  +--> public.claims
  |      |
  |      +--> RLS by application role / branch
  |
  +--> public.sdlg_warranty_resolve_claim(claim_id)
  |
  +--> public.claim_warranty_resolution_v
         |
         +--> canonical warranty resolver
```

## Frontend module map (Phase 1)

| Module | Responsibility |
|--------|----------------|
| `modules/sdlg-core.js` | **Single source of truth** for canonical model, model equivalence, serial/customer/dealer identity helpers, and claim currency rules |
| `modules/master-resolution-ux.js` | Diagnostic master-matching helpers only; must not overwrite `sdlg-core` globals |
| `modules/claim-parser-helpers.js` | Shared parser cell utilities |
| `modules/export-table-helper.js` | Excel table styling helper |
| `canonical-warranty-helper.js` | Canonical warranty badge / resolver UI bridge |
| `index.html` | App shell + remaining React/parser bundle (still large; further extraction planned) |

Load order for local modules must keep `sdlg-core.js` **first** so later scripts cannot silently redefine weaker alias maps.

## Canonical responsibilities

### Frontend
Responsible for presentation, user interaction, form validation, workflow display, filtering, and export formatting. It should not contain a second independent implementation of warranty policy.

### Supabase Auth / RLS
Responsible for authentication and database authorization. Frontend UI checks are convenience only; database policies remain authoritative.

### `claims`
Primary operational claim records. Access is controlled by authenticated roles and branch ownership where applicable.

### `sdlg_warranty_resolve_claim`
Canonical warranty decision engine. Any warranty eligibility result shown in the application should trace back to this resolver or a documented server-side composition around it.

### `claim_warranty_resolution_v`
Read/compatibility view exposing resolver fields alongside claim identity fields. It must remain compatible with the RLS/security model of the underlying claim data.

## Role model currently established

- `admin`: full administrative access, including archived claim visibility where policy permits.
- `warranty_admin`: operational claim read/write access.
- `viewer`: read-only active claim access.
- `branch_user`: limited to claims for the user's assigned branch.

## Build/deployment architecture

GitHub (`main`)
  -> Cloudflare Workers Builds
  -> `scripts/build-production.js`
  -> ordered `apply-*.js` transformations (including `apply-externalize-sdlg-core.js`)
  -> Cloudflare Workers static assets
  -> Supabase Auth / DB / RPC

The injector chain remains technical debt. Prefer direct edits to `modules/*.js` for new logic. Broad rewriting of the entire `index.html` monolith is high risk and out of scope for routine fixes.
See `INJECTOR_ROADMAP.md` for freeze rules and safe deprecation order.

## Security invariants

1. Never expose Supabase `service_role` credentials to the browser.
2. Never rely on client-side role checks as the only authorization boundary.
3. Keep RLS enabled on exposed operational tables.
4. Views used by authenticated clients must be deliberately granted and must preserve the intended RLS/security semantics.
5. Never bypass permissions by introducing a `SECURITY DEFINER` workaround just to silence a permission error.
6. See `SECURITY.md` for intentional SECURITY DEFINER RPCs and recent hardening notes.
7. See `FREE_TIER.md` / `PLUGINS.md` for free-tier monitoring checklist.

## Recent hardening (2026-09-16)

- Added explicit RLS policies on `legacy_archive.sdlg_osf_unit_imports` (previously RLS-enabled with zero policies).
- Archive index hygiene + restored FK covering indexes.
- Added partial index `idx_claims_active_status_branch` for active claim list / action-center style queries.
- Added `FREE_TIER.md`, `PLUGINS.md`, `INJECTOR_ROADMAP.md`.
- Hardened `verify-source-lock.js` (core contract, injector freeze, free-tier/security docs).
- Added `public.free_tier_db_health` view (`security_invoker`) for size/volume monitoring without changing claim write privileges.

## Change boundaries

A UI-only change must not alter warranty calculation.
A warranty-policy change must not alter unrelated UI rendering.
A database-permission change must not silently change business-rule outcomes.
An export change must not modify persisted claim data.

## Future target architecture

Phase 1 (done): externalize identity + currency core helpers.
Phase 2: extract SOURCE LOCK + parser blocks into dedicated modules.
Phase 3: extract React UI sections; shrink `index.html` toward a thin shell.
Do not rewrite the application wholesale unless a later measured migration plan justifies it.
