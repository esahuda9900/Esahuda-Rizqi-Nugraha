# SESSION_STATE — 2026-10-26

## Production baseline
- Main production remains the legacy index.html -> app.html application.
- Login freeze repaired and deployed through PRs #10/#11/#13 (baseline commit 9770389). Owner confirmed the error is gone.
- Owner requested upgrades to MAIN production only; preview PR #12 is HOLD. No cutover.

## Current stability upgrade
- Preserve stored sessions on getSession timeout/offline/refresh failures. Scope explicit token recovery to this Supabase project.
- API 401 triggers session revalidation instead of erasing all Supabase tokens or forcing sign-out.
- Defer session-ready/profile query work until the auth callback returns. Ignore obsolete session/profile responses and cancel deferred work on unmount.
- Bound login/profile/logout waits; surface actual connection errors; failed logout does not claim success.
- Bound claims list loading; ignore obsolete responses after a newer load or logout. Keep the existing retry/error UI.
- Version singleton/registry/guard URLs and the index-to-app redirect so existing browser caches receive the update.
- No schema/RLS/role/business data changes. No mutation retries added.

## Validation before merge
- PASS: login freeze + entrypoint cache regression.
- PASS: session resilience (timeout/offline/refresh rejection, other-project token isolation, stale auth responses, deferred events, API 401).
- PASS: actual legacy auth-effect/profile tests (latest auth event wins, defer queries, unmount cleanup, stale role rejection).
- PASS: actual claims-loader tests (latest request wins, logout invalidation, deadlines, timeout error state).
- PASS: syntax of all 67 modules and both entrypoints' inline scripts.
- PASS: Pages preparation, legacy contract, singleton module contract, no-cutover guard and diff whitespace checks.
- These tests use simulated APIs/timers, not real credentials or production writes. Real-account authenticated end-to-end tests and staging save/status tests remain outstanding.

## Backend health and remaining work
- Supabase project ACTIVE_HEALTHY. Existing security advisor warnings for security-definer RPCs and password protection remain for separate review; this release does not change authorization.
- Backup workflow previously failed; a successful restore test has not been established. Do not claim backup/restore readiness.
- This release is session/read stability, not completion of all full-stack hardening. Save/update/idempotency and claim-detail A/B race audits remain separate tasks.
