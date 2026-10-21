# Legacy Form Writers Map — SDLG Input Page

**Created:** 2026-10-21  
**Purpose:** Fase 0 deliverable. Document every writer that can mutate portal form fields before any are disabled.  
**Source of truth branch at time of writing:** `main` @ `e2bd530ea19ceb99fcd69e51265d22efa8ad8dca`

---

## 1. How the page is loaded (current main)

`modules/claim-fields.js` is the minimal loader. On main it currently loads:

| Script | Version param | Role |
|--------|---------------|------|
| `sdlg-input-hydrate.js` | v13 | **Aggressive writer** (500ms interval) |
| `sdlg-inline-enforcer.js` | v3 | **Aggressive writer** (600ms interval) |
| `sdlg-hash-router.js` | v221 | Routing |
| `sdlg-hash-tab-bridge.js` | v23 | Tab bridge |
| `sdlg-input-claim-sync.js` | v11 | Claim sync |
| `sdlg-portal-finance-ux.js` | v53 | Finance calculations |
| `sdlg-portal-ux-v2.js` | v24 | UX helpers |
| `sdlg-route-finish.js` | v15 | Route finish |
| `sdlg-ui-consolidate.js` | v1 | UI consolidate |
| `sdlg-ui-polish-v3.js` | v33 | Polish |
| `sdlg-auth-route-guard.js` | v13 | Auth guard |
| `sdlg-overview-session-gate.js` | v12 | Overview gate |
| `sdlg-overview-ux.js` | v11 | Overview UX |

Plus root-level `canonical-warranty-helper.js`.

---

## 2. Competing Writers (Ranked by danger)

### A. HIGH RISK — Timer-based / continuous writers

#### 1. `modules/sdlg-input-hydrate.js` (v1.3 on main)
- **Trigger:** `setInterval(..., 500)` + multiple `setTimeout` on load + hashchange / sdlg-route / sdlg-input-claim / change on select
- **What it writes:** Almost every portal field (`sdlg_repairDate`, `sdlg_machineLocation`, `sdlg_serialNumber`, `sdlg_hourMeter`, `sdlg_complaint`, `sdlg_faultDetails`, report body via `[data-sdlg-report-body]`, etc.)
- **Source of data:** `window.__SDLG_LIVE_CLAIM__` + live Supabase fetch by hash claim_id
- **Known behaviour:** Nuclear enforcer for repair date. Can re-apply previous claim data while a new claim is loading.
- **PR status:** PR #2 and #3 both try to turn the polling loop off / make it event-driven only.

#### 2. `modules/sdlg-inline-enforcer.js` (v3 on main)
- **Trigger:** `setInterval(tick, 600)` + several setTimeouts
- **What it writes:** report body, repair date, machine location, serial, HM, complaint, fault details, labour/mileage amounts, total
- **Source of data:** `window.__SDLG_LIVE_CLAIM__`
- **Behaviour:** Detects "drift" then force-writes. Can fight with React and with hydrate.
- **PR status:** PR #2 disables it completely (turns file into a no-op compatibility stub). PR #3 stops loading it from `claim-fields.js`.

### B. MEDIUM RISK — Async / event writers that can race

#### 3. React component inside baked `index.html` (`SDLGPortalInputPage`)
- **Trigger:** React state (`selectedClaim` / live fetch)
- **What it owns (intended):** report body, repair date, machine location (and other form fields)
- **Problem on main:** Still competes with the two interval writers above. When user switches claim quickly, React may render new claim while hydrate/enforcer still hold old `__SDLG_LIVE_CLAIM__`.

#### 4. `canonical-warranty-helper.js` (root)
- **Trigger:** hashchange + delayed schedule
- **Current protection:** Has `isPortalInputPage()` check and respects `__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__` (set by hydrate). On portal input page it largely bails out.
- **Risk:** Lower than the two interval writers, but still present if flags are missing.

