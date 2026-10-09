# SDLG Warranty Claim — Free Tier Operating Baseline

Last updated: **2026-10-06** (expert data-quality pass)

## Goals
Stay within free limits while keeping the app stable and secure.
Maximize value of the existing database, RLS, and SECURITY DEFINER RPCs — do not add paid features.

| Service | Free limit (approx) | Current / Watch |
|---------|---------------------|-----------------|
| Supabase DB | 500 MB | **71 MB total** (2026-10-06) — ~14% used |
| `claim_audit_log` | part of DB | **39 MB / 6,893 rows** — primary growth risk |
| `claims` | — | ~4 MB / 536 active rows |
| `machines` | — | 6.5 MB / 3,676 rows |
| Supabase Auth | Fair use / Free features only | 3 active app users (closed set); no leaked-password API |
| Supabase Edge Functions | 500k invocations/mo | Only `gemini-parse-claim` |
| GitHub Actions | 2,000 min/mo | Daily backup + smoke + frontend-ci |
| Cloudflare Workers | Free tier static assets | **Sole production** |

## Auth on Free (important)

- **Leaked Password Protection** = Pro only → **skip**.
- Instead:
  - Minimum password length ≥ 12 (prefer 14+)
  - No public self-signup (admin creates users only)
  - Revoke inactive users: `app_user_roles.is_active = false`
  - Rely on RLS + RPC body role checks as the real boundary

### Current closed user set
- Admin + viewer + test accounts via `app_user_roles` (3 active)
- Older auth users without `app_user_roles` row are effectively inactive for the app

## Database size watch

Largest tables (measured 2026-10-06):
- `claim_audit_log` — full old/new jsonb snapshots (**39 MB**)
- `machines` (~6.5 MB)
- `claims` (~4 MB)

**Do not** auto-truncate audit log. When approaching pressure (~300–400 MB):
1. Export old rows (GitHub Actions artifact or local dump)
2. Archive to a cold table
3. Then delete from hot table with explicit approval

### Preferred checks
```sql
SELECT * FROM public.free_tier_db_health;
SELECT * FROM public.data_quality_health;  -- FK / master completeness
```
Both views are `security_invoker`, `SELECT` for `authenticated` only.

## Security checklist (manual, free)
- [ ] Password min length ≥ 12 in Auth settings
- [ ] No public self-signup
- [x] Inactive users have no active `app_user_roles` row (or `is_active = false`)
- [ ] Re-run Security Advisors after any DDL
- [x] Never put `service_role` key in frontend
- [x] Confirm `private_*` helpers are not executable by `authenticated`

## What we intentionally keep (do not "fix" these)
- SECURITY DEFINER claim RPCs (`create_sdlg_claim`, `update_sdlg_claim`, `delete_sdlg_claim`, status updaters) — role-checked inside via `private_is_warranty_claim_writer()`
- `sdlg_warranty_resolve_claim` as SECURITY INVOKER canonical engine
- Comprehensive indexes on `public.claims` (unused indexes left for now; data still small)
- Daily Supabase schema+data backup via GitHub Actions
- RLS enabled on all operational and archive tables

## What we avoid on free tier
- Extra Edge Functions
- Realtime subscriptions on every page
- Large binary uploads without lifecycle rules
- Converting intentional SECURITY DEFINER RPCs to INVOKER without full client rewrite
- Aggressive archive/truncate of audit log without backup + approval
- Workflow noise that burns GitHub Actions minutes
- Dropping unused indexes while data volume is still low

## Operating rules (expert contract)
1. Database is the system of record for business rules and authorization.
2. Frontend is presentation only; never a second warranty engine.
3. Prefer module extraction (`modules/*.js`) over new `apply-*.js` injectors.
4. Every production change: smallest safe fix → regression → smoke verify on Cloudflare.
5. Free-tier headroom is a feature — protect it.

See also: `PLUGINS.md`, `INJECTOR_ROADMAP.md`, `SECURITY.md`, `AUDIT_LOG_RETENTION.md`, `DATA_QUALITY.md`.
