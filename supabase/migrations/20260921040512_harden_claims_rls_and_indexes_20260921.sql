-- Harden claims RLS by removing legacy permissive policies that bypass role-based access.
-- Keep the canonical role-aware policies as the single access-control path.
drop policy if exists "Allow read access to claims" on public.claims;
drop policy if exists "Allow insert access to claims" on public.claims;
drop policy if exists "Allow update access to claims" on public.claims;

-- Cover branch-scoped app_user_roles lookups used by claims RLS.
create index if not exists idx_app_user_roles_branch_id
  on public.app_user_roles (branch_id);

-- Remove one duplicate status index; idx_claims_status remains as the canonical status index.
drop index if exists public.idx_claims_claim_status;
