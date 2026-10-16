# DATA-CONTRACT.md (draft Fase 0)

**Status:** draft — dilengkapi sambil jalan sebelum Fase 4.  
**Aturan:** web baru menulis format yang sama dengan web lama agar saling terbaca.

## Status klaim (nilai string persis)

Teramati di production: `Draft`, `SDLG Audit`, `Paid`, `Rejected`.

## Tanggal

- **Simpan:** ISO date `YYYY-MM-DD` atau timestamptz sesuai kolom existing.
- **Tampil UI baru:** `DD/MM/YYYY` (WIB untuk datetime).

## Uang

- Kolom numeric di DB (parts_total, total_amount, dll.).
- Parser: harden zero-placeholder (`$-`, `—`) → 0; tolak token non-uang.
- Jangan overwrite field terisi dengan `null`/kosong saat update (PLAN aturan 12).

## Identitas klaim

- `claim_id` format `NNNN-YYYY-SDLG-PFR` (alokasi ideal: RPC `next_sdlg_claim_id`).
- `dealer_wo_so`: 1 WO = 1 klaim kecuali allowlist (lihat domain woPolicy).

## Parts

- Canonicalization di DB via trigger `trg_claims_parts_canonical`.
- Frontend harus mengirim struktur parts yang diterima web lama / RPC.

## Uji kontrak (wajib tiap fitur write)

1. Klaim dibuat/diubah di web baru → buka di web lama → field benar.
2. Klaim dibuat/diubah di web lama → buka di web baru → field benar.

## Field finance (detail klaim)

Akan dilengkapi daftar kolom exact setelah export kolom `claims` (pemilik / query lanjutan). Jangan menebak nama kolom di PR tanpa cek schema.
