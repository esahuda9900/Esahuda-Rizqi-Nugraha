# RUNBOOK — operasi aman

## Backup manual (Fase 0 / darurat)

1. Supabase Dashboard → Table Editor / SQL → export CSV per tabel penting, **atau**
2. Web baru (setelah Fase 3 merge): **Export / Backup** → Download backup JSON (role `admin`).
3. Simpan file di luar Supabase (drive privat / disk lokal). Nama file berisi tanggal.

Tabel prioritas: `claims`, `claim_status_history`, `machines`, `customers`, `branches`, `dealers`, `parts_master`, `app_user_roles`.

## Restore (Milestone 1 — manual saja)

Restore otomatis **tidak** ada di M1 (PLAN v2.1). Jika data rusak:

1. Stop input di web baru & web lama bila perlu.
2. Ambil backup JSON/CSV terakhir yang valid.
3. Import lewat Supabase SQL / Table Editor di **staging** dulu; verifikasi count.
4. Baru production, dengan SQL yang ditulis eksplisit dan di-review.

## Weekly GitHub Action

File: `.github/workflows/weekly-db-backup.yml` (skeleton).
Aktifkan hanya jika:

- Repo backup **privat**, atau artifact encrypted
- Secrets: `SUPABASE_URL` + key server-side (bukan di `apps/web`)
- Cron di-uncomment setelah uji `workflow_dispatch`

## Rollback RLS

Simpan SQL disable/recreate policy sebelum mengubah production RLS (PLAN 0.3). Jangan aktifkan policy baru tanpa uji staging + web lama.
