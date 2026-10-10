# AGENTS.md — SDLG Warranty Claim

> README for AI coding agents. Read this first. Do not invent architecture.

## What this project is

Internal web app for **SDLG warranty claims** (monitor, parse, assess, track).

**Primary public URL:** https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/  
**Also:** Cloudflare Worker (see `wrangler.jsonc`)  
**Database / Auth:** Supabase `frqvelcreczmnofldrga`  
**Repo:** `esahuda9900/Esahuda-Rizqi-Nugraha` · branch `main`

## Tech stack (exact)

| Layer | Choice |
|-------|--------|
| Frontend | Monolithic `index.html` + `modules/*.js` (no bundler) |
| Hosting | GitHub Pages (Project Pages) + Cloudflare |
| Database | Supabase (Postgres, RLS, claim RPCs) |
| Auth | Supabase Auth · storageKey `sb-frqvelcreczmnofldrga-auth-token` |
| Routing | Hash router (`#/claims`, `#/claim/:id`, …) via `modules/sdlg-hash-router.js` |

## ANTI-REGRESSION RULES (never violate)

These regressions already happened in production. **Do not reintroduce them.**

1. **Never use root-absolute asset paths** on Project Pages.
   - Forbidden: `src="/modules/..."`, `src="/canonical-..."`, `src="/styles/..."`
   - Required: `src="./modules/..."` and optional `<base href="./">`

2. **Never call `supabase.createClient()` outside `modules/supabase-client.js`.**
   - Always use `window.getSdlgSupabase()` / singleton.
   - Dual GoTrueClient causes empty UI under RLS.

3. **Portal Home mapping**
   - Service Method ← `repair_method` (fallback `service_method`)
   - Date of repair report ← `dealer_repair_date` / `completion_date` / `failure_date`
   - Forbidden: `serviceMethod: selectedClaim.service_method || ""` alone

4. **Prefer modules over editing the 3MB `index.html`.**
   - Data access → `modules/sdlg-repository.js`
   - Field map → `modules/claim-fields.js`
   - Parse confirm/diff → `modules/wo-claim-policy.js` + `wo-collision-modal.js`
   - Parse UX → `modules/paste-parse-ux.js`
   - Pipeline diagnostics → `modules/data-pipeline-guard.js`

5. **Update Klaim must call** `SDLGWoClaimPolicy.confirmUpdateSave` (diff modal).

6. **Deploy safety nets — do not delete**
   - `scripts/pages_prepare_index.py`
   - `scripts/bake_source_index.py`
   - `scripts/regression_contract.sh`
   - `.github/workflows/static.yml` contract step

7. **Never disable RLS. Never ship `service_role` to the browser.**

8. **Domain logic stays in Supabase** (warranty resolve RPCs). Frontend does not re-implement policy.

9. **Navigation / breadcrumb (2026-10-10 incident)**
   - **Forbidden:** inject global DOM bars (`#sdlg-route-breadcrumb`, `data-sdlg-bc-back`, `document.body.prepend` nav).
   - Claim Detail already has React header: `← Kembali` + claim id + Edit / SDLG Input / Hapus.
   - Top nav tabs handle Master Data / Data Quality / Overview / Claims.
   - `modules/sdlg-route-finish.js` **v1.5+** must keep breadcrumb injection **DELETED** and `killBreadcrumb()` active.
   - Do not reintroduce `breadcrumbHtml()` that builds `Overview / Claims / …`.
   - Hash changes go through `window.SDLGHashRouter.navigate` / `setFromTab`.

10. **Feedback Person mapping**
    - Must use fallback chain ≥5 keys (`technical_personnel`, `feedback_person`, `pic_name`, …).
    - Empty → `""` (UI shows `—`), never the word `Kosong`.

11. **Policy rules table**
    - There is **no** `public.policy_rules` table.
    - Use RPC `sdlg_policy_runtime_snapshot` → `service_policy_rules`.

## Before you change anything

| Working on… | Read first |
|-------------|------------|
| Any task | This file + `STABLE_BACKUP.md` + `RUNBOOK_EMERGENCY.md` |
| Deploy / paths | `docs/runbooks/DEPLOYMENT.md` (if present) |
| Business workflow | `docs/business/BUSINESS_RULES.md` |

## Definition of done (agent)

1. Root cause identified; smallest safe fix (prefer `modules/*.js`)
2. No forbidden path or dual `createClient`
3. `bash scripts/regression_contract.sh` would still pass on built `index.html`
4. Hard-refresh test on GitHub Pages URL **and** verify live source (not only git push)
5. For UI claims: confirm in live HTML markers (e.g. `ROUTE_FINISH_V15`, `killBreadcrumb`)
6. If breaking change risk → note rollback branch in `STABLE_BACKUP.md`

## Verify Claim Detail has ONE back button

```javascript
window.SDLGRouteFinish?.version          // "1.5.0"+
window.__SDLG_ROUTE_FINISH_DISABLED__    // true
document.getElementById('sdlg-route-breadcrumb')  // null
location.hash
```

## Rollback

```bash
git fetch origin
git reset --hard origin/backup/stable-2026-10-09-parse-diff
git push origin main --force
```

---

*Last aligned: 2026-10-10 — nuclear breadcrumb kill (route-finish v1.5); ban global DOM nav injection.*
