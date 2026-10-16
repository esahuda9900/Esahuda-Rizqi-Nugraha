# SDLG Documentation

Organized from root markdown (housekeeping 2026-10-09).

## Start here (product + rebuild)

| Doc | Purpose |
|-----|--------|
| **[PRD.md](./PRD.md)** | Product requirements — mandatory flows, non-goals, acceptance |
| **[FRONTEND_REBUILD_PLAN.md](./FRONTEND_REBUILD_PLAN.md)** | Clean frontend rebuild phases (keep Supabase) |
| [architecture-stability.md](./architecture-stability.md) | Long-term strangle / module target |

## Structure

- `architecture/` — system design, plugins, project context
- `runbooks/` — deploy, restore, security, release
- `business/` — rules, data dictionary, warranty logic
- `archive/` — historical status / roadmaps

## Critical (still at repo root)

- `RUNBOOK_EMERGENCY.md` — 1-page emergency
- `STABLE_BACKUP.md` — rollback branches
- `README.md` — project entrypoint
- `AGENTS.md` — anti-regression rules for AI agents (legacy until monolith archived)
