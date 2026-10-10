# SDLG Stable Backup

## Auto snapshots (updated on every green Pages deploy)

| Branch | Meaning |
|--------|--------|
| **`backup/latest-green`** | Always points at last successful Pages deploy SHA |
| `backup/auto-YYYY-MM-DD` | Daily snapshot (UTC date of deploy) |

```bash
git fetch origin
git reset --hard origin/backup/latest-green
git push origin main --force
```

## Manual milestone branches

| Branch | Notes |
|--------|--------|
| **`backup/stable-2026-10-10-overview-ux`** | Overview UX: KPI 0%→—, semantic My Action colors, P2 MONITOR, rejection %, thicker bars. Modules `sdlg-overview-ux.js/css` |
| **`backup/stable-2026-10-10-overview-fix`** | Auth singleton v2.2 + session recheck; auth-guard v1.3; Overview session gate (JWT timing) |
| **`backup/stable-2026-10-10-no-duplicate-back`** | Route-finish v1.5 nuclear breadcrumb kill |
| `backup/stable-2026-10-09-antiregression` | Contract + session heal + AGENTS |
| `backup/stable-2026-10-09-parse-diff` | Diff modal Update Klaim |
| `backup/stable-2026-10-09-baked-source` | Source bake paths/singleton |
| `backup/stable-2026-10-09-portal-ok` | Portal repair_method / repairDate |

## Chapter status (2026-10-10)

| Chapter | Status |
|---------|--------|
| Auth + Supabase singleton | Done |
| Hash routing + auth guard | Done |
| Login polish + FOUC | Done |
| Duplicate back button | Done |
| Session persist + 401 handling | Done |
| Overview page render | Done |
| Overview UX hierarchy | Deploying (ensure live modules) |

**Next recommended:** Finance auto-calc, then Claims pagination.

## Emergency

See `RUNBOOK_EMERGENCY.md`.
