# SDLG Warranty Claim — Release Readiness

Last updated: 2026-09-29 16:58 WIB

## Production (verified live)

**URL:** https://sdlg-warranty-backup.esahuda9900.workers.dev  
**Stack:** Cloudflare Workers assets + Supabase (`frqvelcreczmnofldrga`)

| Gate | Status |
|------|--------|
| policy-runtime-fix **v3** live | ✅ |
| Login warranty_admin → **Policy: DB Verified** | ✅ (manual + browser expert 2026-09-24) |
| No Policy Runtime Degraded banner | ✅ |
| Claims list / nav operational | ✅ |
| Anonymous claims / policy RLS | ✅ (curl smoke) |
| Cloudflare deploy (Workers Builds / wrangler) | ✅ |
| Branch unit-only (no indent inference in live HTML) | ✅ verified 2026-09-29 (`Branch diinfer` count = 0) |
| Auth E2E in GitHub Actions | ⚪ optional enhancement (not a release blocker) |

## Issue #12 — closed

**Closed 2026-09-29** as completed under **operator-accepted live expert verification**.

Product journey proven live: login → claims → Policy DB Verified → operational paths.

CI browser auth job may remain `continue-on-error` until runners reliably install Playwright. Scaffold stays at `scripts/browser-e2e-auth.js`. Future work: dedicated non-production test user + `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` secrets only.

## Definition of done (ops) — met for internal release

- [x] Production serves latest `main` modules
- [x] Policy source = database / runtimeStatus verified after auth
- [x] RLS holds on claims and policy tables
- [x] Branch resolution = unit/serial only (indent path stripped + runtime guard)
- [ ] Automated auth E2E (optional / later)
