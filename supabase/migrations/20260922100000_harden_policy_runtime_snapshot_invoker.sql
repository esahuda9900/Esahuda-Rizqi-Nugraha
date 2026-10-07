-- Harden the policy runtime snapshot RPC.
-- It only reads tables that already grant SELECT to authenticated, so it does
-- not need SECURITY DEFINER privilege escalation.
create or replace function public.sdlg_policy_runtime_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'service_policy_rules', coalesce((select jsonb_agg(to_jsonb(x)) from public.service_policy_rules x), '[]'::jsonb),
    'service_policy_warranty_rules', coalesce((select jsonb_agg(to_jsonb(x)) from public.service_policy_warranty_rules x), '[]'::jsonb)
  );
$function$;

revoke execute on function public.sdlg_policy_runtime_snapshot() from anon;
grant execute on function public.sdlg_policy_runtime_snapshot() to authenticated;
grant execute on function public.sdlg_policy_runtime_snapshot() to service_role;
