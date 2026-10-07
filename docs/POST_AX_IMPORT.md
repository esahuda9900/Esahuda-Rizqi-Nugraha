# Post AX import refresh

**Always run after importing AX work orders.**

## CLI (repo)

```bash
export SUPABASE_URL=https://frqvelcreczmnofldrga.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...   # required for machine updates under RLS

npm run ops:post-ax-import          # apply
npm run ops:post-ax-import:dry      # preview
```

Script: `scripts/post-ax-import-refresh.js` → RPC `sdlg_post_ax_import_refresh`.

## SQL

```sql
SELECT * FROM public.sdlg_post_ax_import_refresh(false);
```

## Steps (in order)

1. `sdlg_apply_serial_corrections` — typo maps + chassis→serial promote  
2. `sdlg_enrich_machine_branch_from_ax` — latest WO `primary_resource_group` → branch  
3. `sdlg_enrich_machine_customer_from_ax` — customer from AX signal (see below)  

## Source of truth

| Field | Source |
|-------|--------|
| Unit serial / model / B/L | SDLG `machines` master |
| Branch | AX ERP resource group (latest WO) |
| Customer identity | AX `customer_account` → `customers.customer_code` (preferred) |
| Customer label | `coalesce(delivery_name, custodian)` |

### Customer enrich rules (2026-09-30)

1. Consider WO rows that have **any** of: `delivery_name`, `custodian`, `customer_account`.
2. Rank: prefer human label, then account code, then latest date.
3. Resolve via `sdlg_resolve_or_create_customer(label, account)`.
4. If machine already has a customer with the **same normalized name**, keep FK; only stamp missing `customer_code` when unique.
5. `sdlg_normalize_customer_name` strips legal tokens PT/CV/MR/MRS/MS/HJ/HAJI/H from both ends.

**Fact:** units with all three fields blank on every WO cannot be auto-enriched (data source gap).

## Free-tier checks

```sql
SELECT * FROM public.sdlg_free_tier_pressure();
SELECT * FROM public.sdlg_audit_log_growth_v LIMIT 14;
```

## Related

- `docs/SERIAL_CORRECTION_MEMORY.md`
- `docs/BRANCH_FROM_AX.md`
- `UNIT_LOOKUP.md`
- `AUDIT_LOG_RETENTION.md`
- Lesson: `post_ax_import_refresh_pipeline`
