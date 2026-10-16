# AGENTS.md — Aturan untuk AI / programmer

Baca file ini + `DECISIONS.md` + `docs/CUTOVER-POLICY.md` + `docs/PLAN-rombak-web-sdlg-v2.1.md` sebelum menulis kode.

## Ringkasan proyek
- **Web lama (production):** `index.html` monolith + `modules/*` — **JANGAN SENTUH**.
- **Web baru:** `apps/web` (React + TS + TanStack Query + React Router), preview di GitHub Pages `/preview/`.
- **Backend:** Supabase project yang sama (`frqvelcreczmnofldrga`). Hanya frontend yang dirombak.
- **Data:** ~500+ klaim. Tidak ada foto evidence di Storage — jangan pakai Storage untuk evidence.
- **Target:** perilaku fitur setara pekerjaan harian; bukan copy arsitektur monolith.

## CUTOVER — LARANGAN KERAS

**Dilarang cutover production ke web baru kecuali pemilik bilang eksplisit.**

- Production = web lama di root (`/`).
- Web baru **hanya** `/preview/`.
- Jangan ganti `index.html` production dengan build Vite.
- Jangan ubah deploy agar SPA jadi site root.
- Jangan archive / hapus `modules/*` “supaya bersih”.
- Perintah biasa (*deploy, ship, merge, fix production*) **bukan** izin cutover.
- Izin valid hanya kalimat jelas dari pemilik, contoh: **`AUTHORIZE CUTOVER`**.

Detail: **`docs/CUTOVER-POLICY.md`**. CI akan gagal jika artifact Pages menaruh SPA di root.

## Aturan main (WAJIB)
1. Jangan sentuh web lama (`index.html`, `modules/*`) kecuali pemilik minta perbaikan bug legasi spesifik.
2. Jangan ubah schema DB (kolom/tabel/policy/function/trigger) tanpa izin tertulis pemilik. Tulis SQL → pemilik jalankan di staging dulu.
3. Jangan pernah menaruh **service_role** key di frontend, repo, atau env yang ikut ter-build. Hanya **anon** key di frontend.
4. Fitur yang menulis data dites di **staging** dulu, bukan production.
5. Satu tugas = satu PR kecil. Selesai → dicek pemilik → baru lanjut.
6. Dilarang `window.*` global, interval hydrator, atau manipulasi DOM langsung di `apps/web`. State React + TanStack Query. Satu sumber data per klaim, kunci `claim_id`.
7. Uang: jangan float naif untuk total kritis — pakai bilangan bulat (cents) atau library desimal.
8. Tanggal: tampil **DD/MM/YYYY**, simpan ISO, zona **WIB**.
9. Role dijaga di database (RLS). Menyembunyikan tombol di UI bukan keamanan.
10. Data yang ditulis web baru harus tetap benar dibaca web lama (dan sebaliknya).
11. Jangan "memperbaiki" di luar tugas. Bug lain dicatat di `docs/BUGS.md`.
12. Jangan menimpa data yang ada dengan nilai kosong.
13. Sebelum bilang selesai: checklist uji + tulis hasil di PR.
14. Kalau tidak jelas, **tanya**. Jangan menebak.
15. **Jangan cutover** (lihat bagian CUTOVER di atas).

## Prioritas fitur (pemilik)
1. Monitoring + detail klaim
2. Parse paste + update status
3. Helper copas ke form SDLG
4. Admin Center (lihat/edit/export/import lewat web)

## Struktur kode disarankan
```
apps/web/src/
  domain/     # pure: parser, money, woPolicy, warrantyRules (+ tests)
  data/       # Supabase + TanStack Query
  features/   # claims, detail, parse, sdlg-helper, admin
  components/
  lib/
docs/
  CUTOVER-POLICY.md  DATA-CONTRACT.md  RUNBOOK.md  BUGS.md  DECISIONS.md
AGENTS.md
```

## Definition of Done (per PR)
- [ ] Hanya lingkup tugas
- [ ] CI hijau (typecheck / test)
- [ ] Loading / error / empty state
- [ ] Hasil uji di PR
- [ ] Tidak ada cutover / tidak mengubah production root
- [ ] Web lama di `/` tetap utuh
