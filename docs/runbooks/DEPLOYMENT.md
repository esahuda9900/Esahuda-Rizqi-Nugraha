# SDLG Warranty Claim Web App — Deployment Discipline

Last updated: 2026-09-23 (expert pass — Vercel removed; Cloudflare sole production host)

## Current production (authoritative)

| Role | Platform | URL / identifier |
|------|----------|------------------|
| **Production frontend** | Cloudflare Workers (static assets) | `https://sdlg-warranty-backup.esahuda9900.workers.dev` |
| Data / Auth / RPC | Supabase | project `frqvelcreczmnofldrga` |
| Source of truth | GitHub `main` | `esahuda9900/sdlg-warranty-backup` |

- Git branch: `main`
- Cloudflare config: `wrangler.jsonc` (assets: `index.html`, `modules/**`, `styles/**`, SPA fallback)
- **Cloudflare is the only production surface.** Vercel has been fully retired (config deleted, secondary smoke removed).
- Production is considered verified only after a successful Cloudflare deployment **and** semantic production smoke checks pass against the Cloudflare URL.

## Release flow

```text
Change on main
  -> Review root cause
  -> Smallest isolated fix
  -> Build / syntax validation (`npm run build` / verify scripts)
  -> Regression checks (frontend-ci)
  -> Cloudflare auto-deploy (Workers assets)  [sole / blocking]
  -> Production smoke verification (Cloudflare)
  -> Record outcome
```

Distinguish carefully:
- GitHub commit exists
- Cloudflare production deployment succeeded (required)

Do not manually redeploy if the platform integration already picked up the commit successfully.

## Production is not the test environment
A successful build proves only that the static assets built. It does **not** prove database permissions, RLS behavior, business logic, exports, or authenticated browser flows. Those need explicit checks.

## Database changes
Database changes must be treated independently from frontend changes. When touching views, functions, RLS, grants, or tables:

1. Identify the intended role(s) and access boundary.
2. Verify the underlying business/security semantics.
3. Run a direct SQL test after the change.
4. Run the relevant application regression test.
5. Document the change/migration.

## Rollback discipline
Every production deployment must be traceable to a Git commit. When a regression appears, identify the last known-good deployment first instead of piling another patch on top of the broken release.

## Active build chain (source of truth: `scripts/build-production.js`)

Order is intentional. Do not reorder without regression validation.

1. `apply-ui-redesign.js`
2. `apply-responsive-ui.js`
3. `apply-parts-parser-fix.js`
4. `apply-safe-part-matching.js`
5. `apply-allow-zero-part-qty.js`
6. `apply-wo-save-fallback.js`
7. `apply-export-table-helper.js`
8. `apply-externalize-sdlg-core.js` — externalize AFTER remaining legacy inline patches so `modules/sdlg-core.js` becomes source of truth
9. `apply-master-resolution-ux.js`
10. `apply-master-model-source-lock.js`
11. `apply-warranty-helper-canonical.js`
12. `apply-feedback-person-from-claim.js`
13. `repair-feedback-person-render.js`
14. `apply-boss-analytics-dashboard.js`
15. `apply-modern-refresh.js` — final style layer (must stay last)

**Removed from active chain (2026-09-18):**
- `apply-canonical-model-968f-alias.js` — alias lives in `modules/sdlg-core.js`; externalize guards inline identity helpers
- `apply-currency-usd-placeholder-fix.js` — currency rules live in `modules/sdlg-core.js`; externalize delegates normalizeClaimCurrency to the module

Then verify gates run in order:
- `verify-production.js`
- `verify-parser-contract.js`
- `verify-warranty-contract.js`
- `verify-source-lock.js`
- `verify-claim-id-year-contract.js`
- `verify-public-release.js`

### Injector freeze rule (free-tier / stability)
- **Do not add new `apply-*.js` injectors** for routine fixes.
- Prefer direct edits to `modules/*.js` or targeted, isolated changes.
- Broad regex rewriting of the full `index.html` monolith is considered unsafe.
- Do **not** re-enable `apply-zero-display-fix.js` without a replacement design + full regression.
- Do **not** re-add the removed 968F/currency injectors; fix those domains in `modules/sdlg-core.js` instead.

### Scripts present but NOT in the active build chain
These are one-off / historical / manual tools. Do not wire them into `build-production.js` without explicit review:
- `apply-mobile-hardfix.js`, `mobile-hardfix-v2.js`
- `apply-zero-display-fix.js` (disabled on purpose)
- `apply-canonical-model-968f-alias.js`, `apply-currency-usd-placeholder-fix.js` (removed 2026-09-18; kept on disk for history)
- `fix-effective-currency-scope.js`, `fix-policy-object-render.js`
- Python helpers (`apply_action_center.py`, `apply_report_naming.py`, `apply_workflow_catchup.py`, export repair scripts, etc.)

## Regression gates
- `frontend-ci.yml` validates required frontend files, compiles Python patch scripts, runs the production build/regression gate, and checks required patch scripts.
- `production-smoke.yml` treats **Cloudflare Workers as the sole production check**, plus Supabase REST/RLS/API protection checks.
- `browser-smoke.yml` / `scripts/browser-smoke.js` exercises the Cloudflare production page with Chrome and verifies React/ReactDOM, core modules, dashboard modules, login shell, and anonymous claims protection.
- `scripts/browser-e2e-auth.js` is the authenticated journey scaffold (requires dedicated test credentials).
- `scripts/verify-warranty-contract.js` performs the golden warranty RPC assertions when credentials are supplied. Without credentials it must report skipped, never fake a pass.

## Change record expectation
For each non-trivial fix, record:

- Problem / symptom
- Root cause
- Files/database objects changed
- Why the change is isolated
- Regression tests run
- Production deployment (Cloudflare) / commit
- Final verification result

## Definition of done
A fix is done only when the original failure is resolved AND the relevant regression suite remains passing AND the production deployment on Cloudflare is verified.
