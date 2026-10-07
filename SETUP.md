# SDLG Warranty Claim — Free Resilience Kit

Tujuan kit ini: membuat backup database SDLG secara otomatis tanpa biaya menggunakan GitHub Actions Free.

## 1. Buat repository GitHub PRIVATE

Simpan workflow ini di repository private. Jangan taruh dump database di commit Git.

GitHub Free menyediakan 2.000 menit/bulan untuk standard GitHub-hosted runners pada akun Free; workflow backup ini dirancang singkat dan hanya berjalan sekali sehari. Public repositories tidak memakai kuota menit standard runner, tetapi private repo lebih aman untuk data warranty/customer. 

## 2. Copy folder `.github/workflows`

Salin file:

`.github/workflows/sdlg-supabase-backup.yml`

ke repository.

## 3. Buat repository secrets

Di GitHub:
Settings → Secrets and variables → Actions → New repository secret

Buat:

- `SUPABASE_DB_URL` = connection string database Supabase dari Dashboard → Connect.
- `SUPABASE_PROJECT_REF` = `frqvelcreczmnofldrga`

Jangan taruh database password langsung di YAML.

## 4. Jalankan pertama kali manual

Actions → SDLG Supabase Free Backup → Run workflow.

Pastikan job sukses.

## 5. Jadwal otomatis

Workflow berjalan sekitar 08:17 WIB setiap hari karena jadwal GitHub menggunakan UTC.

Backup disimpan sebagai GitHub Actions artifact selama 14 hari.

## 6. Apa yang dibackup?

- public schema: tabel, function, policy, trigger, index, dan struktur public.
- public data: data claims, master, audit, history, settings, roles mapping, dll.
- custom database roles.
- checksum file.

Catatan: `supabase db dump` sengaja tidak membackup schema managed seperti `auth` dan `storage`. Karena itu recovery Auth user tetap membutuhkan pembuatan ulang akun Supabase Auth bila project benar-benar hilang. Database password/JWT secrets juga tidak ikut masuk backup.

## 7. Recovery

Buat project Supabase baru, pulihkan schema public terlebih dahulu, lalu data public, lalu role yang diperlukan sesuai dokumentasi Supabase. Setelah itu buat ulang user Auth dan `app_user_roles`.

Jangan menjalankan restore ke production aktif tanpa verifikasi file backup dan project tujuan.
