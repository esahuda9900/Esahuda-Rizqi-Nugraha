# SDLG Warranty Claim — Operator Runbook

Last updated: 2026-09-23 (expert pass — Vercel retired)

Minimal knowledge-transfer document so the system is not locked in one person’s head.

## 1. What this system is
Internal Warranty Command Center for SDLG claims.
Replaces Excel tracking. Database (Supabase) is the system of record for data, authorization, and warranty eligibility.

## 2. Where is production?

| What | Where |
|------|--------|
| **App URL (sole production)** | https://sdlg-warranty-backup.esahuda9900.workers.dev |
| Source code | GitHub `esahuda9900/sdlg-warranty-backup` branch `main` |
| Database / Auth | Supabase project `frqvelcreczmnofldrga` |
| Canonical warranty RPC | `public.sdlg_warranty_resolve_claim(claim_id)` |

Always use the **Cloudflare** URL for daily work and for smoke checks after deploy.

## 3. Who can do what
Roles live in `public.app_user_roles`:
- `admin` / `warranty_admin` — can create/update/delete claims and change status (via SECURITY DEFINER RPCs)
- `viewer` — read active claims
- `branch_user` — branch-scoped access

UI role checks are convenience only. **Database RLS + RPC body checks are authoritative.**

## 4. Daily operator checks (5 minutes)
1. Open **Cloudflare** production URL → login works.
2. Claims list loads, newest first (Dealer Claim Date → Claim Date → Input Date).
3. Optional SQL (authenticated):
   ```sql
   SELECT * FROM public.free_tier_db_health;
   ```
4. If something looks wrong: note claim_id + symptom; do not bulk-edit status without workflow rules.

## 5. How to ship a safe change
1. Smallest fix on a clear root cause.
2. Prefer `modules/*.js` — **do not add new `apply-*.js` injectors**.
3. Run local verify when possible: `npm run verify` (or the individual verify scripts).
4. Push to `main` → wait for Cloudflare deploy.
5. Smoke: open Cloudflare URL, login, open Claims + one known claim (e.g. golden `0231-2026-SDLG-PFR`).
6. Record commit SHA and result.

## 6. Authenticated E2E (release certification)
Scaffold is ready: `scripts/browser-e2e-auth.js` / `npm run browser:e2e-auth`.

To activate in CI:
1. Create a **dedicated non-production** Supabase Auth user (not a real operator account).
2. Add GitHub Actions secrets: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.
3. Production smoke will run the auth E2E step automatically (currently non-blocking until the journey is expanded and trusted).

Tracking: GitHub issue #12.

## 7. Known intentional warnings
Supabase Security Advisors warn about SECURITY DEFINER functions executable by `authenticated`.
**This is intentional** for claim write RPCs. Authorization is inside the function via `private_is_warranty_claim_writer()`.
Do **not** revoke those grants without a full client rewrite. See `SECURITY.md`.

## 8. Incident: production looks broken
1. Confirm you are on the Cloudflare URL.
2. Identify last known-good Git commit from history / previous smoke.
3. Prefer rollback to last good commit over stacking another speculative patch.
4. Database issues: check RLS / RPC grants; do not disable RLS to “make it work”.
5. Parser / Gemini down: claim CRUD must still work without the parser.

## 9. Incident: free-tier size pressure
Follow `AUDIT_LOG_RETENTION.md`. Never truncate audit log without export + approval.

## 10. Golden test claim (warranty engine)
- Claim ID: `0231-2026-SDLG-PFR`
- Expected: overall ELIGIBLE / machine IN_WARRANTY / component IN_WARRANTY
- Tier: Contract Customer; component Fuel Tank; Other parts; 18 months / 3000 hours

If this claim resolves differently, stop and investigate the resolver — do not paper over in the frontend.

## 11. Key docs map
| Doc | Use when |
|-----|----------|
| `BUSINESS_RULES.md` | Claim ID, dates, currency, workflow meaning |
| `SECURITY.md` | RLS, DEFINER RPCs, what not to “fix” |
| `DEPLOYMENT.md` | Build chain, release discipline |
| `RELEASE_READINESS.md` | Current gates and remaining blockers |
| `INJECTOR_ROADMAP.md` | Safe path to shrink injectors |
| `FREE_TIER.md` | Size limits and hygiene |
| `AUDIT_LOG_RETENTION.md` | Audit growth plan |
| `DATA_QUALITY.md` | Integrity checks snapshot |

## 12. Adding a second user
1. Create Auth user in Supabase (no public signup).
2. Insert/update `app_user_roles` with correct role and `is_active = true`.
3. Password min length ≥ 12; unique strong password; no shared accounts.
4. Verify they can login and only see what their role allows.
