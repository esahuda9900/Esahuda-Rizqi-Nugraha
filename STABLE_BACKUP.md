# SDLG Stable Backup — 2026-10-09

Known-good production states after the stabilization sprint.

## Backup branches (newest first)

| Branch | What it captures |
|--------|------------------|
| `backup/stable-2026-10-09-parse-diff` | Diff modal Update Klaim, paste-parse UX, field registry, baked source, housekeeping |
| `backup/stable-2026-10-09-baked-source` | Source `index.html` production-safe (paths, singleton, portalValues) |
| `backup/stable-2026-10-09-portal-ok` | Portal Home Service Method + Repair Date mapping |

Prefer **`backup/stable-2026-10-09-parse-diff`** for full rollback.

## Fixes included (cumulative)

- GitHub Project Pages path 404s (`/modules/` → `./modules/`)
- Multiple GoTrueClient / Supabase singleton (`modules/supabase-client.js`)
- Empty claims UI (auth session + `loadClaims` recovery)
- Form broadcast fill (“Replace With New Transmission Assembly”)
- Evidence empty / `variant-form` leak
- Stuck LOADING badge on Warranty Assessment
- Portal Home empty Service Method + Date of repair report (`repair_method` column)
- Source ≠ production bake (`scripts/bake_source_index.py`)
- Field registry (`modules/claim-fields.js`)
- Deploy smoke contract (`static.yml`)
- Workflow / docs housekeeping
- Extract `SDLG_REPOSITORY` → `modules/sdlg-repository.js`
- Paste→Parse UX: sticky footer, collapse Fault/Cause, empty `—`
- Update Klaim **always** shows multi-field diff modal (`wo-collision-modal` v1.2 + policy v1.5)

## How to restore

### Local terminal
```bash
git fetch origin
git checkout main
git reset --hard origin/backup/stable-2026-10-09-parse-diff
git push origin main --force
```

Wait for **Deploy static content to Pages** → hard refresh (`Ctrl+Shift+R`).

### Emergency one-pager
See [`RUNBOOK_EMERGENCY.md`](./RUNBOOK_EMERGENCY.md).

## Live health checklist (2 min)

1. Console: no 404 on `./modules/*`
2. Console: no `Multiple GoTrueClient`
3. `typeof window.getSdlgSupabase` → `function`
4. `window.SDLGWoClaimPolicy.version` → `1.5.0`
5. `window.SDLGWoCollisionModal.version` → `1.2.0`
6. Parse a matching claim → **Update Klaim** opens diff modal
7. Claims table non-empty when logged in
