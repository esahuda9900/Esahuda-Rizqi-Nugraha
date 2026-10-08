# SDLG Warranty Claim — Security Baseline

Last updated: 2026-10-08

## Boundaries

1. Never expose Supabase `service_role` to the browser or git history.
2. RLS is the authorization boundary; UI role checks are convenience only.
3. Domain warranty logic lives in `public.sdlg_warranty_resolve_claim` (SECURITY INVOKER).
4. Claim write path uses intentional SECURITY DEFINER RPCs with **body-level** role checks (`private_is_warranty_claim_writer` / equivalent). Do not convert these to INVOKER without a full client rewrite.
5. The browser may embed the **publishable/anon** key only. That key is not a secret; protection is Auth + RLS + closed signup.

## Public repo posture

This repository may be public for GitHub Pages. Treat it as **source-visible**:

- Do not commit `.env`, service role keys, or production passwords.
- Prefer making the repo **private** if business logic / runbooks must stay internal.
- Publishable key + project ref in client bundles is expected for a static SPA.

## Role model (`app_user_roles`)

| Role | Typical access |
|------|----------------|
| `admin` | Full read/write |
| `warranty_admin` | Claim + master write paths |
| `viewer` | Global read |
| `branch_user` | Claims for own `branch_id`; machines for own branch + unassigned |

Users with Auth but **no** active `app_user_roles` row must not read master data.

## Intentional SECURITY DEFINER RPCs

| RPC | Why DEFINER |
|-----|-------------|
| `create_sdlg_claim` / `update_sdlg_claim` | Controlled write + role check |
| `resolve_sdlg_claim_context` | Enrich claim context |
| `sdlg_resolve_or_create_customer` | Master resolve/create |
| `sdlg_resolve_or_create_branch` | Branch resolve/create + optional unit stamp |

Advisor WARN on DEFINER executable by `authenticated` is **expected**. Authorization remains inside the function via `private_is_warranty_claim_writer()` (`admin` / `warranty_admin` only) where applicable.

## 2026-10-08 hardening

Migration `security_harden_rls_and_grants_20261008`:

| Change | Detail |
|--------|--------|
| `REVOKE` from `anon` | All tables, sequences, functions in `public` |
| Machines SELECT | Global roles: all rows; `branch_user`: own `branch_id` + `branch_id IS NULL` |
| Customers / branches SELECT | Requires `private_has_active_app_role()` |
| RPC EXECUTE | Explicit `GRANT` to `authenticated` for resolve/create helpers |

## Free-tier monitoring

- View `public.free_tier_db_health` — size / growth snapshot (see `FREE_TIER.md`).
- Prefer password length ≥ 12, **no public self-signup**, closed user set via `app_user_roles`.
- Leaked Password Protection = Pro only → skip on free tier.

```sql
SELECT * FROM public.free_tier_db_health;
```

## Checklist after DDL

1. Re-run Supabase Security Advisors.
2. Confirm no new `rls_enabled_no_policy`.
3. Prefer `security_invoker` on new views unless a documented DEFINER reason exists.
4. Confirm `anon` still has zero table grants in `public`.
5. Smoke login as `admin` and (if used) `branch_user` after RLS changes.

## Operator actions outside git

1. Supabase Dashboard → Authentication → Providers: disable public signup if enabled.
2. GitHub → Settings → General → Danger zone: set repository to **Private** when Pages is no longer required on this repo (or split public docs vs private app).
3. Rotate publishable key only if it was ever paired with a leaked `service_role`.
