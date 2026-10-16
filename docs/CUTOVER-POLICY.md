# Cutover Policy — Production Web Lama

**Owner-only decision. Default = NO CUTOVER.**

## Status

| Environment | URL | Status |
|-------------|-----|--------|
| Production (web lama) | `/` → `index.html` + `modules/*` | **ACTIVE — do not replace** |
| Preview (web baru) | `/preview/` → `apps/web` Vite SPA | Parallel only |

Milestone 3 (cutover) is **FORBIDDEN** until the repository owner (`esahuda9900`) explicitly orders it in chat / PR / issue with clear wording such as:

> **AUTHORIZE CUTOVER** — ganti production root ke apps/web

Anything weaker (“deploy”, “ship”, “merge”, “fix production”) does **not** authorize cutover.

## Rules for AI agents & junior programmers

1. **Never** replace production root (`_site/index.html`, repo root `index.html`) with the Vite SPA build.
2. **Never** change `VITE_BASE` so the SPA is served from `/` instead of `/preview/`.
3. **Never** delete, rename, or “archive” `index.html` / `modules/*` as part of a feature PR.
4. **Never** point GitHub Pages / Netlify / Cloudflare primary domain only at `apps/web/dist`.
5. Preview work stays under `apps/web` + deploy path `/preview/` only.
6. If asked to “make the new web the main site” without the authorize phrase → **refuse** and point here.

## CI enforcement

- `static.yml` asserts after build:
  - `_site/index.html` still looks like the **legacy** app (not a pure SPA shell that only loads `/preview/assets/…` as the sole app).
  - SPA output exists only under `_site/preview/`.
  - Copying `apps/web/dist` over `_site/` root fails the job.
- `architecture-guard.yml` fails if a workflow on `push` to `main` tries to publish SPA to site root.

## How cutover will work (future, owner-gated)

Only after explicit **AUTHORIZE CUTOVER**:

1. Owner opens a dedicated PR titled `CUTOVER: production → apps/web`.
2. Checklist: parse parity signed off, smoke claims list/detail/parse/save, rollback plan.
3. Workflow requires repository variable / secret `OWNER_CUTOVER=1` set by owner for that run only.
4. After success, document in `DECISIONS.md` and reset `OWNER_CUTOVER`.

Until then: **web lama stays production.**
