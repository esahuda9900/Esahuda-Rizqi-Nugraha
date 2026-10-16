# Progress PLAN v2.1 — Milestone 1 (+ partial M2)

**Updated:** 2026-10-16  
**Preview:** https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/preview/  
**Cutover (Milestone 3):** **DEFERRED**

## Parse / New Claim parity (focus 2026-10-16)

| Capability | Web lama | Web baru | Status |
|------------|----------|----------|--------|
| Paste + Excel import | ✅ | ✅ | done |
| Core fields (WO, model, serial, customer, dates, HM, fault, part) | ✅ | ✅ | done |
| App Code, Dealer Claim No/Date | ✅ | ✅ | v0.7 |
| Multi-line Fault / Cause / Comment | ✅ | ✅ | v0.7 |
| Parts table (qty, unit price, amount) | ✅ | ✅ | `partsRows` |
| Labour Hrs + Mileage Km (tabular) | ✅ | ✅ | cross-line fix |
| Mileage to site, Finish HM | ✅ | ✅ | done |
| Engine SN + Failure part location (captions) | ✅ | ✅ | v0.7 |
| Money harden (¥-/USD -, reject SN leak) | ✅ | ✅ | `money.ts` |
| PARTS TOTAL section-stop | ✅ | ✅ | done |
| 1 WO ≈ 1 claim; clear WO on Simpan Baru | ✅ | ✅ | `applyNewClaimWoPolicy` |
| WO allowlist multi-claim | ✅ | ✅ | WO26040309 |
| SOURCE LOCK soft/hard | ✅ | ✅ | hard blocks update |
| WO collision modal + diff | ✅ | ✅ | richer fields |
| Master match serial → full VLG / model / branch | ✅ | ✅ | `mergeMachine` |
| omit empty on update | ✅ | ✅ | done |
| RPC create | ✅ | ✅ | done |
| Evidence photo captions UI | ✅ | ❌ | out of scope M1 (no Storage) |
| Field provenance / SOURCE CAPTURE debug UI | ✅ | ❌ | defer |
| Sticky footer polish | ✅ | 🟡 | actions row only |

## Coding status

| Fase | Status |
|------|--------|
| 0 inventaris + CI | ✅ |
| 1A Claims list | ✅ |
| 1B Claim detail | ✅ |
| 2 SDLG helper | ✅ |
| 3 Export/Backup | ✅ |
| 4 Parse + save | ✅ **deep parity v0.7** |
| 5 Admin Center v1 | ✅ |
| M3 cutover | ⏸ forbidden until owner accepts |

## Rule

Do not change `index.html` / `modules/*`. Do not archive old web until owner signs parity.
