# Styles — SDLG Warranty (production)

## Active (linked from app.html)

| File | Role |
|------|------|
| `sdlg-design-tokens.css` | tokens |
| `sdlg-base.css` | base |
| `sdlg-components.css` | buttons, cards, inputs |
| `sdlg-modern-refresh.css` | layout shell |
| `sdlg-responsive.css` | breakpoints |
| `sdlg-ops-clean-v1.css` | flat/no-lift |
| `sdlg-ux-polish-v3.css` | polish |
| `sdlg-dashboard-polish.css` | **dashboard declutter** (KPI flat + Action soft) |
| `sdlg-claims-ui-fix.css` | **Claims tab** (KPI + rows) |
| `fonts/` | IBM Plex |

## Archive

Unused layers live in `_archive/` (not deployed). Do not add new `*-vN.css` layers — edit an active file instead.

## Rules

1. Visual only — no business/RPC changes.
2. Claims list/detail: prefer `sdlg-claims-ui-fix.css`.
3. Cache-bust with `?v=` when changing critical CSS.
4. Declutter rule: **kalau spasi sudah memisahkan elemen, border garis tidak perlu.**

## Theme

**Light only.** Dark theme removed 2026-10-30 (OS preference ignored). Theme switcher deleted.

## Declutter log

- 2026-10-30 V6.3: KPI metric-card → transparent (no nested boxes). My Action Today P0/P1/P2 → soft bg only, border removed.
