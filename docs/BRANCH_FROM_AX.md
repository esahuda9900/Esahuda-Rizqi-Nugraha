# Machine branch from AX ERP

Last updated: 2026-09-29

## Source of truth

| Domain | Source |
|--------|--------|
| Unit identity (serial, model, B/L) | `machines` master (SDLG) |
| **Operational branch** | Latest AX WO `primary_resource_group` |

## Apply

```sql
SELECT * FROM public.sdlg_apply_serial_corrections(false);
SELECT * FROM public.sdlg_enrich_machine_branch_from_ax(false, true);
```

- `p_overwrite=true` (default): update even if branch already set (claim may be stale).
- Latest WO = max(`created_date`, `start_date`, `imported_at`).

## Map table

`sdlg_ax_branch_aliases` — e.g. `ITR - JAKARTA BRANCH` → `JAKARTA`, `ITR - MAKASAR` → `MAKASSAR`, `ITR - MUARA ENIM` → `MUARA ENIM`.

## Lesson

`ops_incident_lessons.lesson_key = machine_branch_from_ax_resource_group`
