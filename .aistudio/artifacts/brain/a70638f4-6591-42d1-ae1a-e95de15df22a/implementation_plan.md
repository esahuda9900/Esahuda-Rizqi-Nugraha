# Rencana Perbaikan: Stabilitas Sesi & Pemulihan Tab Navigasi Web Production

Rencana perbaikan komprehensif untuk mengatasi masalah *tab freeze/loading berulang* saat berpindah tab di Google Chrome, serta mencegah hilangnya konteks detail klaim yang sebelumnya ter-reset ke halaman Overview.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan klarifikasi yang telah dikonfirmasi, berikut adalah keputusan arsitektur utama untuk implementasi:

* **Pemuatan Data saat Tab Chrome Aktif Kembali**: **Gunakan cache memori dan hindari reload jika user ID sama**. Sesi background check dari Supabase tidak akan memicu refetch 564+ klaim secara berulang jika data sudah ada di memori dan identitas user tidak berubah.
* **Strategi Pemulihan Tab & Detail Klaim**: **Prioritaskan URL hash dengan fallback localStorage dan skeleton loader**. Jika URL memuat ID klaim, detail view akan langsung ditampilkan (dengan skeleton jika koleksi klaim sedang hidrasi). Jika hash URL kosong saat tab pulih, sistem mengambil snapshot terakhir dari `localStorage`.
* **Penanganan Role Pengguna**: **Pertahankan role aktif saat verifikasi sesi berjalan**. Sistem tidak akan mereset role ke `"viewer"` sementara waktu saat background verification berlangsung, sehingga akses `"admin"` / `"warranty_admin"` tidak terputus dan tidak melempar navigasi.
* **Preserve Hash saat Redirect**: Di `index.html`, fungsi pengalihan `goApp()` akan selalu membawa serta `window.location.hash` agar rute detail klaim tidak terpotong saat browser me-refresh URL root.

---

## 1. Overview & Core Concept

* **Tujuan**: Memastikan pengguna internal PT. Indo Traktor Utama dapat berpindah antar-tab di Google Chrome tanpa mengalami loading ulang berulang kali, dan ketika membuka kembali tab SDLG Warranty, posisi halaman (termasuk klaim detail yang sedang dibuka) tetap persis seperti semula.
* **Target Pengguna**: Warranty Admin, Branch User, dan Management Viewer yang bekerja secara multitasking di browser dengan banyak tab.
* **Nilai Utama**: Menghilangkan interupsi kerja, menghemat bandwidth jaringan ke database Supabase, dan mencegah hilangnya draft/konteks klaim yang sedang ditinjau.

---

## 2. User Experience & Visual Design

* **Alur Pengguna saat Kembali ke Tab Chrome**:
  1. Pengguna membuka tab SDLG Warranty setelah berpindah dari aplikasi/tab lain.
  2. Tab langsung siap dipakai seketika (*instant resume* tanpa loading spinner/card yang menutupi layar).
  3. Verifikasi token Supabase terjadi secara senyap di background tanpa mengganggu interaksi UI.
* **Alur Pengguna saat Refresh / Pemulihan Tab Discarded**:
  1. Chrome memulihkan tab yang sempat di-discard karena penghematan memori.
  2. Rute URL hash (misal `#/claims/2026-0001-SDLG-PFR`) langsung dibaca.
  3. Layar Klaim Detail langsung menampilkan kerangka (*skeleton preview*) nomor klaim dan tombol kembali, lalu mengisikan data lengkap begitu koleksi klaim selesai dihidrasi, tanpa pernah melompat ke Overview.
* **Feedback Visual**:
  * Tidak ada flicker pergantian role (status badge di topbar tetap stabil).
  * Tombol navigasi aktif tetap menunjuk ke tab yang sedang dilihat pengguna.

---

## 3. Key Product Decisions & Trade-Offs

### Keputusan 1: Isolasi Event Supabase `onAuthStateChange`
* **Pendekatan yang Dipilih**: Mengabaikan event redundant (`SIGNED_IN`, `INITIAL_SESSION`, `TOKEN_REFRESHED`) jika `session.user.id === current.user.id`.
* **Alasan**: Mencegah pemanggilan `loadClaims()` yang tidak perlu setiap kali window focus atau visibility change terpicu.
* **Alternatif yang Ditolak**: Menonaktifkan auto-refresh token (berisiko menyebabkan query gagal saat token kadaluarsa).

### Keputusan 2: Dual-Restore & Skeleton Loading pada Claim Detail
* **Pendekatan yang Dipilih**: Rute `# /claims/:id` menjadi otoritas utama. Jika state `claims` belum selesai dimuat, tampilkan *claim detail skeleton* berdasarkan `detailId`, bukan membatalkan tampilan detail.
* **Alasan**: Baris kode `tab === "list" && detailId && detail` sebelumnya membuat tampilan lenyap ketika `detail` belum ditemukan di array `claims`, yang memicu script bridge DOM menyimpulkan hash tidak valid lalu mengklik Overview.
* **Alternatif yang Ditolak**: Mengunci navigasi sampai fetch 564 klaim selesai (membuat web terasa lambat dan beku).

