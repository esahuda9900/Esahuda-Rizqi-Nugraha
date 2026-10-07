# Styles — SDLG Warranty

## Target (north star)

Exactly **3** entry CSS files:

| File | Owns |
|------|------|
| `core.css` | reset, design tokens, base type |
| `components.css` | card, button, table, badge, tracking, claim chrome |
| `responsive.css` | media queries only |

## Current

Multiple layered files (`sdlg-*-vN.css`). Prefer **editing one existing file** over adding a new design system.

## Rules

1. CSS is visual only — no workflow/RPC changes.
2. Scope claim-detail overrides to `.page.claim-detail-page`.
3. Cache-bust via `?v=` when behavior-critical modules inject stylesheets.
4. Merge path: stop new layers → consolidate pairs → land on 3 files.

## Active claim-detail polish

- `sdlg-claim-detail-clean-v2.css` (v2.2+)
- `sdlg-warranty-tracking-v1.css`
