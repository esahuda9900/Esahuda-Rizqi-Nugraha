# SLO — SDLG Warranty Claim

| ID | Target | Window |
|----|--------|--------|
| Availability prod URL | ≥ 99.5% HTTP 2xx | 30 hari |
| p95 TTFB `/` | ≤ 300 ms | 30 hari |
| RPC error rate | ≤ 0.5% | 30 hari |

Error budget availability 99.5% ≈ 3.6 jam downtime / 30 hari.

Cek cepat:
```bash
curl -s -o /dev/null -w "http=%{http_code} ttfb=%{time_starttransfer}\n" https://sdlg-warranty-backup.esahuda9900.workers.dev/
```
