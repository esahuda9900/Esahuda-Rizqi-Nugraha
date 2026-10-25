# SDLG Warranty Operations workspace

React + TypeScript frontend using the existing Supabase Auth, Postgres/RLS, and claim RPCs. GitHub Pages hosts static assets. This remains the parallel application under `/Esahuda-Rizqi-Nugraha/preview/`; no production cutover is authorized.

## Screens
- Login with session recovery and bounded waits; logout; access-error and render-error recovery.
- Overview with status distribution and recent claims from the current account's permitted data. Summary currently capped at 2,000 recent active claims and labeled when the cap is reached.
- Existing monitoring/detail, TSI paste parser, SDLG copy helper, masters, Unit 360, data-quality, exports, and Admin Center remain available.
- Navigation follows account role. Database RLS/RPC authorization remains authoritative.

## Development and checks
```sh
npm ci
npm test
npm run build
npm run dev
```
Default Vite base is the preview subpath. `VITE_BASE` can be set explicitly for local development. Public Supabase URL and anon key can be configured through `.env` (see `.env.example`). Never add server secrets or service-role keys.

`npm test` exercises the actual React app in a simulated DOM under StrictMode, with a fixture backend: anonymous login, invalid credentials, failed/retried session initialization, dashboard rendering, viewer navigation, logout, deadlines and cancellation. It does not contact production or prove real credentials, RLS, or claim-write behavior. Node 22+ recommended.

## Release validation still required
- Real-browser visual checks at desktop and phone sizes.
- Sign in with a permitted test account, refresh with an existing session, logout and switch accounts.
- Verify dashboard/list/detail reads through actual RLS.
- Test parsing/save/status updates against staging before claiming write readiness.
- Owner review of the PR before merge. Keep the legacy application at root.

No database schema, RLS, role, credential, or business data changes are included in this update.
