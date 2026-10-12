-- RLS helpers must stay callable by signed-in users (policies run as them)
-- but must not be exposed on /rest/v1/rpc. Move them to schema private,
-- which PostgREST does not publish.
-- Intentional app RPCs (create/update/resolve claim, resolve branch) stay in
-- public: each one already rejects callers who are not warranty writers.

drop policy if exists read_machines on public.machines;
create policy read_machines on public.machines
  for select
  to authenticated
  using (
    private_is_global_reader()
    or exists (
      select 1
      from public.app_user_roles aur
      where aur.user_id = (select auth.uid())
        and aur.is_active is true
        and aur.role = 'branch_user'
        and (aur.branch_id = machines.branch_id or machines.branch_id is null)
    )
  );

alter function public.private_has_active_app_role() set schema private;
alter function public.private_is_global_reader() set schema private;

revoke all on function private.private_has_active_app_role() from public, anon;
revoke all on function private.private_is_global_reader() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.private_has_active_app_role() to authenticated;
grant execute on function private.private_is_global_reader() to authenticated;

-- schema usage must not suddenly expose the admin probe
revoke all on function private.is_admin() from public, anon, authenticated;
