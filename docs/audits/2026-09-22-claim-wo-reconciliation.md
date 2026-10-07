# Claim ↔ AX Work Order Reconciliation — 2026-09-22

## Evidence snapshot

Source: `public.claim_wo_reconciliation_summary_v` and `public.claim_wo_reconciliation_v`.

Active claims: **526**

- WO matched: 465
- WO not found in AX: 36
- AX WO canceled: 3
- AX WO non-warranty type: 14
- Claim WO missing: **1**
- Serial mismatch: **9**
- Serial match: 435
- Serial source missing: 0

This audit is read-only. **No claim, WO, warranty, or financial data was changed.**

## Manual reconciliation queue

### Serial mismatches (9)

| Claim ID | Claim WO | Claim serial | AX WO | AX serial | AX chassis | AX status/type | Reconciliation status |
|---|---|---|---|---|---|---|---|
| 0003-2026-SDLG-PFR | WO25037263 | VLGL956HCR0620670 | WO25037263 | VLGL956HCR0620658 | VLGL956HCR0620670 | Closed / WAR | AX_WO_SERIAL_MISMATCH |
| 0008-2025-SDLG-PFR | WO25033216 | VLGE655FCN0600267 | WO25033216 | 600282 | VLGE655FHN0600282 | Closed / WAR | AX_WO_SERIAL_MISMATCH |
| 0020-2025-SDLG-PFR | WO25033007 | VLGE613FLN0606352 | WO25033007 | VLGE613FCN0606355 | VLGE613FCN0606355 | Created / MW | AX_WO_SERIAL_MISMATCH |
| 0051-2025-SDLG-PFR | WO25032738 | VLGE621FVN0609600 | WO25032738 | VLGE606FAR0626109 | VLGE606FAR0626109 | Closed / WAR | AX_WO_SERIAL_MISMATCH |
| 0056-2025-SDLG-PFR | WO25033379 | VLGE621FHN0609701 | WO25033379 | VLGE635HHP0610013 | VLGE635HHP0610013 | Closed / WAR | AX_WO_SERIAL_MISMATCH |
| 0061-2025-SDLG-PFR | WO25033422 | VLGE608FCP0607379 | WO25033422 | 600642 | VLGG922FAP0600642 | Closed / WAR | AX_WO_SERIAL_MISMATCH |
| 0143-2025-SDLG-PFR | WO25035836 | VLGE613FLP0606502 | WO25035836 | VLGE613FJP0606509 | VLGE613FJP0606509 | Closed / WAR | AX_WO_SERIAL_MISMATCH |
| 0151-2026-SDLG-PFR | WO25037519 | VLGE608FVS0607688 | WO25037519 | VLGE608FAS0607529 | VLGE608FAS0607529 | Canceled / WAR | AX_WO_CANCELED + serial mismatch |
| 0174-2025-SDLG-PFR | WO25037038 | VLGE613FJP0606509 | WO25037038 | VLGE613FLP0606502 | VLGE613FLP0606502 | Closed / WAR | AX_WO_SERIAL_MISMATCH |

### Missing claim WO (1)

| Claim ID | Branch | Model | Claim serial | Customer | Claim WO | AX match |
|---|---|---|---|---|---|---|
| 0240-2026-SDLG-PFR | SURABAYA | L936H | VLGL936HCS0620968 | PT. Berkat Alam Cemerlang | **blank** | **WO not found in AX** |

## Manual reconciliation procedure

For each row, reconcile against the authoritative AX source/export and supporting service evidence. Record the confirmed serial/chassis, WO identity, reason for mismatch, evidence reference, reviewer, and reconciliation date.

Do **not** auto-fill `claims` or `ax_warranty_work_orders` from this report.

## Status

**MANUAL REVIEW REQUIRED**

This file records the observed discrepancy set only. It is not a data correction log.
