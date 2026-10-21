# Legacy Form Writers Map — SDLG Input Page

**Created:** 2026-10-21  
**Updated:** 2026-10-21 (post #9 merge)  
**Purpose:** Fase 0 deliverable. Document every writer that can mutate portal form fields before any are disabled.  
**Source of truth at map creation:** `main` @ `e2bd530ea19ceb99fcd69e51265d22efa8ad8dca`  
**Shipped fix:** PR #9 → `main` (hydrate v1.4 event-driven, inline-enforcer disabled stub)

---

## 1. How the page is loaded (after PR #9)

`modules/claim-fields.js` loads:

| Script | Version param | Role |
|--------|---------------|------|
| `sdlg-input-hydrate.js` | **v=20261021-v15** | Event-driven only (no 500ms loop) |
| ~~`sdlg-inline-enforcer.js`~~ | **not loaded** | File kept as disabled stub only |
| hash router / tab bridge / claim-sync / finance / UX modules | unchanged | Supporting |

Production console confirmation:
```
[SDLG hydrate] v1.4 event-driven bridge loaded; no polling
```

---

## 2. Competing Writers — status after #9

### A. Was HIGH RISK — now mitigated

1. **`sdlg-input-hydrate.js`** — was 500ms nuclear loop → **v1.4 event-driven**; refuses mismatched claim_id; does not write report/repair date/machine location.
2. **`sdlg-inline-enforcer.js`** — was 600ms force loop → **disabled stub**; not loaded from claim-fields.

### B. MEDIUM RISK — still present (guarded / secondary)

3. React `SDLGPortalInputPage` in baked `index.html` — intended sole writer for report / repair / location.
4. `canonical-warranty-helper.js` — bails on portal input page / disable flags.
5. `sdlg-portal-enrich.js`, policy modules, finance UX — may still write; port extra claim-id guards from old PR #3 if residual flicker remains.

---

## 3. Fase 0 / Fase 1 checklist

- [x] Backup branch `backup/stable-2026-10-21-before-legacy-fix`
- [x] Writers map documented
- [x] PR #9 merged (single-source form identity)
- [x] Production loads hydrate v1.4 (console verified by owner)
- [ ] Owner confirms manual A↔B test matrix (7 cases) — **pending**

If A↔B still flickers after #9, next step is targeted guards on enrich/policy/finance (from PR #3), not re-enabling intervals.
