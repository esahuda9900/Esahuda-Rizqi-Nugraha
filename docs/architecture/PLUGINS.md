# SDLG Warranty Claim — Plugins & Free-Tier Privilege Map

Last audited: 2026-09-23 (Vercel retired)

This document is the single map of connected platforms, what they are for, and how we maximize the free tier without weakening security.

## Connected platforms

| Platform | Role in this project | Free-tier posture | Status (2026-09-23) |
|----------|----------------------|-------------------|---------------------|
| **Supabase** | Auth, Postgres, RLS, RPC, 1 Edge Function | Stay well under DB/auth/function limits | `ACTIVE_HEALTHY` — project `frqvelcreczmnofldrga` (ap-southeast-2) |
| **GitHub** | Source of truth, Actions CI, daily DB backup artifacts | Stay under ~2000 Actions minutes/mo | Repo `esahuda9900/sdlg-warranty-backup` (private) |
| **Cloudflare** | **Sole** production frontend (Workers static assets) | Workers free tier; static assets | Worker `sdlg-warranty-backup` — `https://sdlg-warranty-backup.esahuda9900.workers.dev` |
| **Voice** | Not used by this app | N/A | Connected but out of scope |
| **Automations** | Optional future alerts only | Use sparingly | Connected but not required for claim path |

## Supabase — maximize without paying

### Measured snapshot (2026-09-16)
- Database size: **~45–46 MB** (free limit ~500 MB)
- Active claims: **~523**
- `claim_audit_log`: primary growth table (~22 MB / ~4.5k rows)
- Active app users (`app_user_roles.is_active`): **1**
- Edge Functions: **only** `gemini-parse-claim` (`verify_jwt: true`)

### Privilege model (intentional — do not “fix”)

| Object | Design | Rule |
|--------|--------|------|
| RLS on all operational tables | Enabled | Keep ON |
| Claim write RPCs (`create_sdlg_claim`, `update_sdlg_claim`, `delete_sdlg_claim`, status updaters) | `SECURITY DEFINER` + `EXECUTE` for `authenticated` | **Intentional.** Authorization is inside the function via `private_is_warranty_claim_writer()` (`admin` / `warranty_admin` only) |
| `private_is_warranty_claim_writer()` | Not executable by `authenticated` | Must stay private |
| `sdlg_warranty_resolve_claim` | `SECURITY INVOKER` | Canonical warranty engine — frontend must not replace it |
| `service_role` key | Server/backup only | **Never** in the browser |
| Leaked password protection | Pro-only | Skip on free; use min password length ≥ 12 and closed user set |

Security Advisors will WARN about SECURITY DEFINER + authenticated EXECUTE. That warning is expected and documented in `SECURITY.md`. Do not revoke those grants without rewriting the client call path.

### What we do with free DB headroom
1. Keep comprehensive claim indexes (unused indexes may stay while data is small).
2. Keep full audit log until size pressure (~300–400 MB); then archive with approval — never silent truncate. See `AUDIT_LOG_RETENTION.md`.
3. Prefer RPC + RLS over new Edge Functions or Realtime.
4. One production project only.

Quick size check:
```sql
SELECT * FROM public.free_tier_db_health;
```

## GitHub — maximize without burning minutes

- Source authority: branch `main`.
- Daily workflow: `sdlg-supabase-backup.yml` (schema + public data + roles → artifact).
- Regression gates: frontend-ci, production-smoke, `verify-source-lock.js` (protects core module + injector freeze + free-tier docs).
- **Injector freeze:** do not add new `apply-*.js` for routine fixes; prefer `modules/*.js`. See `DEPLOYMENT.md` and `INJECTOR_ROADMAP.md`.

## Cloudflare — sole frontend host

- Config: `wrangler.jsonc`
- Serves static assets (`index.html`, `modules/**`, `styles/**`) with SPA `not_found_handling`
- Auto-deploy from GitHub `main` (Workers integration / Wrangler)
- This is the only production URL for daily operational use and smoke checks

## Platforms we deliberately do not depend on for claim writes

From `ARCHITECTURE_STABILITY.md`:
- Gemini / parser tools may assist parsing but must not be required for claim CRUD.
- Notion, Exa, AWS analytics: non-transactional only.

If a non-critical tool is down, claim create/update/status via Supabase must still work.

## Expert operating contract (free tier)

1. **Database is the system of record** for business rules and authorization.
2. **Do not weaken RLS or RPC role checks** to silence advisor warnings.
3. **Do not add paid features** (extra Edge Functions, Realtime everywhere, Pro auth APIs) while the closed user set is small.
4. **Frontend stays presentation** — modules over injectors.
5. **Every change:** smallest safe fix → regression → production smoke on Cloudflare.

## Related docs
- `FREE_TIER.md` — limits and weekly hygiene
- `SECURITY.md` — intentional SECURITY DEFINER design
- `DEPLOYMENT.md` — build chain + injector freeze
- `ARCHITECTURE.md` / `ARCHITECTURE_STABILITY.md` — system boundaries
- `AUDIT_LOG_RETENTION.md` — audit growth strategy
- `RUNBOOK.md` — operator procedures
