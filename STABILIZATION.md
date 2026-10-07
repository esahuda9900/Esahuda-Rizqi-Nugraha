# SDLG Stabilization Status

Last updated: **2026-10-02** (expert full-system audit confirmation)

## Verdict
**Stabilization phase complete** for free-tier production posture.
**2026-10-02 expert audit: zero critical / high-severity production bugs.**
Do not continue drive-by privilege or broad frontend rewrites without a concrete bug or measured plan.

## What was fixed / locked

### Database (Supabase)
- Privilege model left intentional: SECURITY DEFINER claim RPCs + in-body role checks
- RLS remains the authorization boundary
- Added `public.free_tier_db_health` (`security_invoker`, SELECT for authenticated)
- No claim write path changes

### Frontend risk control
- Injector freeze documented in `DEPLOYMENT.md`, `INJECTOR_ROADMAP.md`, `scripts/build-production.js`
- `apply-zero-display-fix.js` blocked from active chain (CI enforced)
- `modules/sdlg-core.js` treated as identity/currency source of truth
- Navigation persistence + newest-first claim sort extracted to modules
- Progressive module loader in `modules/navigation-state.js` (Tracking UX, Assessment UX, etc.)

### Hosting clarity (locked 2026-09-23)
- **Sole production:** Cloudflare Workers (`https://sdlg-warranty-backup.esahuda9900.workers.dev`)
- Vercel fully retired: `vercel.json` deleted, secondary smoke removed, dual-host docs cleared
- Production smoke treats Cloudflare as the only production surface
- Docs aligned: `DEPLOYMENT.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE_STABILITY.md`, `RELEASE_READINESS.md`

### CI / ops
- `verify-source-lock.js` enforces core contract, freeze, free-tier/security/injector docs
- `frontend-ci.yml` requires sdlg-core + stability docs
- `production-smoke.yml` checks Cloudflare HTML markers, browser smoke, Supabase REST/RLS/API protection
- `scripts/browser-e2e-auth.js` scaffold ready (activates when `E2E_TEST_EMAIL` + `E2E_TEST_PASSWORD` exist)

### Docs map
- `PLUGINS.md` — platform roles
- `FREE_TIER.md` — limits + health view
- `SECURITY.md` — intentional DEFINER design
- `INJECTOR_ROADMAP.md` — safe deprecation order (synced 2026-10-02)
- `AUDIT_LOG_RETENTION.md` — growth strategy (no silent truncate)
- `RUNBOOK.md` — operator procedures / knowledge transfer
- `RELEASE_READINESS.md` — current gates
- `CURRENT_STATUS.md` — live expert snapshot (updated 2026-10-02)

## Explicitly NOT done (by design)
- Mass removal of active injectors (needs per-step regression)
- Framework migration (Next/Vite rewrite)
- Revoking SECURITY DEFINER EXECUTE from authenticated
- Auto-truncating `claim_audit_log`
- Large Action Center UI redesign (incremental usefulness only when justified)
- Full authenticated E2E journey (scaffold exists; needs dedicated test user + secrets — issue #12 closed by operator acceptance)

## Next work (only when justified)
1. Extract SOURCE LOCK + parser injectors into modules (highest remaining debt — see `INJECTOR_ROADMAP.md`)
2. Manual login smoke on **Cloudflare** URL after each meaningful deploy
3. Archive audit log only when DB size approaches pressure (~300–400 MB) — follow `AUDIT_LOG_RETENTION.md`
4. Action Center usefulness improvements (aging / next-action clarity) without visual redesign
5. Create dedicated non-production test user → expand browser E2E when ready
6. Close the 44 machines without customer (AX/ERP data side)

## Operator checks
```sql
SELECT * FROM public.free_tier_db_health;
```
Production URL: https://sdlg-warranty-backup.esahuda9900.workers.dev
