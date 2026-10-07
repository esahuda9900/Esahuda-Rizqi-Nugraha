# Boss / Ops Claim Analytics

Last updated: 2026-09-16

## What bosses usually ask

| Question | Where to look |
|----------|----------------|
| Klaim per tahun / bulan | Master Dashboard filter **Periode analisa** + Claim Trend |
| Model / unit paling sering rusak | Claims per Model + Unit/serial ranking |
| Rusaknya apa kebanyakan | Top Failure Parts |
| Customer paling banyak klaim | Customer ranking panel |
| Cabang mana | Claims per Branch |
| Bola proses di siapa | Ball in court panel |
| Status terakhir | Status ranking |
| Aging status sekarang | Aging buckets (0-6d … 60d+) |
| Stuck di tahap mana | Aging rata-rata per tahap + SQL views |
| Sudah follow-up? kapan? jawaban? | Claim detail status history + `claim_ops_boss_v` |

## Database views (authenticated, security_invoker)

```sql
SELECT * FROM public.claim_ops_boss_v LIMIT 50;

SELECT claim_year, COUNT(*) FROM public.claim_ops_boss_v GROUP BY 1 ORDER BY 1;

SELECT current_owner, COUNT(*), ROUND(AVG(days_open)::numeric, 1) avg_open
FROM public.claim_ops_boss_v GROUP BY 1 ORDER BY 2 DESC;

SELECT * FROM public.claim_stage_aging_summary_v;

SELECT * FROM public.claim_status_dwell_v;
```

## UI module

- `modules/boss-analytics-dashboard.js` → `window.SDLGBossAnalytics`
- Year filter + extra rank panels on Master Dashboard (when index wiring is deployed)
- Does **not** change claim write paths or RPC grants

## Current data snapshot (2026-09-16)

Most open claims sit in **SDLG Audit** (~522). Process aging shows long wait after dealer claim → audit (principal side). Failure → repair median ~9 days; failure → dealer claim median ~52 days.

## Follow-up notes

No dedicated CRM follow-up table yet. Proxy fields:

- `claim_status_history.reason` + timestamps
- `claims.status_update_reason`

Add a structured follow-up table only when daily ops need it — do not overload audit log.
