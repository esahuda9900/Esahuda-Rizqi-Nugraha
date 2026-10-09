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
| `backup/stable-2026-10-09-antiregression` | Contract + session heal + AGENTS |
| `backup/stable-2026-10-09-parse-diff` | Diff modal Update Klaim |
| `backup/stable-2026-10-09-baked-source` | Source bake paths/singleton |
| `backup/stable-2026-10-09-portal-ok` | Portal repair_method / repairDate |

## Emergency

See `RUNBOOK_EMERGENCY.md`.
