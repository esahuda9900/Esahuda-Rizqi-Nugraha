# SDLG Warranty Claim — Current Status

Last updated: **2026-10-06 10:40 WIB** (Expert data-quality backfill)

## One-line
**Production stable + data FK integrity restored.** All 536 claims now have linked `causing_part_id`, `dealer_id`, `model_id`, `branch_id`, `customer_id`. New `data_quality_health` view for continuous monitoring.

## Score (expert)

| Dimensi | Skor | Delta |
|---------|------|-------|
| Production availability | **9/10** | — |
| Operator UX (claim detail / input) | **8.5/10** | — |
| SPA module reliability | **9/10** | — |
| Data accuracy (FK / master) | **9/10** | ↑ from 6.5 |
| Maintainability | **6/10** | — (monolith debt remains) |
| **Overall operable** | **~9/10** | ↑ |

True 10/10 still needs: evidence/photo completeness + long-term reduce monolith HTML + authenticated E2E.

## What shipped 2026-10-06 (expert pass)

| Item | Detail |
|------|--------|
| Dirty part cleanup | Claim `0247-2026-SDLG-PFR` part_no cleaned `SLG-4110017423060` |
| Parts master | +11 missing parts inserted (now 249) |
| FK backfill parts | **517 → 0** unlinked `causing_part_id` |
| FK backfill dealers | **506 → 0** unlinked `dealer_id` |
| Data quality view | `public.data_quality_health` (security_invoker) |
| Live proof | 536/536 claims fully FK-linked on all master dimensions |

## Production checks

| Check | Status |
|-------|--------|
| URL | https://sdlg-warranty-backup.esahuda9900.workers.dev |
| Modules HTTP | All critical **200** |
| `warranty-tracking-ux.js` | **v1.6.7** |
| `sdlg-input-helper-ux.js` | **v1.7** |
| `navigation-state.js` | **v10** |
| FK integrity | **100%** (part/dealer/model/branch/customer) |
| DB size | **64 MB** / 500 MB free |

## Residual (not emergencies)

1. Evidence items empty on ~511 claims → **ops/import** (historical)
2. Photo count 0 on ~489 claims → **ops/import**
3. Wear-component REVIEW policy ambiguity → **policy decision**
4. Monolith `index.html` ~3 MB → prefer modules (freeze injectors)
5. Authenticated browser E2E still outstanding

## Quick health check

```sql
SELECT * FROM public.data_quality_health;
SELECT * FROM public.free_tier_db_health;
```

## Operating posture

1. Domain logic stays in Supabase.
2. Prefer `modules/*.js` over injectors.
3. Smallest safe fix → smoke on Cloudflare.
4. Do not hand-push 3 MB index via flaky channels.
5. Monitor `data_quality_health` after any bulk import.

---
*Expert data-quality pass 2026-10-06.*