### Keputusan 3: Penataan Ulang Fallback Default `sdlg-hash-tab-bridge.js`
* **Pendekatan yang Dipilih**: Jika URL hash kosong atau belum diisi, bridge tidak boleh langsung menyimulasikan klik otomatis ke Overview jika ada state tersimpan di `localStorage` atau jika React sedang dalam proses inisialisasi.
* **Alasan**: Otomatisasi klik DOM pada tab "Overview" merupakan penyebab langsung tab pengguna berubah secara tiba-tiba.

---

## 4. Technical Architecture & Data Strategy

### Diagram Alur Siklus Hidup Sesi & Navigasi

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Google Chrome Browser                           │
│  [Pindah Tab / Minimize] ──► [Tab Kembali Aktif / Window Focus]        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Supabase Auth Event Interceptor                    │
│  • Event: SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION                │
│  • Cek: Apakah user.id sama dengan user sebelumnya?                    │
│     ├── YA  ──► Update token diam-diam; PERTAHANKAN role & state UI    │
│     └── TIDAK ──► Baru jalankan profil & load ulang data               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Dual-Restore Navigation Engine                       │
│                                                                        │
│   Hash URL (#/claims/0258-2026-SDLG-PFR)                               │
│       │                                                                │
│       ├── Ada Hash Detail? ──► Render Detail View                      │
│       │                        (Gunakan Skeleton jika claims [])       │
│       │                                                                │
│       └── Hash Kosong?     ──► Baca localStorage                       │
│                                (Jangan auto-klik tombol Overview!)     │
└────────────────────────────────────────────────────────────────────────┘
```

### Rencana Komponen & Modul yang Akan Dimodifikasi:

1. **`app.html`**:
   * *Auth Listener (`onAuthStateChange`)*: Tambahkan pengecekan identitas user (`session?.user?.id === user?.id`). Jangan panggil `setUserRole("viewer")` jika user sudah terautentikasi sebelumnya.
   * *Pencegahan Refetch Berulang (`loadClaims`)*: Hindari `setLoading(true)` penuh jika data `claims` sudah terisi di memori dan pemanggilan hanya berasal dari event resume tab.
   * *Claim Detail Loading Guard*: Di bagian render detail klaim (`tab === "list" && detailId`), sediakan fallback loading skeleton jika `!detail && loading`, sehingga tampilan detail tidak hilang saat rehidrasi.

2. **`modules/navigation-state.js`**:
   * Perbarui `restoreDetailId()` agar memeriksa `readState(user).detailId` dari `localStorage` jika hash URL sedang tidak tersedia atau terlepas saat navigasi transien.

3. **`modules/sdlg-hash-tab-bridge.js`**:
   * Hapus perilaku agresif yang mengasumsikan hash kosong (`!h`) sebagai perintah wajib untuk mengklik tab Overview (`dashboard`). Jika hash kosong, biarkan React menentukan state restorasi default tanpa intervensi klik DOM paksa.

4. **`index.html`**:
   * Di fungsi `goApp()`, teruskan `window.location.hash` ke URL tujuan (`./app.html?v=...` + `window.location.hash`) agar jika pengguna me-refresh URL di root domain, rute klaim tidak hilang.

---

## Verification Plan

### Automated Verification
* Jalankan `npm run verify` untuk memastikan semua 10 kontrak regresi navigasi, verifikasi klaim, dan arsitektur tetap lolos (100% green).
* Jalankan `compile_applet` dan `lint_applet` bersamaan untuk memastikan sintaks dan build tetap valid.

### Manual Verification Scenarios
1. **Skenario Pindah Tab Chrome**:
   * Buka aplikasi, masuk ke menu *Claims* dan buka salah satu klaim detail.
   * Buka tab browser lain di Chrome, buka website lain (misal YouTube/Google Docs) selama 1-2 menit.
   * Kembali ke tab SDLG Warranty.
   * *Ekspektasi*: Tab tetap berada di detail klaim yang sama, tidak muncul spinner loading yang mengunci layar, dan role admin tetap aktif.
2. **Skenario Hard Refresh pada Detail Klaim**:
   * Saat berada di URL `# /claims/2026-xxxx-SDLG-PFR`, tekan tombol Refresh (F5 / Ctrl+R).
   * *Ekspektasi*: Halaman tetap membuka klaim yang sama, tidak terlempar ke Overview.
3. **Skenario Tab Restore & Memory Saver**:
   * Buka URL aplikasi di root dengan hash klaim.
   * Pastikan redirect membawanya langsung ke klaim tersebut di `app.html`.
