# Frontend Rebuild Plan — SDLG Warranty

**Status:** Ready to execute  
**Paired doc:** `docs/PRD.md`  
**Last updated:** 2026-10-16  
**Strategy:** Keep Supabase. Replace frontend. Strangle legacy monolith.

---

## 1. Why rebuild (not more PRs)

Legacy UI:

- ~3MB `index.html` + 70+ `window.*` modules
- Multiple writers (React + interval hydrators + enforcers) → flicker / cross-claim bugs
- Patch PRs stack without fixing ownership of claim state

Backend is healthy (`frqvelcreczmnofldrga`). Rebuilding Postgres would risk production data for little gain.

**Decision:** greenfield frontend app, same API/RPC surface.

---

## 2. Target stack

| Piece | Choice | Notes |
|-------|--------|--------|
| Build | Vite | Fast, simple, Pages-friendly |
| UI | React 18 + TypeScript | Strong ecosystem; AI-friendly |
| Data | `@tanstack/react-query` | Single fetch/cache model; kills stale races |
| API | `@supabase/supabase-js` | One client module only |
| Router | `react-router` | Drop hash-router hacks when ready |
| Validation | Zod | Parse + save payloads |
| Tables/forms | Plain React or light headless | Avoid another mega UI kit |
| Excel | SheetJS (existing knowledge) | Parse import parity |
| Host | GitHub Pages | Sole production host |

**Forbidden in new app:**

- `scripts/apply-*.js` HTML injectors for features
- Second `createClient` / dual GoTrue
- `service_role` in any frontend env
- Interval-based DOM field writers

---

## 3. Proposed repo layout

Option A (recommended): monorepo folder in existing git history

```
apps/web/                 # new Vite app
  src/
    main.tsx
    app/
      router.tsx
      providers.tsx
    lib/
      supabase.ts         # ONLY createClient
      rpc.ts
    features/
      auth/
      overview/
      claims/
      parse/
      masters/
    shared/
      ui/
      types/
  index.html
  vite.config.ts
docs/PRD.md
docs/FRONTEND_REBUILD_PLAN.md
# legacy monolith stays at repo root until cutover, then archive/
```

Option B: separate repo `sdlg-warranty-web` — only if Pages/deploy rights are cleaner that way.

---

## 4. Phases

### Phase 0 — Freeze & inventory (0.5–1 day)

- [ ] Feature-freeze legacy `main` (hotfix-only)
- [ ] Park/close overlapping Input PRs (#1–#3) unless critical data-loss hotfix
- [ ] List tables + RPCs actually used (from `DATA_DICTIONARY` + `sdlg-repository` / portal modules)
- [ ] Confirm production URL remains Pages; mark Workers retired in all active docs

**Exit:** Written inventory of read/write endpoints for claims.

---

### Phase 1 — Scaffold (1–2 days)

- [ ] `apps/web` Vite + React + TS
- [ ] Supabase client singleton
- [ ] Auth gate (login page + session restore)
- [ ] App shell (nav: Overview | Claims | Parse)
- [ ] Env pattern: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (never service role)

**Exit:** Logged-in user sees empty shell without console auth errors.

---

### Phase 2 — Read path (2–3 days)

- [ ] Claims list query (active claims, basic columns)
- [ ] Claim detail by **exact `claim_id`**
- [ ] React Query keys: `['claim', claimId]` — no list-row fallback for detail body
- [ ] Loading / error / not-found UI (fail closed)
- [ ] Overview counts (simple SQL/count or existing view if present)

**Exit:** F2, F3, F8 behaviorally solid on read-only.

---

### Phase 3 — Parse engine port (2–4 days)

Port **proven** logic from legacy modules (do not re-invent):

| Legacy module | New home |
|---------------|----------|
| `claim-parser-helpers.js` (money harden) | `features/parse/money.ts` |
| `wo-claim-policy.js` | `features/parse/woPolicy.ts` |
| `wo-collision-modal.js` | `features/parse/WoCollisionModal.tsx` |
| paste/Excel UX | `features/parse/*` |

Rules:

- Parser pure functions testable without DOM
- Modal is React component (no `window.confirm` as primary UX)
- WO allowlist stays `WO26040309` unless product changes PRD

**Exit:** Paste of known sample form produces stable field object in UI.

---

### Phase 4 — Write path (2–4 days)

- [ ] Map parsed object → DB columns via one `claimMapper.ts` (align `claim-fields` / dictionary)
- [ ] Create claim insert (or existing RPC if that is the supported write path)
- [ ] Update claim by id with confirm gates from WO policy
- [ ] Invalidate React Query on success
- [ ] Refuse save when offline / unauthenticated

**Exit:** F4–F7 pass on staging or production with test claim + cleanup plan.

---

### Phase 5 — Hardening & parity (1–2 days)

- [ ] Smoke script or written checklist for F1–F8
- [ ] Mobile pass on list/detail/parse
- [ ] CSP / relative asset paths for GitHub Project Pages (`base` config)
- [ ] Remove any debug keys from client bundle

**Exit:** Product owner signs PRD §13 checklist.

---

### Phase 6 — Cutover (0.5 day)

- [ ] Build `apps/web` → Pages artifact (workflow update)
- [ ] Deploy; verify F1–F8 on live URL
- [ ] Tag `release/frontend-v1`
- [ ] Move legacy root app to `archive/monolith-YYYY-MM-DD` or backup branch
- [ ] Update README: sole frontend path = `apps/web`

**Rollback:** redeploy previous Pages artifact / `backup/latest-green`.

---

## 5. Claim state rules (non-negotiable)

```
selectedClaimId  →  fetchClaim(id)  →  UI
                     ↑ only source for editor fields
```

Never:

```
selectedClaim = liveRow || claimsList.find(...)
setInterval(writeDomFields)
```

Switching A→B must cancel in-flight request for A (React Query does this with query keys + unmount).

---

## 6. Testing strategy (practical)

| Level | What |
|-------|------|
| Unit | money parse, WO classifyMatch, claimMapper |
| Manual smoke | PRD F1–F8 on real account |
| Optional | Playwright login + open two claims (later) |

Do **not** block v1 on 100% E2E coverage. Block on F1–F8.

---

## 7. Working agreement (AI + human)

1. **PRD is law** — scope creep needs PRD version bump  
2. **One phase at a time** — no parallel “also redesign Overview charts”  
3. **Prefer porting proven parser/WO code** over rewriting from memory  
4. **Every PR states which PRD flow it advances**  
5. **No merge to production cutover branch without smoke notes**  

---

## 8. Rough effort

| Phase | Calendar (solo + AI assist) |
|-------|-----------------------------|
| 0 | 0.5–1 day |
| 1 | 1–2 days |
| 2 | 2–3 days |
| 3 | 2–4 days |
| 4 | 2–4 days |
| 5–6 | 1.5–2.5 days |
| **Total** | **~10–16 working days** for solid v1 |

Rushing cutover before Phase 4 = repeating the same bugs in a new folder.

---

## 9. Immediate next actions

1. Product: confirm PRD v1.0 (this pair of docs).  
2. Engineering: start Phase 0 inventory + Phase 1 scaffold in `apps/web`.  
3. Do not merge further legacy Input race PRs unless production data is actively corrupting.

---

## 10. References

- `docs/PRD.md`
- `docs/architecture-stability.md` (strangle phases A–G — this plan is the decisive frontend cut)
- `docs/business/DATA_DICTIONARY.md`
- `AGENTS.md` (anti-regression until monolith archived)
- `STABLE_BACKUP.md` (rollback branches)
