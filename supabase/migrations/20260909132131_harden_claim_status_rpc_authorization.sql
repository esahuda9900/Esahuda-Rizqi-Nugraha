-- Harden claim status RPC authorization.
-- Keep the atomic status transition privileged, but require an authenticated
-- warranty writer/admin before any row can be changed.

create or replace function public.update_claim_status_atomic(
  p_claim_id text,
  p_status text,
  p_status_date date,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_old_status text;
  v_input_date date;
  v_archived timestamptz;
  v_reason text := nullif(trim(p_reason), '');
begin
  if not public.private_is_warranty_claim_writer() then
    raise exception 'Akses ditolak' using errcode='42501';
  end if;

  if p_status is null or not exists (
    select 1
    from public.claims c
    where c.claim_id = p_claim_id
      and c.archived_at is null
  ) then
    raise exception 'Claim tidak ditemukan atau status tidak valid';
  end if;

  select c.claim_status, c.input_date, c.archived_at
    into v_old_status, v_input_date, v_archived
  from public.claims c
  where c.claim_id = p_claim_id
    and c.archived_at is null
  for update;

  if v_old_status is null then
    v_old_status := 'Draft';
  end if;

  if p_status_date is null then
    raise exception 'Tanggal status wajib diisi';
  end if;

  if p_status_date > current_date then
    raise exception 'Tanggal status tidak boleh di masa depan';
  end if;

  if v_input_date is not null and p_status_date < v_input_date then
    raise exception 'Tanggal status tidak boleh sebelum Input Date';
  end if;

  if p_status = 'Rejected' and v_reason is null then
    raise exception 'Alasan reject wajib diisi';
  end if;

  if p_status = v_old_status then
    return;
  end if;

  if not exists (
    select 1
    from public.claim_workflow_transitions t
    where t.from_status = v_old_status
      and t.to_status = p_status
  ) then
    raise exception 'Transisi status tidak diizinkan: % -> %', v_old_status, p_status using errcode='P0001';
  end if;

  update public.claims
  set claim_status = p_status,
      status_date = p_status_date,
      status_update_reason = v_reason,
      last_updated = now()
  where claim_id = p_claim_id
    and archived_at is null;

  insert into public.claim_status_history(claim_id,status,status_date,reason)
  values (p_claim_id,p_status,p_status_date,v_reason);
end;
$$;

revoke execute on function public.update_claim_status_atomic(text,text,date,text) from public, anon;
grant execute on function public.update_claim_status_atomic(text,text,date,text) to authenticated;
