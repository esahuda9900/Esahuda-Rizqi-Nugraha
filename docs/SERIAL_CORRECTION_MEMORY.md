# Serial correction memory (database)

Last updated: 2026-09-29

## Goal

Fixes learned during AX serial/chassis cleanup must **not** be rediscovered from scratch on the next import. Rules live in Postgres and are re-applied automatically.

## Table: `sdlg_serial_correction_rules`

| pattern_type | Meaning |
|--------------|--------|
| `exact_map` | `from_serial` → `to_serial` (optional `wo_no` bind) |
| `chassis_promote` | Short/empty serial + full chassis (matching suffix6) → serial := chassis |
| `suffix_unique_machine` | Reserved for future |
| `wo_bound` | Reserved for future |

Seeded maps (session 2026-09-29):

- `VLGE916HCR0600371` → `VLGL916HCR0600371`
- `VLGE621FKP610003` → `VLGE621FKP0610003`
- `620372` → `VLGL956HAR0620372`
- `VLGE621FEN0609597` → `VLGE621FLN0609597`
- plus `pattern_chassis_promote_short`

## Apply after every AX import

```sql
-- Preview
SELECT * FROM public.sdlg_apply_serial_corrections(true);

-- Commit
SELECT * FROM public.sdlg_apply_serial_corrections(false);
```

Idempotent: already-correct rows are skipped.

## Add a new confirmed typo

```sql
INSERT INTO public.sdlg_serial_correction_rules (
  rule_key, pattern_type, from_serial, to_serial, priority, evidence, source_session
) VALUES (
  'exact_my_case', 'exact_map',
  'WRONG_SERIAL', 'CORRECT_SERIAL',
  20, 'ops confirmed …', 'YYYY-MM-DD'
);

SELECT * FROM public.sdlg_apply_serial_corrections(false);
```

## Related helpers

- `sdlg_ax_unit_serial(serial, chassis)` — prefer full chassis
- `sdlg_lookup_unit(serial, model)` — unit hub lookup
- `ops_incident_lessons.lesson_key = ax_serial_vs_chassis_and_typo_patterns`

## Do NOT auto-map

- 2+ character plant-code diffs without unique suffix + human evidence
- Multi-machine suffix6 collisions
- Non-VLG serials outside fleet
