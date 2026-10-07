# SDLG Warranty Claim — Security Baseline

Last updated: 2026-09-30

## Boundaries

1. Never expose Supabase `service_role` to the browser.
2. RLS is the authorization boundary; UI role checks are convenience only.
3. Domain warranty logic lives in `public.sdlg_warranty_resolve_claim` (SECURITY INVOKER).
4. Claim write path uses intentional SECURITY DEFINER RPCs with **body-level** role checks (`private_is_warranty_claim_writer` / equivalent). Do not convert these to INVOKER without a full client rewrite.

## Intentional SECURITY DEFINER RPCs

| RPC | Why DEFINER |
|-----|-------------|
| `create_sdlg_claim` | Controlled insert with role + validation |
| `update_sdlg_claim` | Controlled update with role + validation |
| Related status/delete writers | Same pattern |

**This is intentional.** Advisor WARN `authenticated_security_definer_function_executable` on these is **expected**. Revoking EXECUTE would break the app. Authorization remains inside the function via `private_is_warranty_claim_writer()` (`admin` / `warranty_admin` only).

## Free-tier monitoring

- View `public.free_tier_db_health` — size / growth snapshot for the free-tier DB budget (see `FREE_TIER.md`).
- Prefer password length ≥ 12, no public self-signup, closed user set via `app_user_roles`.
- Leaked Password Protection = Pro only → skip.

Quick size check:

```sql
SELECT * FROM public.free_tier_db_health;
```

## 2026-09-29 hardening

Migration `harden_rls_policies_and_security_invoker_views`:

| Object | Change |
|--------|--------|
| `ax_warranty_work_order_costs` | RLS SELECT for `authenticated` (was RLS-on, zero policies) |
| `ops_incident_lessons` | GRANT SELECT + RLS SELECT for `authenticated` |
| `ops_active_playbooks_v` | `security_invoker = true` |
| `claim_unmatched_wo_queue_v` | `security_invoker = true` |

## Checklist after DDL

1. Re-run Supabase Security Advisors.
2. Confirm no new `rls_enabled_no_policy`.
3. Prefer `security_invoker` on new views unless a documented DEFINER reason exists.
