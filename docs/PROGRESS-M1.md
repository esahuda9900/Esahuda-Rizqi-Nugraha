# Progress PLAN v2.1 — Milestone 1 (+ partial M2)

**Updated:** 2026-10-16  
**Preview:** https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/preview/  
**Cutover (Milestone 3):** **DEFERRED** — owner forbids until new web feature parity accepted.

## Coding status (apps/web only)

| Fase | Status | Notes |
|------|--------|-------|
| 0 inventaris + CI + AGENTS/DECISIONS | ✅ | Staging/backup/sample = pemilik |
| 1A Claims list | ✅ | search, chips, sort, page, archived |
| 1B Claim detail | ✅ | finance, parts, status RPC, history |
| 2 SDLG helper | ✅ | copy fields, 10-day rule |
| 3 Export/Backup | ✅ | CSV + JSON role-gated |
| 4 Parse + save | ✅ | **parity pass 2026-10-16:** clear WO on Simpan Baru collision; SOURCE LOCK hard block update; section-stop money; richer modal |
| 5 Admin Center v1 | ✅ | roles, audit feed, bulk status |
| M2 archive | ✅ | archive/unarchive detail |
| M2 bulk status | ✅ | `/admin/bulk-status` |
| M2 DQ deepen | ✅ | WO dup + gaps |
| M2 Unit 360 / Masters | 🟡 | usable basic; not full legacy depth |
| M3 cutover | ⏸ | **not started — forbidden for now** |

## Parse parity (vs web lama) — 2026-10-16

| Rule | Status |
|------|--------|
| 1 WO ≈ 1 claim (clear WO on Simpan Baru + collision) | ✅ `applyNewClaimWoPolicy` |
| Allowlist multi-claim WO (`WO26040309`) | ✅ |
| SOURCE LOCK soft (key sama) / hard (key beda → block update) | ✅ |
| Money placeholder + reject SN leak | ✅ port `money.ts` |
| PARTS TOTAL section-stop (jangan ambil labour) | ✅ |
| WO collision modal + diff | ✅ richer (customer/fault/part/serial) |
| Multi-row parts table | 🟡 still single causing-part |
| Full legacy parser suite | 🟡 heuristic TSV; needs golden samples |

## Owner gates (block formal “close M1”)

- [ ] Backup manual production
- [ ] Staging Supabase
- [ ] Role matrix confirmation
- [ ] 5–10 golden paste samples
- [ ] Screenshot SDLG portal fields
- [ ] Accept 13 acceptance scenarios §10A on preview

## Known parity gaps vs web lama (why cutover waits)

- Parser still heuristic (not full legacy module suite)
- No full Command Center / boss analytics
- No payment evidence workflow (if still used)
- Master matching is soft (unit enrich + customer key), not full legacy resolver
- Admin cannot edit roles from UI (Dashboard only)
- Multi-row parts JSON still single-entry

## Rule

Do not change `index.html` / `modules/*`. Do not archive old web until owner signs parity.
