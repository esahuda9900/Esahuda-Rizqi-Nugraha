# Free-tier CI & deploy (GitHub Free + Cloudflare Free)

**Last updated:** 2026-09-24

## Reality check

| Resource | Limit | Status (Sep 2026) |
|----------|-------|-------------------|
| GitHub Actions minutes | 2,000 / month (private) | **Exhausted** — resets ~monthly |
| Cloudflare Workers | Free | **Production deploy path** |
| Supabase | Free project | OK |

When Actions minutes are 0, **every** workflow fails in ~3 seconds. That is expected — not an app bug.

## What “10/10” means on free tier

1. **Production works** on Cloudflare (policy v3, login, RLS) — already verified.
2. **Deploy** = push `main` → Cloudflare Workers Builds (or dashboard `wrangler deploy`).
3. **GitHub Actions** = optional, **manual only**, after minutes reset.

Do **not** run 30+ workflows on every push. That is what burned the quota.

## Deploy (no GitHub minutes required)

```bash
# Preferred: Cloudflare auto-build on push to main
git push origin main

# Or force nudge
echo "redeploy $(date -Iseconds)" >> DEPLOY_TRIGGER.txt
git add DEPLOY_TRIGGER.txt && git commit -m "chore: CF deploy trigger" && git push

# Verify
curl -sS https://sdlg-warranty-backup.esahuda9900.workers.dev/modules/policy-runtime-fix.js | head -15
# Expect: __SDLG_POLICY_RUNTIME_FIX_V3__
```

## While Actions minutes are empty

**Recommended:** GitHub → repo **Settings → Actions → General** → **Disable actions** until the monthly reset.

Or leave enabled but only run workflows via **Actions → Run workflow** (manual).

## After minutes reset (~7 days)

1. Re-enable Actions if disabled.
2. Run **only**:
   - `Production Smoke Check` (curl gate) — manual once
3. Do **not** re-enable push triggers on historical export/UI verify workflows unless you have minutes to spare.

## Workflows that should stay manual (`workflow_dispatch`)

- `production-smoke.yml`
- `deploy-cloudflare.yml` (backup path; CF Builds is primary)

Historical one-off verify workflows (export, claim-detail, etc.) should not run on every push on a free account.

## Production truth (2026-09-24)

- policy-runtime **v3** live
- Login warranty_admin → **Policy: DB Verified**
- Claims + RLS OK
- CI badge red = quota, not product failure
