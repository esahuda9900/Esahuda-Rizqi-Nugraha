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
| `sdlg-dashboard-polish.css` | dashboard metrics |
| `sdlg-claims-ui-fix.css` | **Claims tab** (KPI + rows) |
| `fonts/` | IBM Plex |

## Archive

Unused layers live in `_archive/` (not deployed). Do not add new `*-vN.css` layers — edit an active file instead.

## Rules

1. Visual only — no business/RPC changes.
2. Claims list/detail: prefer `sdlg-claims-ui-fix.css`.
3. Cache-bust with `?v=` when changing critical CSS.