#### 5. `modules/sdlg-portal-enrich.js`
- **Trigger:** boot + timers
- **What it writes:** Date of repair report, Machine Location, Feedback Person, report name
- **PR #3 improvement:** Adds claim-id guard before writing.

#### 6. `modules/sdlg-policy-repair-hardfix.js` + `sdlg-policy-table-fill.js` + `sdlg-portal-enrich.js` (loaded via `master-resolution-ux.js`)
- Can write repair date / policy-related fields.
- PR #3 adds claim-id consistency checks.

#### 7. `modules/sdlg-portal-finance-ux.js`
- Writes labour amount, mileage amount, total (derived).
- PR #3 adds `verifiedLiveClaim()` guard so it only acts on matching claim_id.

### C. LOW RISK / Supporting

- `sdlg-input-claim-sync.js`, hash router, tab bridge — mainly routing / selection, not heavy field writers.
- Finance recompute is acceptable if it only runs after the correct claim is confirmed.

---

## 3. Shared global state that causes contamination

| Global | Set by | Read by | Risk |
|--------|--------|---------|------|
| `window.__SDLG_LIVE_CLAIM__` | hydrate (mainly) | enforcer, finance, others | Stale claim object kept after navigation |
| `window.SDLGInputHydrate` | hydrate module | enforcer, claim-lock | Can be called with old claim |
| Hash route / select value | user + router | all writers | Must be the single source of desired claim_id |

**Root rule we must enforce:**  
`selectedClaimId` (from route/select) → fetch exact row → only that row may write fields.  
Never fall back to list cache or previous `__SDLG_LIVE_CLAIM__`.

---

## 4. What PR #2 and PR #3 already do

### PR #2 (`fix/sdlg-input-single-source-2026-10-12`)
- Turns inline-enforcer into disabled stub.
- Rewrites hydrate to be event-driven (no 500ms nuclear loop for general fields).
- React becomes sole writer for report / repair date / machine location.
- Adds validation workflow.
- Still needs live production DOM verification on claim `0251-2026-SDLG-PFR`.

### PR #3 (`fix/sdlg-claim-data-race` — still Draft)
- Stops loading hydrate + enforcer from `claim-fields.js` entirely.
- Adds claim-id guards across enrich / policy / finance / canonical helper.
- More files touched (18), more comprehensive.
- Author left it Draft until CI + browser verification pass.

**Recommendation for Fase 1:**  
Prefer the more complete protection of PR #3 direction, but only after confirming why it was left Draft and after the writers map is respected. If PR #3 is too divergent from current main, take the cleanest parts of PR #2 + necessary guards from PR #3 into a fresh small PR.

---

## 5. Example claims for testing (Fase 1)

- `0251-2026-SDLG-PFR` (explicitly mentioned in existing PRs)
- Any other claim the owner uses daily that previously showed flicker / wrong repair date / wrong location

Test matrix is defined in the main planning document (7 cases).

---

## 6. Safe disable order (for Fase 1)

1. Stop **loading** `sdlg-inline-enforcer.js` (or keep as no-op stub).
2. Remove / disable the `setInterval(500)` nuclear loop inside hydrate; keep only event-driven `apply` that checks current route claim_id.
3. Ensure React (or the single remaining writer) always fetches by exact `claim_id` and refuses to render if mismatch.
4. Keep finance recompute, but only after verified matching claim.
5. Leave policy/enrich modules only if they already have claim-id guards (as in PR #3).

Do **not** disable writers randomly. Follow this map.

---

## 7. Fase 0 checklist status

- [x] Backup branch `backup/stable-2026-10-21-before-legacy-fix` created
- [x] PR #1 / #2 / #3 reviewed
- [x] Why PR #3 is Draft clarified (author-held for CI + browser verification)
- [x] Writers map documented (this file)
- [x] Example claim noted (`0251-2026-SDLG-PFR`)
- [ ] Optional: dry-run of rollback commands (can be done by owner anytime)

**Fase 0 complete.** Ready to start Fase 1 with a clear map.
