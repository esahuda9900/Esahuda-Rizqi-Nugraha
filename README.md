# SDLG Warranty Claim System

**Production (sole host):** [GitHub Pages](https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/)

```
https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/
```

> Cloudflare Workers (`*.workers.dev`) is **retired** for this app. Do not use it as production.

## Quick links

| Doc | Purpose |
|-----|--------|
| [RUNBOOK_EMERGENCY.md](./RUNBOOK_EMERGENCY.md) | Rollback & incident (1 page) |
| [STABLE_BACKUP.md](./STABLE_BACKUP.md) | Known-good branches |
| [docs/README.md](./docs/README.md) | Full documentation index |

## Stack

- Frontend: Vanilla JS + React (CDN), no bundler
- Backend: Supabase (Postgres + RLS + RPC)
- Hosting: **GitHub Pages only** (Project Pages)

## Deploy

Push to `main` → workflow **Deploy static content to Pages** (`static.yml`)

Safety nets:
1. Source `index.html` is production-baked (relative paths, singleton, portal field maps)
2. `scripts/pages_prepare_index.py` re-checks + inlines portal fixes on every deploy
3. Smoke grep fails deploy if `src="/modules/"` or wrong `service_method` mapping returns

## Critical modules

- `modules/supabase-client.js` — singleton client
- `modules/data-pipeline-guard.js` — auth/data diagnostics
- `modules/claim-fields.js` — field registry (DB column ↔ UI)
- `modules/sdlg-portal-finance-ux.js` — portal finance UX (inlined on Pages deploy)
- `canonical-warranty-helper.js` — portal Home autofill

## Backup branches

- `backup/stable-2026-10-09-portal-ok`
- `backup/stable-2026-10-09-baked-source`
