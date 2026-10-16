# SDLG Warranty — Web (v0.1 scaffold)

Clean frontend rebuild. **Keeps** Supabase `frqvelcreczmnofldrga`.

See:

- `docs/PRD.md`
- `docs/FRONTEND_REBUILD_PLAN.md`

## Dev

```bash
cd apps/web
cp .env.example .env.local   # optional; anon key has public default for this project
npm install
npm run dev
```

Open http://localhost:5173/Esahuda-Rizqi-Nugraha/  
(or set `VITE_BASE=/` in `.env.local` for root path locally)

## Scripts

| Command | Purpose |
|---------|--------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run typecheck` | `tsc` |

## Phase status

| Phase | Status |
|-------|--------|
| 1 Scaffold + auth shell | **This branch** |
| 2 Read path polish | Claims list + detail by id (basic) |
| 3 Parse port | Pending |
| 4 Write path | Pending |
| 5–6 Smoke + cutover | Pending |

## Rules

- One Supabase client: `src/lib/supabase.ts`
- Claim detail: `fetchClaimById` only — no list-cache fallback
- No DOM interval writers
