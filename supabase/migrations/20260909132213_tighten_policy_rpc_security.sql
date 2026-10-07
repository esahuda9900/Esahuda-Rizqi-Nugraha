-- Policy RPCs are read-only and do not need elevated privileges.
-- SECURITY INVOKER ensures caller privileges and RLS apply normally.

alter function public.sdlg_policy_runtime_rules(text[])
  security invoker;

alter function public.sdlg_warranty_policy_matrix(
  text,text,text,boolean,date,date,date,date,numeric
)
  security invoker;

revoke execute on function public.sdlg_policy_runtime_rules(text[]) from public, anon;
grant execute on function public.sdlg_policy_runtime_rules(text[]) to authenticated;

revoke execute on function public.sdlg_warranty_policy_matrix(text,text,text,boolean,date,date,date,date,numeric) from public, anon;
grant execute on function public.sdlg_warranty_policy_matrix(text,text,text,boolean,date,date,date,date,numeric) to authenticated;
