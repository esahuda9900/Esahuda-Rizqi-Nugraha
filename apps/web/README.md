# SDLG Warranty — Web

Clean frontend rebuild. Backend: Supabase `frqvelcreczmnofldrga`.

Docs: `docs/PRD.md` · `docs/FRONTEND_REBUILD_PLAN.md`

## Status

| Phase | Status |
|-------|--------|
| 1 Scaffold + auth | Done |
| 2 Claims read (list + detail by id) | Done |
| 3 Parse + WO modal | Done (heuristic parser) |
| 4 Create / update claim | Done |
| 5 Full smoke F1–F8 on prod host | Manual |
| 6 Pages cutover | Not yet — monolith still production |

## Dev

```bash
cd apps/web
npm install
echo 'VITE_BASE=/' > .env.local
npm run dev
```

## Rules

- One Supabase client only (`src/lib/supabase.ts`)
- Claim detail / editor body: fetch by exact `claim_id` only
- No interval DOM writers
- WO allowlist: `WO26040309`
