create or replace function public.set_wo_followup_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
begin
  new.updated_at = pg_catalog.now();
  if auth.uid() is not null then new.updated_by = auth.uid(); end if;
  return new;
end;
$$;

revoke execute on function public.set_wo_followup_updated_at() from public, anon, authenticated;
