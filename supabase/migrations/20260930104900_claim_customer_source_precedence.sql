-- Claim customer precedence hardening.
-- Transactional claim customer follows explicit form/source evidence.
-- Machine master customer remains attached to machine_id and is preserved in provenance.

CREATE OR REPLACE FUNCTION public.create_sdlg_claim(
  p_claim jsonb,
  p_status_history jsonb DEFAULT '[]'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  y integer := extract(year from current_date)::integer;
  n integer := 0;
  candidate text;
  payload jsonb;
  inserted_id text;
  h jsonb;
  hdate date;
  hstatus text;
  requested_id uuid;
  existing_claim_id text;
  max_n integer;
  ctx jsonb;
  v_customer_id uuid;
  v_customer_name text;
  v_source_customer_name text;
  v_source_customer_confidence text;
  v_branch_id uuid;
  v_branch_name text;
  v_machine_id uuid;
  v_active boolean;
  v_survivor uuid;
  v_survivor_name text;
begin
  if not public.private_is_warranty_claim_writer() then
    raise exception 'Akses ditolak' using errcode='42501';
  end if;

  requested_id := nullif(trim(coalesce(p_claim->>'id','')), '')::uuid;
  if requested_id is not null then
    select claim_id into existing_claim_id
    from public.claims
    where id=requested_id and archived_at is null
    limit 1;
    if existing_claim_id is not null then
      return existing_claim_id;
    end if;
  end if;

  if nullif(trim(coalesce(p_claim->>'dealer_claim_no','')), '') is not null then
    if exists (
      select 1 from public.claims c
      where c.archived_at is null
        and lower(trim(coalesce(c.dealer_claim_no,''))) = lower(trim(p_claim->>'dealer_claim_no'))
    ) then
      raise exception 'Dealer Claim No. sudah digunakan oleh claim aktif.' using errcode='23505';
    end if;
  end if;

  ctx := public.resolve_sdlg_claim_context(coalesce(p_claim,'{}'::jsonb));

  v_machine_id := coalesce(nullif(p_claim->>'machine_id','')::uuid, nullif(ctx->>'machine_id','')::uuid);
  v_source_customer_name := nullif(trim(coalesce(
    p_claim->>'source_customer_name',
    p_claim->>'sourceCustomerName',
    substring((p_claim->'source_fields'->>'provenance') from '"customer"\\s*:\\s*\\{\\s*"value"\\s*:\\s*"([^"]*)"'),
    ''
  )), '');

  if v_source_customer_name is not null then
    v_customer_id := public.sdlg_resolve_or_create_customer(v_source_customer_name, null);
    if v_customer_id is not null then
      select customer_name into v_customer_name from public.customers where id = v_customer_id;
    else
      v_customer_name := v_source_customer_name;
    end if;
    v_source_customer_confidence := case when v_customer_id is not null then 'HIGH' else 'UNRESOLVED' end;
  else
    v_customer_id := coalesce(nullif(p_claim->>'customer_id','')::uuid, nullif(ctx->>'customer_id','')::uuid);
    v_customer_name := coalesce(nullif(trim(p_claim->>'customer'),''), nullif(trim(ctx->>'customer_name'),''));
    v_source_customer_confidence := case when v_customer_id is not null then 'MASTER_OR_CLIENT' else 'UNRESOLVED' end;
  end if;

  v_branch_id := coalesce(nullif(p_claim->>'branch_id','')::uuid, nullif(ctx->>'branch_id','')::uuid);
  v_branch_name := coalesce(nullif(trim(p_claim->>'branch'),''), nullif(trim(ctx->>'branch_name'),''));

  if v_customer_id is not null then
    select c.is_active into v_active from public.customers c where c.id = v_customer_id;
    if v_active is distinct from true then
      select s.id, s.customer_name
        into v_survivor, v_survivor_name
      from public.customers inactive
      join public.customer_aliases ca
        on public.sdlg_normalize_customer_name(ca.alias_name) = public.sdlg_normalize_customer_name(inactive.customer_name)
        or public.sdlg_normalize_customer_name(ca.alias_normalized) = public.sdlg_normalize_customer_name(inactive.customer_name)
      join public.customers s on s.id = ca.customer_id and s.is_active = true
      where inactive.id = v_customer_id
      limit 1;
      if v_survivor is not null then
        v_customer_id := v_survivor;
        v_customer_name := coalesce(v_survivor_name, v_customer_name);
      else
        v_customer_id := null;
      end if;
    end if;
  end if;

  if v_customer_id is null and v_customer_name is not null then
    v_customer_id := public.sdlg_resolve_or_create_customer(v_customer_name, null);
    if v_customer_id is not null then
      select customer_name into v_customer_name from public.customers where id = v_customer_id;
    end if;
  end if;

  insert into public.claim_number_counters(year,last_number,updated_at)
  values (y,0,now())
  on conflict (year) do nothing;

  perform 1 from public.claim_number_counters c
  where c.year = y
  for update;

  select coalesce(max(split_part(cl.claim_id,'-',1)::integer),0)
    into max_n
  from public.claims cl
  where split_part(cl.claim_id,'-',2) = y::text
    and cl.claim_id like '%-SDLG-PFR'
    and split_part(cl.claim_id,'-',1) ~ '^[0-9]+$';

  select gs into n
  from generate_series(1, greatest(max_n + 1, 1)) gs
  where not exists (
    select 1
    from public.claims cl
    where split_part(cl.claim_id,'-',2) = y::text
      and cl.claim_id like '%-SDLG-PFR'
      and split_part(cl.claim_id,'-',1) ~ '^[0-9]+$'
      and split_part(cl.claim_id,'-',1)::integer = gs
  )
  order by gs
  limit 1;

  if n is null then
    n := max_n + 1;
  end if;

  for n in n..n+100 loop
    candidate := lpad(n::text,4,'0') || '-' || y::text || '-SDLG-PFR';

    payload := (coalesce(p_claim,'{}'::jsonb) - 'claim_id') || jsonb_build_object(
      'id', coalesce(requested_id, gen_random_uuid()),
      'claim_id', candidate,
      'created_at', coalesce(p_claim->'created_at', to_jsonb(clock_timestamp())),
      'last_updated', coalesce(p_claim->'last_updated', to_jsonb(clock_timestamp())),
      'input_date', coalesce(p_claim->'input_date', to_jsonb(current_date)),
      'status_date', coalesce(p_claim->'status_date', to_jsonb(current_date)),
      'machine_id', v_machine_id,
      'customer_id', v_customer_id,
      'branch_id', v_branch_id,
      'model_id', coalesce(nullif(p_claim->>'model_id','')::uuid, null),
      'customer', v_customer_name,
      'branch', v_branch_name,
      'source_provenance', coalesce(p_claim->'source_provenance','{}'::jsonb) || jsonb_build_object(
        'customer', jsonb_build_object(
          'source_name', v_source_customer_name,
          'resolved_customer_id', v_customer_id,
          'resolution', case when v_source_customer_name is not null then 'CLAIM_SOURCE' else 'EXISTING_CONTEXT' end,
          'confidence', v_source_customer_confidence
        ),
        'machine_customer_id', nullif(ctx->>'customer_id','')
      )
    );

    begin
      execute 'insert into public.claims select * from jsonb_populate_record(null::public.claims, $1)'
        using payload;
      inserted_id := candidate;

      if jsonb_typeof(coalesce(p_status_history,'[]'::jsonb)) = 'array' then
        for h in select value from jsonb_array_elements(coalesce(p_status_history,'[]'::jsonb)) loop
          hstatus := nullif(trim(coalesce(h->>'status','')), '');
          hdate := nullif(h->>'date','')::date;
          if hstatus is not null then
            perform public.update_claim_status(
              candidate,
              hstatus,
              coalesce(hdate, coalesce(p_claim->>'status_date', current_date::text)::date),
              nullif(trim(coalesce(h->>'reason','')), '')
            );
          end if;
        end loop;
      end if;

      update public.claim_number_counters
      set last_number = n, updated_at = clock_timestamp()
      where year = y;
      return inserted_id;
    exception when unique_violation then
      continue;
    end;
  end loop;

  raise exception 'Tidak dapat membuat nomor claim setelah 100 percobaan.';
end;
$function$;
