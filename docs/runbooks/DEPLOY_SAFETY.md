# Deploy Safety — Cloudflare-only (do not regress)

Last updated: 2026-09-24

This document exists so the 2026-09-23 deploy outage class of bugs does not return.

## Sole production host

| Host | Role |
|------|------|
| **Cloudflare Workers** | Only production frontend |
| Vercel | **Retired** — no `vercel.json`, no secondary smoke |
| Netlify | **Retired** — no `netlify.toml`; any remaining vendor webhook/project must be disconnected in the Netlify dashboard |

Production URL: https://sdlg-warranty-backup.esahuda9900.workers.dev

## Build pipeline (Cloudflare Workers Builds)

```text
pnpm install --no-frozen-lockfile && npm run build
  → scripts/build-production.js
      → apply-*.js chain (frozen list)
      → verify-production.js          (Cloudflare-only; vercel.json must be ABSENT)
      → verify-parser-contract.js
      → verify-warranty-contract.js   (skip/offline without SUPABASE_* )
      → verify-dual-warranty-routing.js (offline without SUPABASE_* )
      → verify-source-lock.js
      → verify-claim-id-year-contract.js
      → verify-public-release.js
npx --yes wrangler@4.136.3 deploy
```

### Critical: do NOT install wrangler as a local dependency

Pinning `wrangler` in `package.json` pulls `@cloudflare/workerd-*` platform
binaries during `pnpm install`. On Workers Builds this has failed with:

```text
ERR_PNPM_FETCH_502  GET .../workerd-linux-64-....tgz
```

Keep `devDependencies` to `playwright` only. Deploy with:

```text
npx --yes wrangler@4.136.3 deploy
```

Recommended Cloudflare build variables:

| Variable | Suggested value | Purpose |
|----------|-----------------|----------|
| `NODE_VERSION` | `22` or `22.23.2` | Pin Node 22.x |
| `PNPM_VERSION` | `10.11.1` | Match `packageManager` |
| `SKIP_WARRANTY_GOLDEN` | `1` | Static host: no live Supabase golden |
| `SKIP_DEPENDENCY_INSTALL` | (optional) | CF may set; user command still runs `pnpm install` |

**Do not** put `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare build env. Static assets must never see privileged keys.

## Environment rules for verifiers

| Check type | Cloudflare Workers Build | GitHub Actions |
|------------|--------------------------|----------------|
| File / syntax / wiring | Required | Required |
| Live Supabase RPC | Offline fixture or skip | Live with repo secrets |
| `CI=true` without secrets | **Must pass** (offline) | Fail only if secrets are expected (`GITHUB_ACTIONS`) |

### Forbidden patterns

```js
// BAD — breaks Cloudflare (CI=true, no secrets)
if (missingEnv.length && process.env.CI) process.exit(1);

// BAD — after Vercel retirement
readRequired('vercel.json');

// BAD — local wrangler / workerd on Workers Builds
// "devDependencies": { "wrangler": "4.x" }

// GOOD — static hosts
if (missingEnv.length) runOffline();

// GOOD — GitHub Actions only for live DB gates
if (missingEnv.length && process.env.GITHUB_ACTIONS) process.exit(1);

// GOOD — deploy without local workerd install
// npx --yes wrangler@4.136.3 deploy
```

## Before changing verifiers or build-production.js

```bash
node --check scripts/verify-production.js
node --check scripts/verify-dual-warranty-routing.js
node --check scripts/verify-warranty-contract.js
node --check scripts/build-production.js
npm run build   # local once after meaningful verifier edits
```

## After every production deploy

1. Open https://sdlg-warranty-backup.esahuda9900.workers.dev — expect HTTP 200 + login shell.
2. Optional: run workflow **Production Smoke Check**.
3. If smoke reports mismatch, fix before shipping product changes — do not silence the gate.

## Host retirement checklist (any future host)

- [ ] Delete host config file from repo
- [ ] Remove every `readRequired` / assert that demanded that file
- [ ] Remove CI steps that hit that host
- [ ] Update docs (`DEPLOYMENT.md`, `CURRENT_STATUS.md`, this file)
- [ ] Disconnect project in the vendor dashboard

## Related issues

- #12 — Authenticated E2E (product release gate, not deploy gate)
- #32 — Live build mismatch (re-run smoke after deploy recovery; close if green)
- 2026-09-24 — workerd 502 from local wrangler install on CF Builds
