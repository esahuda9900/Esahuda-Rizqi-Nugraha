# Architecture Stability Contract — SDLG Warranty

**Last updated:** 2026-10-05  
**Status:** enforceable for all PRs to `main`

## Source of truth

| Layer | Authority |
|-------|-----------|
| GitHub `main` | Source code authority |
| Cloudflare Workers (`sdlg-warranty-backup`) | Production frontend delivery |
| Supabase `frqvelcreczmnofldrga` | Business data + workflow + policy engine |
| GitHub Actions | Validation / backup / monitor only — no history rewrite |

Gemini / analytics / external tools are **non-transactional**. Claim writes and workflow must work without them.

---

## North star (target, not overnight rewrite)

```
index.html          → thin shell only (< 200 KB mid-term, < 100 KB long-term)
modules/            → all app logic (ES modules preferred)
styles/             → visual only (target: 3 files)
Supabase RPC/SQL    → domain logic, data, policy
```

**Index is a door.** House = `modules/`. Data = Supabase. Look = `styles/`.

Ideal shell shape (future):
- meta + 3 CSS links + CDN deps (SRI) + `import { boot } from '/modules/boot.js'`
- no inline business logic, no embedded master tables, no parser in HTML

---

## Hard rules (violations = PR reject)

1. **Do not grow `index.html` with new features.** New behavior → `modules/*.js` or Supabase migration.
2. **Domain logic stays in Supabase** (RPC, triggers, SECURITY DEFINER with `search_path`). Do not reimplement policy in the browser as source of truth.
3. **No new injectors.** Prefer `modules/*.js` loaded by `navigation-state.js` / build. Do not add `scripts/apply-*.js` injectors for product features.
4. **Free-tier safe.** No “upgrade to Pro” as the fix. Watch DB size / audit_log growth.
5. **SQL changes:** `BEGIN`/`COMMIT`, `IF NOT EXISTS` / `ON CONFLICT`, production-safe.
6. **No secrets in frontend.** No `service_role` in static assets.
7. **Visual-only CSS** must not change workflow or RPC contracts.

### Soft rules (migration)

8. Prefer **ES `import`/`export`**. Temporary `window.SDLG*` bridges allowed until shell is modular.
9. `modules/core/*` should stay pure (no fetch, no DOM). UI modules may import core; core must not import UI.
10. One PR = one concern (nav fix ≠ CSS redesign ≠ schema).

---

## Current reality (honest)

- `index.html` ~3 MB monolith (markup + CSS + logic + data residue)
- Progressive modules under `modules/` (tracking, nav, input helper, …)
- Many CSS layers under `styles/` (merge target: 3)
- Policy engine + claims live in Supabase (correct)

**Strategy:** strangle pattern — extract piece by piece; production stays up.

---

## Migration phases (order matters)

| Phase | Goal | Done when |
|-------|------|-----------|
| **A** | Stop the bleeding | No new logic in `index.html`; all new code in `modules/` or SQL |
| **B** | Data out of HTML | Master/lookup tables not embedded as multi-MB inline data |
| **C** | Core pure modules | `modules/core/{date,currency,constants,canonical-model}.js` |
| **D** | Parser / HM extract | `modules/parser/*`, `modules/hm/*`; smoke claim create |
| **E** | CSS merge | 16 files → ≤6 → **3** (`core.css`, `components.css`, `responsive.css`) |
| **F** | Thin shell + boot | `modules/boot.js` mounts app; index is door only |
| **G** | CSP strict | Worker headers: no `unsafe-inline` after inline scripts gone |

**Do not start F/G before A–D are mostly done.**

---

## Target module layout

```
modules/
  boot.js                 # future entry
  core/                   # pure helpers
  parser/                 # source parse / lock / parts
  hm/                     # hour-meter estimate
  data-access/            # Supabase RPC wrappers only
  ui/                     # navigation, claim list/detail, input helper
  export/                 # excel etc.
```

Existing files (`navigation-state.js`, `warranty-tracking-ux.js`, …) stay until moved under `ui/` without behavior change.

---

## Target styles layout

```
styles/
  core.css          # reset, tokens, typography
  components.css    # card, button, table, badge, tracking panel
  responsive.css    # breakpoints only
```

Until merge completes, keep shipping fixes in focused files (e.g. `sdlg-claim-detail-clean-v2.css`) and avoid adding a 10th parallel design system.

---

## What must not change without explicit ops approval

- Canonical RPC `sdlg_warranty_resolve_claim` contract
- Claim write RPCs + RLS model
- Production Worker name / public URL
- Free-tier limits assumptions

See also: `DEPLOYMENT.md`, `docs/hardening/`, `INJECTOR_ROADMAP.md` if present.

---

## Definition of done (long-term)

- [ ] `index.html` < 100 KB
- [ ] ≤ 3 CSS entry files
- [ ] No injector pipeline for product features
- [ ] Parser/HM/core not inline in HTML
- [ ] CSP without `unsafe-inline`
- [ ] Claim create + detail + status transition smoke pass after each extract phase
