-- The application calls this policy-runtime snapshot after authentication.
-- Keep anonymous callers blocked, while allowing authenticated operators to read
-- the SECURITY DEFINER snapshot of the policy repository.
revoke execute on function public.sdlg_policy_runtime_snapshot() from anon;
grant execute on function public.sdlg_policy_runtime_snapshot() to authenticated;
grant execute on function public.sdlg_policy_runtime_snapshot() to service_role;
