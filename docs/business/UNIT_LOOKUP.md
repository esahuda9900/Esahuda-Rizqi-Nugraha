# SDLG Unit Lookup

Last updated: 2026-09-29 (AX chassis promotion)

## Rule

| Input | Method | Safety |
|-------|--------|--------|
| Full serial / VIN | `full_serial` / `exact_serial` | Unique (`machines.serial_no`) |
| Last 6 digits **+ model** | `suffix6_model` | Nearly unique (3 collisions fleet-wide) |
| Last 6 digits only | `suffix6_only` | **Ambiguous** — may return many rows |

Never use suffix6 alone as sole identity for auto-write.

## AX WO identity (`serial_no` vs `chassis_no`)

AX exports often put **full VIN in `chassis_no`** and only the **6-digit tail in `serial_no`**.

Migration `fix_ax_wo_serial_from_chassis_and_lookup` (2026-09-29):

1. **Data:** When `chassis_no` is full (≥10 normalized chars) and `serial_no` is empty/short with matching suffix6, promote `serial_no ← chassis_no`. Previous value noted in `source_quality_notes` (`serial_promoted_from_chassis@…`). Original import still in `source_payload`.
2. **Costs:** Short `serial_number` promoted from parent WO or unique machine suffix6 match.
3. **Logic:** `sdlg_ax_unit_serial(serial, chassis)` prefers full chassis, then full serial.
4. **Lookup:** `sdlg_lookup_unit` AX WO counts match on effective unit key / chassis / serial.

## RPC

```sql
SELECT * FROM public.sdlg_lookup_unit(p_serial text, p_model text DEFAULT NULL);
```

### Examples

```sql
SELECT * FROM public.sdlg_lookup_unit('VLGE613FKP0606489');
SELECT * FROM public.sdlg_lookup_unit('0606489', 'E6138F');
```

If `candidate_count > 1`, UI must force operator pick (do not auto-bind).

## Helpers

- `sdlg_normalize_serial(text)`
- `sdlg_serial_suffix6(text)`
- `sdlg_normalize_model(text)`
- `sdlg_ax_unit_serial(serial, chassis)` — AX effective unit key

## Indexes

Machines / claims / AX serial suffix6 + norm; AX chassis norm + suffix6; models code norm.

## Security

`SECURITY INVOKER`. `EXECUTE` granted to `authenticated`.
