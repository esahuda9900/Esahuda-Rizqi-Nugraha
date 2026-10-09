# SDLG Stable Backup — 2026-10-09 (Portal OK)

This marks a **known-good** production state after fixing:

- GitHub Project Pages path 404s (`/modules/` → `./modules/`)
- Multiple GoTrueClient / Supabase singleton
- Empty claims UI (auth session + loadClaims gate)
- Form broadcast fill (“Replace With New Transmission Assembly” everywhere)
- Evidence section showing `variant-form` / empty values
- Stuck LOADING badge on Warranty Assessment
- Portal Home empty **Service Method** + **Date of repair report**
  - Root cause: `portalValues.serviceMethod` used `service_method` (wrong column; DB is `repair_method`)
  - Root cause: repair date not in `portalValues` / `fieldHtml` at all

## Backup branch

```text
backup/stable-2026-10-09-portal-ok
```

Commit (approx): latest `main` at backup time including portalValues + helper v1.2.4.

## How to restore if something breaks

### Option A — GitHub UI
1. Open repo → Branches
2. Find `backup/stable-2026-10-09-portal-ok`
3. Open it → “Compare / create pull request” into `main`, or reset `main` to this branch if you are sure

### Option B — Local terminal
```bash
git fetch origin
git checkout main
git reset --hard origin/backup/stable-2026-10-09-portal-ok
git push origin main --force
```

> Force-push only if you intend to discard newer commits on `main`.

### Option C — Cherry-pick key files only
Restore these files from the backup branch:

- `canonical-warranty-helper.js`
- `modules/canonical-warranty-helper.js`
- `modules/supabase-client.js`
- `modules/data-pipeline-guard.js`
- `modules/warranty-assessment-ux.js`
- `scripts/pages_prepare_index.py`
- `.github/workflows/static.yml`

```bash
git checkout origin/backup/stable-2026-10-09-portal-ok -- \
  canonical-warranty-helper.js \
  modules/canonical-warranty-helper.js \
  modules/supabase-client.js \
  modules/data-pipeline-guard.js \
  modules/warranty-assessment-ux.js \
  scripts/pages_prepare_index.py \
  .github/workflows/static.yml
git commit -m "restore: stable portal backup 2026-10-09"
git push origin main
```

## Post-restore checklist

1. GitHub Actions → **Deploy static content to Pages** = success
2. Hard refresh app (`Ctrl+Shift+R`)
3. Console: no `Multiple GoTrueClient`, no `/modules/` 404s
4. Input Helper claim open:
   - Service Method filled from `repair_method`
   - Date of repair report filled
5. `await window.SDLGDataPipeline.runDiagnostics()` → `DATA`

## Do not break again (rules)

1. **Never** use root-absolute paths (`/modules/...`) on Project Pages — always `./modules/...`
2. **One** Supabase client only — go through `getSdlgSupabase()` / patched `getSupabaseClient()`
3. Portal field maps must use **real DB column names** (`repair_method`, not `service_method`)
4. New portal fields need **both** `portalValues` key **and** `fieldHtml(...)`
5. Keep deploy script `scripts/pages_prepare_index.py` green — it applies live patches to `index.html`
6. Avoid MutationObserver loops that re-apply forever — stable `lastAppliedKey`
7. After deploy: always hard-refresh before judging UI
