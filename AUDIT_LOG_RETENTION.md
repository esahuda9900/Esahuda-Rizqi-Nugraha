# SDLG claim_audit_log — Retention Strategy

Last updated: 2026-09-16

## Purpose
`public.claim_audit_log` stores full `old_row` / `new_row` jsonb snapshots for operational accountability.
It is the primary free-tier growth table (~22 MB / ~4.5k rows after early heavy use).

**Rule: never silent-truncate production audit history.**

## Current posture
- Keep full history while total DB size is comfortable (current ~46 MB; free limit ~500 MB).
- Monitor via:
  ```sql
  SELECT * FROM public.free_tier_db_health;
  ```
- Pressure threshold for action: **~300–400 MB total DB** or audit table alone becoming the dominant consumer.

## When pressure approaches — approved sequence

1. **Export / backup first**
   - Prefer existing GitHub Actions backup artifact (`sdlg-supabase-backup.yml`) or a dedicated dump of audit rows older than N days.
   - Confirm artifact is downloadable and restorable before any delete.

2. **Archive to cold storage (optional table)**
   - Create e.g. `legacy_archive.claim_audit_log_archive` (or equivalent) with the same columns.
   - Insert rows older than the chosen cutoff (e.g. 180 or 365 days) into the archive table.
   - Verify row counts match before delete from hot table.

3. **Delete from hot table only after explicit approval**
   - Business owner confirms cutoff date and that archive/export is complete.
   - Delete in batches if needed; never one big unlogged truncate without record.

4. **Document the operation**
   - Date, cutoff, rows moved/deleted, artifact location, operator.

## What we do NOT do
- Auto-delete on a schedule without human approval.
- Reduce payload (e.g. store only `changed_fields`) without a separate design + migration plan.
- Drop indexes or disable audit triggers to “save space” without impact analysis.

## Future optional improvements (not required now)
- Partial payload for low-risk actions (status-only changes) if volume justifies it.
- Partitioning by month if row count grows into hundreds of thousands.
- Move archive to object storage (CSV/Parquet) after a successful cold-table period.

## Related
- `FREE_TIER.md` — size watch and free limits
- `SECURITY.md` — do not weaken RLS or write RPCs as a side effect of retention work
- `RUNBOOK.md` — operator checklist
