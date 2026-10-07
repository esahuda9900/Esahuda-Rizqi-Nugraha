# SDLG Frontend Injector Roadmap

Last updated: **2026-10-02** (expert audit — synced with live `scripts/build-production.js`)

## Goal
Reduce regression risk from `scripts/apply-*.js` while keeping production behavior stable.
Database / RLS / SECURITY DEFINER RPCs are **out of scope** here — they are already the system of record.

## Freeze rule (locked)
- Do **not** add new injectors for routine fixes.
- Prefer `modules/*.js` edits.
- `apply-zero-display-fix.js` stays **out** of `build-production.js` (enforced by `verify-source-lock.js`).
- Progressive modules (Tracking UX, Assessment UX, Input Helper, Unmatched WO, Machine 360) are loaded at runtime by `modules/navigation-state.js` — they do not need injectors.

## Production proof (2026-10-02)
Live Cloudflare HTML contains:
- `modules/sdlg-core.js`
- `modules/navigation-state.js` (progressive loader)
- `modules/wo-claim-policy.js` (v1.4.1)
- `modules/master-resolution-ux.js`
- core operational modules (command-center, boss-analytics, payment/rebalancing evidence, etc.)
- `styles/sdlg-modern-refresh.css` + ops/responsive/polish CSS

`modules/sdlg-core.js` owns 968F→L968F aliases and USD-placeholder currency rules.
`apply-externalize-sdlg-core.js` guards identity helpers and delegates currency to the module.

## Active chain (order matters)

Source of truth: `scripts/build-production.js` (as of 2026-10-02).

| # | Script | Role | Status |
|---|--------|------|--------|
| 1 | `apply-ui-redesign.js` | Legacy UI structure | Active |
| 2 | `apply-responsive-ui.js` | Responsive layout | Active |
| 3 | `apply-parts-parser-fix.js` | Parser correctness | Active — high value extract |
| 4 | `apply-safe-part-matching.js` | Part match safety | Active — extract with parser |
| 5 | `apply-allow-zero-part-qty.js` | Qty edge case | Active |
| 6 | `apply-wo-save-fallback.js` | WO save path | Active |
| 7 | `apply-export-table-helper.js` | Export helper inject | Active — module exists |
| 8 | `apply-externalize-sdlg-core.js` | Wire module + fallback guards | **Keep** |
| 9 | `apply-master-resolution-ux.js` | Master UX helpers | Active |
| 10 | `apply-master-model-source-lock.js` | SOURCE LOCK | Active — **highest value extract** |
| 11 | `apply-warranty-helper-canonical.js` | Warranty UI bridge | Active |
| 12 | `apply-feedback-person-from-claim.js` | Feedback Person from claim | Active |
| 13 | `repair-feedback-person-render.js` | Feedback Person render repair | Active |
| 14 | `apply-boss-analytics-dashboard.js` | Boss analytics wiring | Active |
| 15 | `apply-perf-progressive-claims.js` | Progressive claims perf | Active |
| 16 | `apply-helper-cache-bust.js` | Helper cache bust | Active |
| 17 | `apply-nav-detail-restore.js` | Nav detail restore | Active |
| 18 | `apply-inline-claim-restore.js` | Inline claim restore | Active |
| 19 | `apply-nav-state-cache-bust.js` | Nav state cache bust | Active |
| 20 | `apply-modern-refresh.js` | Final CSS cascade | **Keep last** |

## Safe removal / extraction order (remaining)

1. ~~Prove externalize live~~ **Done**.
2. ~~Drop 968F + currency injectors~~ **Done 2026-09-18**.
3. **Next priority**: Extract SOURCE LOCK (`apply-master-model-source-lock.js`) + parser blocks (`apply-parts-parser-fix.js`, `apply-safe-part-matching.js`) into dedicated modules. Then shrink or remove those injectors after production proof.
4. Never remove `apply-externalize-sdlg-core.js` or `apply-modern-refresh.js` until `index.html` is a thin shell.

## Progressive modules (no injector needed)
These are loaded dynamically by `modules/navigation-state.js` based on page context:
- `modules/warranty-tracking-ux.js`
- `modules/warranty-assessment-ux.js`
- `modules/sdlg-input-helper-ux.js`
- `modules/unmatched-wo-queue.js`
- `modules/machine-360.js`
- `modules/policy-runtime-fix.js`
- `modules/ops-clean-ui.js`
- `modules/self-signup.js`
- `modules/warranty-helper-fastpath.js`

## Not in active chain (do not re-wire)
- `apply-zero-display-fix.js`
- `apply-mobile-hardfix.js`, `mobile-hardfix-v2.js`
- `apply-canonical-model-968f-alias.js` (history only)
- `apply-currency-usd-placeholder-fix.js` (history only)
- One-off `fix-*.js` / Python repair scripts

## Definition of done for “injector fixed”
- Production smoke passes on **Cloudflare**
- `verify-source-lock.js` / parser / warranty contracts pass
- No silent change to warranty RPC results or claim write path
- Progressive modules continue to load correctly via navigation-state

## Expert note (2026-10-02)
Full system audit confirmed **zero critical production bugs**. Injector debt remains the primary long-term risk. Prefer smallest extractions with regression evidence over large rewrites.
