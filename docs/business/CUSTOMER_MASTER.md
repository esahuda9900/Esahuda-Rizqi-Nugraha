# Customer Master — Unified MDM baseline

Last updated: 2026-09-30

## Goal

One golden table `public.customers` that all apps link to:

- Claims (`claims.customer_id`)
- Machines (`machines.customer_id`) — backfill still pending
- AX warranty WO (`customer_account` ↔ `customers.customer_code`)
- Master Data UI / Unit 360 / analytics

## Snapshot (2026-09-24, live)

| Metric | Value |
|--------|-------|
| `customers` rows | **260** |
| Rows with `customer_code` (AX account) | **159** |
| AX distinct `customer_account` covered | **159 / 159** |
| Rows with `customer_type` | **260 / 260** |
| Claims with valid `customer_id` | **528 / 528** |

### Schema (operational)

- `id` (uuid, PK)
- `customer_code` — Dynamics AX customer account when known
- `customer_name` — canonical display name
- `customer_type` — `corporate` | `cv` | `individual`
- `is_active`
- `created_at` / `updated_at`

### Matching rules used

1. Normalize with `SDLGBaseCustomerName` (`modules/sdlg-core.js` v1.1.0):
   - Strip legal-entity tokens **PT / CV / MR / MRS / MS / HJ / HAJI / H** from **both ends**
   - Collapse whitespace / hyphens, keep A-Z0-9 only
   - Examples that are equivalent:
     - `CV. WEN WEN LESTARI` ↔ `WEN-WEN LESTARI CV.` → `WENWENLESTARI`
     - `PT. INDO TRAKTOR UTAMA` ↔ `INDO TRAKTOR UTAMA PT.` → `INDOTRAKTORUTAMA`
2. Match AX delivery/custodian/name → existing master → set `customer_code`.
3. Insert master for AX accounts with no name match.
4. Claim text without FK → match/insert → set `claims.customer_id`.

### SOURCE LOCK note (2026-09-30)

Save was blocked when form source had `CV. NAME` and master/parse had `NAME CV.` because the old normalizer only stripped **leading** tokens. Fixed in `modules/sdlg-core.js` (`baseCustomerName` + re-assert after main bundle).

## Still open

1. **Machines backfill** — set `machines.customer_id` from name/source/AX serial chain (weak matches forbidden).
2. **Near-duplicate merge** (manual review):
   - `PT. ADIMULIA AGRO LESTARI` vs `PT. ADIMULIA AGROLESTARI`
   - `I KETUT WIDANA` vs `MR. I KETUT WIDANA`
   - `MR. FAUZIMAH SE` vs `FAUZIMAH, SE`
   - `MRS. FITRI UTAMI` vs `HJ. FITRI UTAMI`
   - `MR. BUDIMAN` vs `H. BUDIMAN`
3. Optional `customer_aliases` table for historical spellings.
4. Master Data UI: search beyond 200 rows; show code + linked counts.
5. **Total Amount mis-parse** — when source shows `¥-` placeholders, parser must not adopt serial-suffix numbers (e.g. `0.611152` from SN). Track separately from customer lock.

## Do not

- Delete a customer that is still referenced by claims/machines.
- Invent AX codes; only use real `customer_account` values.
- Replace claim display text blindly without keeping provenance when needed.
