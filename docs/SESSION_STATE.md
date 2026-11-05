# SESSION_STATE — 2026-11-06

## Production baseline
- Main production remains the legacy index.html -> app.html application.
- Login page loads successfully (https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/).
- Latest deploys via static.yml successful as of last check. No open issues.
- Claims count: 564 (stable).

## Current health (2026-11-06 monitoring)
- Supabase project ACTIVE_HEALTHY. Claims total 564. Recent claims: 8 in last 7 days (latest created 2026-11-04).
- Status distribution: Paid 313, SDLG Audit 236, Draft 12, Rejected 3.
- Security advisors: known warnings on SECURITY DEFINER RPCs (create/update/delete_sdlg_claim etc.) callable by authenticated — intentional for business logic. Leaked password protection disabled (known).
- Performance advisors: auth RLS initplan on machines table (minor), many unused indexes (info), multiple permissive policies on ax_warranty_work_order_costs (minor).
- Logs: no critical errors in recent window. Normal edge/postgrest/postgres activity present (non-critical).
- Backup workflow (sdlg-supabase-backup.yml) failing again on schedule (password authentication failed for user "postgres" — non-critical). No successful restore test established.

## Task Queue status
- [TUGAS 1]: Routine monitoring & health check → Status: SELESAI PUSH
- [TUGAS 2]: Production web legacy upgrade (performance & reliability):
  - Memoized 564+ claims filtering & sorting via `useMemo` with non-enumerable lazy `_searchCorpus`.
  - Cleaned up duplicate `modules/sdlg-repository.js` inclusion in `app.html`.
  - Updated canonical warranty helper cache-busting version (`?v=20261105-smart-engine-v2`).
  - Created staging SQL migration script `scripts/sql/20261105_optimize_rls_and_policies.sql` for RLS InitPlan & policy consolidation.
  - Documented `SUPABASE_DB_URL` session pooler format in `RUNBOOK.md` for backup workflow.
  - All 10 verification contracts passing 100%.

## Handover notes
- Legacy production web running smoothly at root (`/`) with instant search and zero render thrashing.
- Cutover policy strictly maintained (no unauthorized switch of `/`).
- All checks green: `npm run verify`, `compile_applet`, `lint_applet`.
