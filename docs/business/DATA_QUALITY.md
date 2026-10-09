# SDLG Warranty Claim — Data Quality Snapshot

Last checked: **2026-10-06** (expert FK integrity pass)

## Volume (active)

| Entity | Count |
|--------|------:|
| Claims (active) | 536 |
| Machines | 3,676 |
| Customers | 389 |
| Parts master | 249 |
| Models | 49 |
| Dealers | 2 |
| Branches | 24 |
| Active app_user_roles | 3 |
| claim_audit_log rows | 5,869 |
| DB size | **64 MB** |

## Claim status mix (live 2026-10-06)

| Status | Count |
|--------|------:|
| Paid | 313 |
| SDLG Audit | 214 |
| Draft | 6 |
| Rejected | 3 |

## FK integrity (2026-10-06 expert fix)

| Check | Before | After |
|-------|-------:|------:|
| Unlinked `causing_part_id` | 517 | **0** |
| Unlinked `dealer_id` | 506 | **0** |
| Unlinked `model_id` | 0 | 0 |
| Unlinked `branch_id` | 0 | 0 |
| Unlinked `customer_id` | 0 | 0 |
| Claims with all master FKs | partial | **536/536** |

### Fixes applied
1. Cleaned dirty part_no on claim `0247-2026-SDLG-PFR` → `SLG-4110017423060`.
2. Inserted 11 missing parts into `parts_master`.
3. Backfilled `causing_part_id` from `causing_part_no` → `parts_master.part_no`.
4. Backfilled `dealer_id` from `dealer_code` → `dealers.dealer_code`.
5. Created `public.data_quality_health` view (security_invoker, GRANT SELECT to authenticated).

## Residual gaps (historical import)

| Gap | Count | Notes |
|-----|------:|-------|
| No evidence_items | 511 | Historical claims; not blocking FK integrity |
| No photos (photo_count=0) | 489 | Ops/import completeness |

These do **not** break warranty resolution or claim write path.

## Continuous monitoring

```sql
SELECT * FROM public.data_quality_health;
SELECT * FROM public.free_tier_db_health;
```

## Notes for free-tier ops

- Prefer fixing missing FKs over inventing default values.
- Keep master data (customers / parts / models / dealers) clean; resolution UX depends on it.
- Audit log growth: see `AUDIT_LOG_RETENTION.md`.
- After any bulk import, re-run `data_quality_health` and backfill FKs if needed.

## Do not

- Bulk-update claim status without workflow rules.
- Delete audit log without export.
- Create customers with near-duplicate names without checking aliases first.
- Treat SDLG Audit as “must act now” — it is principal-side monitoring.
