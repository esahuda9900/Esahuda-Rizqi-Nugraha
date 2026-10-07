# Expert Hardening Pack — 2026-10-05 (terima jadi)

## Sudah LIVE (tanpa action user)

| ID | Item | Status |
|----|------|--------|
| F1 | Parts schema canonical di Supabase | **LIVE production** |
| F2 | Secrets scan production HTML/modules | **PASS** (tidak ada service_role/JWT/AIza bocor) |
| F2-F13 | Artifact di repo `main` | **Committed** |

## F1 verify (opsional, read-only)
```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE has_legacy_keys IS TRUE) AS legacy,
       count(*) FILTER (WHERE zero_unit_price_count > 0) AS zero_price_claims
FROM public.parts_schema_health;
-- expected: total≈535, legacy=0
```

## Scripts siap pakai (lokal / CI)
- `bash scripts/scan-secrets.sh`
- `bash scripts/branch-cleanup.sh` (default dry-run)
- `node scripts/verify-deploy-hash.js`

## Tidak diubah tanpa smoke test operator
- Extract injector F11/F12 (risiko regresi UI) — rencana di F11_F12_EXTRACT_PLAN.md
- Hapus massal 80+ branch — script ada, eksekusi delete hanya via `--execute` sadar
