# Runbook Darurat SDLG Warranty (1 halaman)

## Saat aplikasi rusak di production

### 1) Cek cepat (2 menit)
1. Buka https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/
2. F12 → Console: ada 404 `/modules/`? ada `Multiple GoTrueClient`?
3. Network → filter `claims` → status 200 + body array?
4. Console: `await window.SDLGDataPipeline.runDiagnostics()`

### 2) Rollback ke backup stabil
```bash
git fetch origin
git checkout main
git reset --hard origin/backup/stable-2026-10-09-portal-ok
git push origin main --force
```
Tunggu Actions **Deploy static content to Pages** hijau → hard refresh (`Ctrl+Shift+R`).

### 3) Deploy patch gagal?
Pastikan workflow `static.yml` masih menjalankan:
```bash
python3 scripts/pages_prepare_index.py
```
File kritis: `scripts/pages_prepare_index.py`, `modules/supabase-client.js`, `canonical-warranty-helper.js`.

### 4) Data kosong tapi Supabase OK
- Banner hijau "Supabase OK" + UI 0 → masalah React `user` / `loadClaims`.
- Clear session: `localStorage.removeItem('sb-frqvelcreczmnofldrga-auth-token')` → login ulang.

### 5) Kontak / akses
- Repo: https://github.com/esahuda9900/Esahuda-Rizqi-Nugraha
- Branch backup: `backup/stable-2026-10-09-portal-ok`
- Supabase project: `frqvelcreczmnofldrga`
- Host: GitHub Pages + Cloudflare (sync keduanya setelah push)

### 6) Jangan dilakukan saat darurat
- Jangan force-push branch lain tanpa backup
- Jangan edit `index.html` 3MB langsung tanpa hard refresh test
- Jangan hapus `pages_prepare_index.py` sampai source 100% = production
