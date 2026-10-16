# DECISIONS.md

Keputusan penting (apa / kenapa / tanggal). Setiap sesi AI wajib baca.

---

## 2026-10-16 — PLAN v2.1 diadopsi sebagai rencana resmi

**Apa:** Rencana rombak frontend mengikuti PLAN v2.1 pemilik (Fase 0 → M1 → M2 → cutover M3).
**Kenapa:** Web lama tetap production; web baru harus setara operasional dulu; cutover dilarang sampai stabil.
**Implikasi:** Satu PR = satu tugas; Fase 1 read-only boleh setelah Fase 0 minimum.

---

## 2026-10-16 — Role disimpan di database (`app_user_roles`), bukan hanya di frontend

**Apa:** Role user ada di tabel `public.app_user_roles`.
**Temuan data (production inventaris):**
| user (display) | role |
|---|---|
| esahuda9900@gmail.com | `admin` |
| tes123@gmail.com | `warranty_admin` |
| read123@gmail.com | `viewer` |

**Kenapa penting:** RLS sudah mengunci write claims ke admin path (`claims_insert_by_admin`, `claims_update_by_admin`). Role **sudah di DB** — tidak perlu "memindah role dari frontend ke DB" sebagai prasyarat darurat.
**Implikasi:** Matriks capability per role (0.4) masih harus diisi pemilik (apa yang boleh `warranty_admin` vs `viewer` vs `admin`).

---

## 2026-10-16 — RLS sudah aktif di SEMUA tabel public

**Apa:** Inventaris: 34 tabel `public` semuanya `rowsecurity = true`.
**Kenapa penting:** PLAN 0.3 (strategi RLS baru) — **jangan ubah policy production** tanpa staging + uji web lama. Banyak policy SELECT untuk `authenticated`; write master/claims cenderung admin.
**Implikasi:** Fase 1–2 read-only memakai policy yang sudah ada. Jangan redesign RLS di M1 kecuali pemilik minta.

---

## 2026-10-16 — Write klaim sebaiknya lewat RPC yang sudah ada, bukan insert mentah

**Apa:** DB punya antara lain:
- `create_sdlg_claim` / `update_sdlg_claim` / `delete_sdlg_claim`
- `update_claim_status` / `update_claim_status_atomic` / `update_claim_status_batch`
- `next_sdlg_claim_id`
- `resolve_sdlg_claim_context`, `sdlg_warranty_resolve_claim`, `get_machine_360`, `search_warranty_master`

**Trigger di `claims`:** audit, guard status transition, auto-advance workflow, parts canonical, initial history.
**Kenapa:** Frontend baru **tidak boleh** melewati guard/audit. Fase 4 simpan/status harus memanggil RPC yang sama dengan web lama bila memungkinkan.
**Implikasi:** Jangan invent fungsi baru di Fase 1–2 (read-only).

---

## 2026-10-16 — Preview web baru di `/preview/`; production root = web lama

**Apa:** GitHub Pages root tetap monolith; Vite app di `/Esahuda-Rizqi-Nugraha/preview/`.
**Kenapa:** Isolasi risiko; cutover OFF.

---

## 2026-10-16 — Tidak ada evidence foto di Storage untuk M1

**Apa:** Pemilik: tidak ada foto/file evidence; jangan pakai Supabase Storage untuk itu di M1.
