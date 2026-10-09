# Runbook Darurat SDLG Warranty (1 halaman)

## Saat aplikasi rusak di production

### 1) Cek cepat (2 menit)
1. Buka https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/
2. F12 → Console: ada 404 `/modules/`? ada `Multiple GoTrueClient`?
3. Network → filter `claims` → status 200 + body array?
4. Console:
   ```js
   await window.SDLGDataPipeline.runDiagnostics()
   window.SDLGWoClaimPolicy?.version
   window.SDLGWoCollisionModal?.version
   ```

### 2) Rollback ke backup stabil (paling lengkap)
```bash
git fetch origin
git checkout main
git reset --hard origin/backup/stable-2026-10-09-parse-diff
git push origin main --force
```
Tunggu Actions **Deploy static content to Pages** hijau → hard refresh (`Ctrl+Shift+R`).

Cadangan lebih lama:
- `backup/stable-2026-10-09-baked-source`
- `backup/stable-2026-10-09-portal-ok`

### 3) Deploy patch gagal?
Pastikan workflow `static.yml` masih menjalankan:
```bash
python3 scripts/pages_prepare_index.py
```
File kritis:
- `scripts/pages_prepare_index.py`
- `modules/supabase-client.js`
- `modules/wo-claim-policy.js` / `wo-collision-modal.js`
- `modules/sdlg-portal-finance-ux.js`
- `canonical-warranty-helper.js`

### 4) Data kosong tapi Supabase OK
- Banner hijau "Supabase OK" + UI 0 → React `user` / `loadClaims`.
- Clear session: `localStorage.removeItem('sb-frqvelcreczmnofldrga-auth-token')` → login ulang.

### 5) Kontak / akses
- Repo: https://github.com/esahuda9900/Esahuda-Rizqi-Nugraha
- Supabase: `frqvelcreczmnofldrga`
- **Host production (sole):** https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/
- Cloudflare Workers: **retired** — jangan pakai `*.workers.dev`

### 6) Jangan dilakukan saat darurat
- Jangan force-push tanpa backup branch di atas
- Jangan redeploy Cloudflare Workers (path sudah diarsipkan)
