# SDLG Model & Indent Naming (persisted in DB)

Source: SDLG Service Department training (Wheel Loader / Excavator / Motor Grader / Road Roller Model and Indent No., Mar 2020).

## Where it lives

| Object | Purpose |
|--------|--------|
| `public.sdlg_product_type_codes` | L/E/G/R/B/P → product family + main-parameter unit |
| `public.sdlg_model_naming_knowledge` | Official segment rules (JSON), policy bucket notes, serial vs indent |
| `public.models.*` decode columns | Per model_code: family, ton/hp, generation, **policy_model_scope** |
| `public.sdlg_decode_model_policy(model_code)` | RPC helper for app/SQL |
| `machines.policy_model_scope` | Copied from models for warranty resolver |

## Wheel Loader (new generation) — e.g. L968F

| Segment | L968F | Meaning |
|---------|-------|--------|
| L | L | Product type = Wheel Loader |
| 9 | 9 | Driving type |
| 6 | 6 | Main parameter ≈ **rated load class ~6 t** |
| 8 | 8 | **Platform code** (not “old/new series”) |
| F | F | **Generation code** |

Old generation example **LG936L**: LG=manufacturer, 9=WL, rated-load digit, configuration digit (6=intermediate), update letter.

## Policy tonnage buckets (Loader)

Policy table has: `T < 3 t` | `3 t <= T <= 5 t` | `5 t < T < 6 t` | `T >= 7 t`.

**There is no exact 6 t bucket.** L968F (~6 t) is mapped to **`T >= 7 t`** operationally — documented in `sdlg_model_naming_knowledge` and `models.naming_notes`.

## Other lines (main parameter unit differs)

- **Excavator**: operating weight (ton) — e.g. E6210F ≈ 21 t → `20 t <= T < 65 t`
- **Motor Grader**: engine hp — e.g. G9290 → `>=290 hp`
- **Road Roller**: operating weight (ton)

## Serial vs Indent

- **Chassis serial** (`VLGL968FES0620769`): match by suffix6 + model token; prefix letter ≈ family.
- **Indent No.**: configuration string (engine brand, emission, hydraulics…) — not the same as VIN.

## Quick checks

```sql
SELECT * FROM public.sdlg_decode_model_policy('L968F');
SELECT rule_key, rule_body FROM public.sdlg_model_naming_knowledge WHERE product_line = 'Wheel Loader';
SELECT model_code, rated_load_ton, policy_model_scope FROM public.models WHERE product_family = 'Loader' ORDER BY 1;
```
