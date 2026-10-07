# AGENTS.md — SDLG Warranty Claim

> README for AI coding agents. Read this first. Do not invent architecture.

## What this project is

Internal web application for monitoring and managing **SDLG warranty claims**.
Replaces repetitive Excel/manual tracking while preserving existing warranty business rules.

**Production (sole host):** https://sdlg-warranty-backup.esahuda9900.workers.dev  
**Database / Auth:** Supabase project `frqvelcreczmnofldrga` (ap-southeast-2)  
**Repo:** `esahuda9900/sdlg-warranty-backup` · branch `main`

## Tech stack (exact)

| Layer | Choice |
|-------|--------|
| Frontend | Monolithic `index.html` + extracted `modules/*.js` |
| Hosting | **Cloudflare Workers only** (`wrangler.jsonc`) — Vercel retired 2026-09-23 |
| Database | Supabase (Postgres 17, RLS, SECURITY DEFINER claim RPCs) |
| Auth | Supabase Auth + `app_user_roles` |
| Canonical warranty engine | `public.sdlg_warranty_resolve_claim(claim_id)` |

## Critical rules (never violate)

1. **Prefer `modules/*.js`** — no new injectors for routine fixes. See `INJECTOR_ROADMAP.md`.
2. **Domain logic stays in Supabase.** Frontend must not re-implement warranty policy.
3. **Never disable RLS.** Never ship `service_role` to the browser.
4. **Never re-add `vercel.json`.** Verifiers must not require Vercel.
5. **Never hard-fail static/Cloudflare builds** solely because `CI=true` without Supabase secrets.
6. **Smallest safe fix only.** Identify root cause → minimal change → regression check → verify production Cloudflare URL.
7. **UI visibility is not authorization.** Database policies are the security boundary.
8. **Operational workflow is mandatory context.** Every UI, status, next-action, owner, handoff, or tracking change must stay aligned with the full 12-step process in `BUSINESS_RULES.md` → section **“Actual operational warranty workflow (source of truth)”**. Do not invent a simpler process. Do not ask the product owner to re-explain it.

## Before you change anything — read order

| Working on… | Read first |
|-------------|------------|
| **Any task** | This file + `CURRENT_STATUS.md` + **`BUSINESS_RULES.md` (full workflow)** |
| Deep context / business | `PROJECT_CONTEXT.md` |
| Architecture / modules | `ARCHITECTURE.md` |
| Warranty eligibility / routing | `WARRANTY_LOGIC.md` |
| UI / CSS / visual / tracking | **`DESIGN.md`** (required) + workflow in `BUSINESS_RULES.md` |
| Security / RLS / RPCs | `SECURITY.md` |
| Deploy / Cloudflare | `DEPLOY_SAFETY.md` |
| Injectors / technical debt | `INJECTOR_ROADMAP.md` |
| Free-tier size pressure | `FREE_TIER.md` |

## Project structure (high-signal)

```
index.html                 # App shell + remaining React/parser bundle (large)
modules/
  sdlg-core.js             # Single source of truth: model, identity, currency
  canonical-warranty-helper.js / modules/canonical-warranty-helper.js
  export-table-helper.js
  boss-analytics-dashboard.js
  warranty-tracking-ux.js  # Tracking panel (Owner → Stage → Next)
  … other feature modules
canonical-warranty-helper.js  # Root helper (keep in sync with modules copy)
scripts/                   # Build, apply-*, verify, browser smoke/e2e
.github/workflows/         # CI + production smoke + Cloudflare deploy
wrangler.jsonc             # Cloudflare config (do not remove)
```

Load order: `sdlg-core.js` must load **first** so later scripts cannot redefine weaker aliases.

## Commands (copy-paste)

```bash
npm run build
npm run verify
npm run browser:smoke
E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run browser:e2e-auth
```

After every meaningful deploy: smoke-check the **Cloudflare** production URL.

## Roles (authorization)

| Role | Access |
|------|--------|
| `admin` | Full (including archived where policy allows) |
| `warranty_admin` | Operational claim read/write |
| `viewer` | Read-only active claims |
| `branch_user` | Claims for assigned branch only |

Authorization is enforced inside SECURITY DEFINER RPCs via `private_is_warranty_claim_writer()` and RLS. Do not “fix” Security Advisor warnings on intentional `authenticated` EXECUTE grants without a full client rewrite.

## Warranty model (do not invent)

Two layers must be assessed separately:

- **SDLG Warranty** — principal eligibility (B/L ceiling, policy duration, HM)
- **Marketing Warranty** — company/internal coverage after SDLG OOW

Final route: SDLG · Marketing · Review Required · non-warranty handling.

Full durable rules live in `WARRANTY_LOGIC.md`. Use the canonical RPC; do not silently replace it with legacy logic.

## Operational workflow (do not invent / do not skip)

The product is a **Warranty Tracking System**. The real process (Branch ↔ TS ↔ Admin ↔ SDLG ↔ Finance ↔ Payment) is defined once in:

**`BUSINESS_RULES.md` → “Actual operational warranty workflow (source of truth)”**

Any change to status labels, next-action text, owner/handoff UI, claim detail, list chips, dashboard queues, or workflow tracker must remain consistent with that document. Settlement flag is independent of Approved/Rejected. Rejected claims require reason + evidence.

## Change boundaries

- UI-only change → must not alter warranty calculation
- Warranty-policy change → must not alter unrelated UI rendering
- DB permission change → must not silently change business outcomes
- Export change → must not modify persisted claim data
- Workflow/status/next-action change → must match `BUSINESS_RULES.md` full process

## Definition of done (agent)

1. Root cause identified
2. Smallest safe fix applied (prefer `modules/*.js`)
3. Relevant docs still accurate (or updated in the same change)
4. `npm run verify` / smoke path considered
5. If UI touched → complies with `DESIGN.md`
6. If status / owner / next-action / handoff touched → complies with full workflow in `BUSINESS_RULES.md`
7. Production Cloudflare markers still present after deploy

## What remains (context)

Main open gate: **issue #12** — authenticated browser E2E with dedicated test credentials (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`).

---

*Last aligned: 2026-10-01. Operational workflow locked as mandatory reference. Keep this file short. Deep knowledge lives in the linked docs.*
