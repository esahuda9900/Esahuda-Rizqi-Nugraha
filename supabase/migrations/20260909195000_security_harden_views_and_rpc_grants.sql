-- Security hardening:
-- 1) make claim/business views SECURITY INVOKER so underlying RLS applies to caller
-- 2) remove anonymous access to internal claim views
-- 3) restrict application RPC execution to authenticated users

alter view public.claim_workflow_v set (security_invoker = true);
alter view public.claim_action_center_v set (security_invoker = true);
alter view public.claim_warranty_policy_v set (security_invoker = true);
alter view public.claim_warranty_policy_matrix_v set (security_invoker = true);

revoke all on table public.claim_workflow_v from anon;
revoke all on table public.claim_action_center_v from anon;
revoke all on table public.claim_warranty_policy_v from anon;
revoke all on table public.claim_warranty_policy_matrix_v from anon;

do $$
begin
  revoke execute on function public.sdlg_policy_runtime_rules(text[]) from public, anon;
  revoke execute on function public.sdlg_warranty_policy_matrix(text,text,text,boolean,date,date,date,date,numeric) from public, anon;
  revoke execute on function public.create_sdlg_claim(jsonb,jsonb) from public, anon;
  revoke execute on function public.delete_sdlg_claim(text) from public, anon;
  revoke execute on function public.update_claim_status(text,text,date,text) from public, anon;
  revoke execute on function public.update_claim_status_atomic(text,text,date,text) from public, anon;
  revoke execute on function public.update_claim_status_batch(text[],text,date,text) from public, anon;
  revoke execute on function public.update_sdlg_claim(text,jsonb,jsonb) from public, anon;

  grant execute on function public.sdlg_policy_runtime_rules(text[]) to authenticated;
  grant execute on function public.sdlg_warranty_policy_matrix(text,text,text,boolean,date,date,date,date,numeric) to authenticated;
  grant execute on function public.create_sdlg_claim(jsonb,jsonb) to authenticated;
  grant execute on function public.delete_sdlg_claim(text) to authenticated;
  grant execute on function public.update_claim_status(text,text,date,text) to authenticated;
  grant execute on function public.update_claim_status_atomic(text,text,date,text) to authenticated;
  grant execute on function public.update_claim_status_batch(text[],text,date,text) to authenticated;
  grant execute on function public.update_sdlg_claim(text,jsonb,jsonb) to authenticated;
end $$;
