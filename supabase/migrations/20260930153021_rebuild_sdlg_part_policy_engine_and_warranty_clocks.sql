-- 20260930210000_rebuild_sdlg_part_policy_engine_and_warranty_clocks.sql
-- Rebuild component classification around exact part identity.
-- Source baseline: public.service_policy_documents -> 2026 Service Policy.
-- Scope: current active warranty families (Excavator, Loader, Road Machinery),
-- plus policy metadata for future Electric/Qingzhou/EA scopes.
--
-- Design:
--   1) sdlg_policy_part_master = authoritative part -> policy classification.
--   2) Narrative taxonomy is no longer allowed to decide component category.
--   3) Consumable/not-covered is first-class.
--   4) B/L caps are explicit policy data; no universal "+6 months" assumption.
--   5) Sales and B/L clocks are calculated independently; effective expiry is the earlier expiry.
--   6) Failure before B/L is a date anomaly.
--   7) Ambiguous wear/seal/hose classifications remain review-required rather than being guessed.

create table if not exists public.sdlg_policy_part_master (
  id uuid primary key default gen_random_uuid(),
  part_no text not null,
  product_family text not null,
  machine_coverage_class text not null,
  component_category text,
  policy_variant text,
  manufacturer_scope text,
  classification_basis text not null,
  source_document_id uuid references public.service_policy_documents(id),
  source_section text,
  confidence text not null default 'MEDIUM',
  review_required boolean not null default false,
  review_reason text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (machine_coverage_class in (
    'KEY_COMPONENT',
    'OTHER_WARRANTABLE_PART',
    'CONSUMABLE_NOT_COVERED',
    'SPECIAL_POLICY',
    'UNKNOWN_REQUIRES_REVIEW'
  )),
  check (confidence in ('HIGH','MEDIUM_HIGH','MEDIUM','LOW')),
  check (component_category is null or component_category in (
    'Key components',
    'Other parts',
    'Key critical components',
    'Other components',
    'Other machine components',
    'Chinese-brand main pump/valve',
    'Power battery',
    'Electric motor',
    'HV distribution/controller',
    'Charging station',
    'Transmission housing'
  ))
);

create unique index if not exists uq_sdlg_policy_part_master_part_family
  on public.sdlg_policy_part_master (
    upper(trim(part_no)),
    lower(trim(product_family))
  );

create index if not exists idx_sdlg_policy_part_master_lookup
  on public.sdlg_policy_part_master (
    upper(trim(part_no)),
    lower(trim(product_family)),
    is_active
  );

alter table public.sdlg_policy_part_master enable row level security;

drop policy if exists "Authenticated users can read SDLG part policy master"
  on public.sdlg_policy_part_master;

create policy "Authenticated users can read SDLG part policy master"
  on public.sdlg_policy_part_master
  for select
  to authenticated
  using (true);

grant select on public.sdlg_policy_part_master to authenticated;

alter table public.service_policy_warranty_rules
  add column if not exists bl_cap_mode text not null default 'FIXED_MONTHS';

alter table public.service_policy_warranty_rules
  add column if not exists bl_cap_months numeric;

alter table public.service_policy_warranty_rules
  add column if not exists bl_extension_months numeric;

alter table public.service_policy_warranty_rules
  add column if not exists special_warranty_options jsonb not null default '[]'::jsonb;

alter table public.service_policy_warranty_rules
  drop constraint if exists service_policy_warranty_rules_bl_cap_mode_check;

alter table public.service_policy_warranty_rules
  add constraint service_policy_warranty_rules_bl_cap_mode_check
  check (bl_cap_mode in ('FIXED_MONTHS','WARRANTY_MONTHS_PLUS_EXTENSION'));

update public.service_policy_warranty_rules
set
  bl_cap_mode = 'FIXED_MONTHS',
  bl_cap_months = case
    when product_family in ('Loader','Road Machinery') and lower(component_category) like 'key%' then 30
    when product_family in ('Loader','Road Machinery') and lower(component_category) like 'other%' then 24
    when product_family = 'Excavator' and lower(component_category) = 'key components' then 30
    when product_family = 'Excavator' and lower(component_category) = 'other parts' then 24
    when product_family = 'Qingzhou Loader' and lower(component_category) = 'key components' then 18
    when product_family = 'Qingzhou Loader' and lower(component_category) = 'other components' then 12
    when product_family = 'EA Wheeled Excavator' and lower(component_category) like 'key%' then 30
    when product_family = 'EA Wheeled Excavator' and lower(component_category) like 'other%' then 18
    when product_family = 'Electric Loader' and component_category in ('Power battery','Electric motor') then 66
    when product_family = 'Electric Loader' and component_category in ('HV distribution/controller','Charging station') then 42
    when product_family = 'Electric Loader' and component_category in ('Key critical components','Transmission housing') then 30
    when product_family = 'Electric Loader' and component_category = 'Other machine components' then 24
    when product_family = 'Motor Grader' and lower(component_category) = 'key components' then 30
    when product_family = 'Motor Grader' and lower(component_category) = 'other parts' then 24
    else bl_cap_months
  end,
  bl_extension_months = null,
  special_warranty_options = case
    when product_family = 'Loader'
      and model_scope = 'T >= 7 t'
      and lower(component_category) = 'key components'
      then '[{"months":12,"hours":null,"unlimited_hours":true,"bl_max_months":18,"requires_service_file":true}]'::jsonb
    when product_family = 'Excavator'
      and model_scope = 'T >= 65 t'
      and lower(component_category) = 'key components'
      then '[{"months":12,"hours":null,"unlimited_hours":true,"bl_max_months":18,"requires_service_file":true}]'::jsonb
    when product_family = 'Motor Grader'
      and model_scope = '>=290 hp'
      and lower(component_category) = 'key components'
      then '[{"months":12,"hours":null,"unlimited_hours":true,"bl_max_months":18,"requires_service_file":true}]'::jsonb
    else '[]'::jsonb
  end
where true;

update public.service_policy_warranty_rules
set
  bl_cap_mode = 'WARRANTY_MONTHS_PLUS_EXTENSION',
  bl_cap_months = null,
  bl_extension_months = 6
where product_family = 'Excavator'
  and lower(component_category) = 'chinese-brand main pump/valve';

update public.service_policy_warranty_rules
set notes = case
  when position('Official §2.1.1 label:' in coalesce(notes,'')) > 0 then notes
  else 'Official §2.1.1 label: 6 t≥T >5 t (= 5 < T ≤ 6, includes 6 ton).'
       || coalesce(nullif(' ' || notes,''),'')
end
where product_family = 'Loader'
  and model_scope = '5 t < T <= 6 t';

with source_parts as (
  select upper(trim(part_no)) as part_no, max(trim(part_name)) as part_name
  from public.parts_master
  where is_active = true
    and nullif(trim(part_no),'') is not null
  group by upper(trim(part_no))
  union
  select upper(trim(c.causing_part_no)) as part_no, max(trim(c.causing_part_desc)) as part_name
  from public.claims c
  where c.archived_at is null
    and nullif(trim(c.causing_part_no),'') is not null
  group by upper(trim(c.causing_part_no))
),
families as (
  select 'Excavator'::text as product_family
  union all select 'Loader'
  union all select 'Road Machinery'
)
insert into public.sdlg_policy_part_master
  (part_no,product_family,machine_coverage_class,component_category,policy_variant,
   manufacturer_scope,classification_basis,source_document_id,source_section,confidence,
   review_required,review_reason,notes)
select
  sp.part_no,
  f.product_family,
  case
    when lower(trim(sp.part_name)) in (
      'battery','radio','tire','belt','belt ac','gasket','gasket head',
      'gasket cylinder head','control cable','rotary lamp','rotating lamp',
      'tail light','box fuse','bulb','brush','paint','lock',
      'grease nipple','oil valve'
    ) then 'CONSUMABLE_NOT_COVERED'
    when lower(trim(sp.part_name)) in (
      'sealing ring','sealing ring kit','sealing kit','sealing kit center passage',
      'o-ring','o ring','hose','hose ac','fuel hose'
    ) then 'CONSUMABLE_NOT_COVERED'
    when lower(trim(sp.part_name)) in (
      'friction disc','friction plate','disc brake','break shoe kit',
      'top roller','idler','idler roller','track chain','track chain assembly'
    ) then 'UNKNOWN_REQUIRES_REVIEW'
    else 'OTHER_WARRANTABLE_PART'
  end,
  case
    when lower(trim(sp.part_name)) in (
      'battery','radio','tire','belt','belt ac','gasket','gasket head',
      'gasket cylinder head','control cable','rotary lamp','rotating lamp',
      'tail light','box fuse','bulb','brush','paint','lock',
      'grease nipple','oil valve'
    ) then null
    when lower(trim(sp.part_name)) in (
      'sealing ring','sealing ring kit','sealing kit','sealing kit center passage',
      'o-ring','o ring','hose','hose ac','fuel hose',
      'friction disc','friction plate','disc brake','break shoe kit',
      'top roller','idler','idler roller','track chain','track chain assembly'
    ) then null
    else 'Other parts'
  end,
  null,null,
  case
    when lower(trim(sp.part_name)) in (
      'battery','radio','tire','belt','belt ac','gasket','gasket head',
      'gasket cylinder head','control cable','rotary lamp','rotating lamp',
      'tail light','box fuse','bulb','brush','paint','lock',
      'grease nipple','oil valve'
    ) then 'OFFICIAL_POLICY_EXCLUSION'
    when lower(trim(sp.part_name)) in (
      'sealing ring','sealing ring kit','sealing kit','sealing kit center passage',
      'o-ring','o ring','hose','hose ac','fuel hose'
    ) then 'POLICY_RUBBER_OR_SIMILAR_COMPONENT_REVIEW'
    when lower(trim(sp.part_name)) in (
      'friction disc','friction plate','disc brake','break shoe kit',
      'top roller','idler','idler roller','track chain','track chain assembly'
    ) then 'POLICY_NOT_EXPLICIT_FOR_UNIT_WARRANTY'
    else 'POLICY_RESIDUAL_OTHER_PART'
  end,
  (select d.id from public.service_policy_documents d where d.title='2026 Service Policy' limit 1),
  case
    when lower(trim(sp.part_name)) in (
      'battery','radio','tire','belt','belt ac','gasket','gasket head',
      'gasket cylinder head','control cable','rotary lamp','rotating lamp',
      'tail light','box fuse','bulb','brush','paint','lock',
      'grease nipple','oil valve'
    ) then '§2.1.9'
    when lower(trim(sp.part_name)) in (
      'sealing ring','sealing ring kit','sealing kit','sealing kit center passage',
      'o-ring','o ring','hose','hose ac','fuel hose'
    ) then '§2.1.9 / similar rubber component interpretation'
    when lower(trim(sp.part_name)) in (
      'friction disc','friction plate','disc brake','break shoe kit',
      'top roller','idler','idler roller','track chain','track chain assembly'
    ) then '§2.1.9 / §2.1.11 (unit claim treatment not explicit)'
    else '§2.1.1–§2.1.3'
  end,
  case
    when lower(trim(sp.part_name)) in (
      'battery','radio','tire','belt','belt ac','gasket','gasket head',
      'gasket cylinder head','control cable','rotary lamp','rotating lamp',
      'tail light','box fuse','bulb','brush','paint','lock',
      'grease nipple','oil valve'
    ) then 'HIGH'
    when lower(trim(sp.part_name)) in (
      'sealing ring','sealing ring kit','sealing kit','sealing kit center passage',
      'o-ring','o ring','hose','hose ac','fuel hose'
    ) then 'MEDIUM'
    when lower(trim(sp.part_name)) in (
      'friction disc','friction plate','disc brake','break shoe kit',
      'top roller','idler','idler roller','track chain','track chain assembly'
    ) then 'LOW'
    else 'MEDIUM_HIGH'
  end,
  case when lower(trim(sp.part_name)) in (
    'sealing ring','sealing ring kit','sealing kit','sealing kit center passage',
    'o-ring','o ring','hose','hose ac','fuel hose',
    'friction disc','friction plate','disc brake','break shoe kit',
    'top roller','idler','idler roller','track chain','track chain assembly'
  ) then true else false end,
  case
    when lower(trim(sp.part_name)) in (
      'sealing ring','sealing ring kit','sealing kit','sealing kit center passage',
      'o-ring','o ring','hose','hose ac','fuel hose'
    ) then 'Likely consumable/rubber-type item, but exact material/assembly scope is not explicit in §2.1.9.'
    when lower(trim(sp.part_name)) in (
      'friction disc','friction plate','disc brake','break shoe kit',
      'top roller','idler','idler roller','track chain','track chain assembly'
    ) then 'Wear/replacement-part evidence exists, but the 2026 unit-warranty exclusion is not explicit enough to auto-reject.'
    else null
  end,
  'Seeded from the stored 2026 Service Policy. Family-specific key overrides follow.'
from source_parts sp
cross join families f
on conflict (upper(trim(part_no)),lower(trim(product_family))) do nothing;

with key_map as (
  select 'Excavator' product_family, 'upper frame' part_name, '§2.1.2' source_section
  union all select 'Excavator','lower frame','§2.1.2'
  union all select 'Excavator','boom','§2.1.2'
  union all select 'Excavator','dipstick','§2.1.2'
  union all select 'Excavator','dozer blade','§2.1.2'
  union all select 'Excavator','main pump','§2.1.2'
  union all select 'Excavator','main control valve','§2.1.2'
  union all select 'Excavator','travel motor','§2.1.2'
  union all select 'Excavator','swing motor','§2.1.2'
  union all select 'Excavator','swing bearing','§2.1.2'
  union all select 'Excavator','boom cylinder','§2.1.2'
  union all select 'Excavator','dipstick cylinder','§2.1.2'
  union all select 'Excavator','bucket cylinder','§2.1.2'
  union all select 'Excavator','dozer blade cylinder','§2.1.2'
  union all select 'Excavator','pilot valve','§2.1.2'
  union all select 'Loader','transmission','§2.1.1'
  union all select 'Loader','transmission assembly','§2.1.1'
  union all select 'Loader','torque converter','§2.1.1'
  union all select 'Loader','front frame','§2.1.1'
  union all select 'Loader','rear frame','§2.1.1'
  union all select 'Loader','boom','§2.1.1'
  union all select 'Loader','axle','§2.1.1'
  union all select 'Loader','rear axle assembly','§2.1.1'
  union all select 'Loader','swing arm','§2.1.1'
  union all select 'Loader','structural components','§2.1.1'
  union all select 'Road Machinery','transmission','§2.1.3'
  union all select 'Road Machinery','transmission assembly','§2.1.3'
  union all select 'Road Machinery','axle','§2.1.3'
  union all select 'Road Machinery','rear axle assembly','§2.1.3'
  union all select 'Road Machinery','vibration pump','§2.1.3'
  union all select 'Road Machinery','vibration motor','§2.1.3'
  union all select 'Road Machinery','vibration bearing','§2.1.3'
  union all select 'Road Machinery','travel pump','§2.1.3'
  union all select 'Road Machinery','travel motor','§2.1.3'
  union all select 'Road Machinery','structural components','§2.1.3'
)
insert into public.sdlg_policy_part_master
  (part_no,product_family,machine_coverage_class,component_category,classification_basis,
   source_document_id,source_section,confidence,review_required,notes)
select sp.part_no,k.product_family,'KEY_COMPONENT','Key components',
       'OFFICIAL_POLICY_KEY_COMPONENT',d.id,k.source_section,'HIGH',false,
       'Exact policy-listed key component name or controlled assembly alias.'
from (
  select upper(trim(p.part_no)) part_no, lower(trim(p.part_name)) part_name
  from public.parts_master p where p.is_active=true
  union
  select upper(trim(c.causing_part_no)), lower(trim(c.causing_part_desc))
  from public.claims c
  where c.archived_at is null and nullif(trim(c.causing_part_no),'') is not null
) sp
join key_map k on sp.part_name=k.part_name
cross join lateral (select id from public.service_policy_documents where title='2026 Service Policy' limit 1) d
on conflict (upper(trim(part_no)),lower(trim(product_family))) do update
set machine_coverage_class=excluded.machine_coverage_class,
    component_category=excluded.component_category,
    classification_basis=excluded.classification_basis,
    source_document_id=excluded.source_document_id,
    source_section=excluded.source_section,
    confidence=excluded.confidence,
    review_required=false,
    review_reason=null,
    notes=excluded.notes,
    updated_at=now();

-- Electric Loader exceptions are family-specific. Battery here means the covered
-- power-battery component under §2.1.4, not the general battery exclusion.
insert into public.sdlg_policy_part_master
  (part_no,product_family,machine_coverage_class,component_category,policy_variant,
   classification_basis,source_document_id,source_section,confidence,review_required,notes)
select upper(trim(p.part_no)), 'Electric Loader', 'SPECIAL_POLICY',
       case lower(trim(p.part_name))
         when 'battery' then 'Power battery'
         when 'electric motor' then 'Electric motor'
         when 'charging station' then 'Charging station'
         when 'transmission housing' then 'Transmission housing'
         when 'control unit' then 'HV distribution/controller'
         when 'motor controller' then 'HV distribution/controller'
       end,
       case lower(trim(p.part_name))
         when 'battery' then 'POWER_BATTERY'
         when 'electric motor' then 'ELECTRIC_MOTOR'
         when 'charging station' then 'CHARGING_STATION'
         when 'transmission housing' then 'TRANSMISSION_HOUSING'
         when 'control unit' then 'HV_SYSTEM'
         when 'motor controller' then 'HV_SYSTEM'
       end,
       'OFFICIAL_POLICY_ELECTRIC_LOADER_SPECIFIC',d.id,'§2.1.4','HIGH',false,
       'Specific electric-loader policy takes precedence over general exclusions when explicitly listed.'
from public.parts_master p
cross join lateral (select id from public.service_policy_documents where title='2026 Service Policy' limit 1) d
where p.is_active
  and lower(trim(p.part_name)) in ('battery','electric motor','charging station','transmission housing','control unit','motor controller')
on conflict (upper(trim(part_no)),lower(trim(product_family))) do update
set machine_coverage_class=excluded.machine_coverage_class,
    component_category=excluded.component_category,
    policy_variant=excluded.policy_variant,
    classification_basis=excluded.classification_basis,
    source_document_id=excluded.source_document_id,
    source_section=excluded.source_section,
    confidence=excluded.confidence,
    review_required=false,
    notes=excluded.notes,
    updated_at=now();

create or replace function public.sdlg_warranty_resolve_claim(p_claim_id text)
returns jsonb
language plpgsql
stable
set search_path = public
as $function$
declare
  c record;
  m record;
  r record;
  pp record;
  v_product_family text;
  v_model_scope text;
  v_model_token text;
  v_contract_effective boolean;
  v_tier text;
  v_component_category text;
  v_component_source text := 'UNRESOLVED';
  v_component_confidence text := 'LOW';
  v_component_identity text;
  v_component_identity_source text := 'UNRESOLVED';
  v_component_identity_confidence text := 'LOW';
  v_failure_date date;
  v_failure_hm numeric;
  v_sale_date date;
  v_operation_start_date date;
  v_warranty_phase text;
  v_date_anomaly boolean := false;
  v_component_review_required boolean := false;
  v_component_review_reason text;
  v_machine_any_in boolean := false;
  v_machine_any_out boolean := false;
  v_machine_any_unknown boolean := false;
  v_machine_reason text := 'No warranty policy could be assessed';
  v_component_status text := 'UNKNOWN';
  v_component_reason text := 'Failure component could not yet be resolved to a warranty policy class';
  v_component_rule jsonb := null;
  v_machine_policies jsonb := '[]'::jsonb;
  v_date_ok boolean;
  v_hours_ok boolean;
  v_status text;
  v_reason text;
  v_bl_cap_months numeric;
  v_after_sales_expiry date;
  v_after_departure_expiry date;
  v_effective_expiry date;
  v_months numeric;
  v_hours numeric;
  v_policy_category_match boolean;
  v_marketing_status text := 'REVIEW_REQUIRED';
  v_marketing_reason text := 'Marketing warranty requires a resolved component policy class.';
  v_marketing_months numeric;
  v_marketing_hours numeric;
  v_marketing_expiry date;
  v_marketing_date_ok boolean;
  v_marketing_hours_ok boolean;
  v_final_route text := 'REVIEW_REQUIRED';
  v_final_route_reason text := 'Warranty routing requires component classification.';
  v_expiry_basis text;
  v_part_master_found boolean := false;
begin
  select * into c from public.claims
  where claim_id=p_claim_id and archived_at is null limit 1;

  if not found then
    return jsonb_build_object('status','UNKNOWN','overall_status','UNKNOWN',
      'reason','Claim tidak ditemukan atau sudah diarsipkan','claim_id',p_claim_id);
  end if;

  select * into m from public.machines
  where id=c.machine_id and is_active=true limit 1;

  v_product_family := coalesce(
    nullif(trim(c.policy_product_family),''),
    nullif(trim(m.policy_product_family),''),
    case
      when lower(coalesce(m.product_type,c.model,'')) like '%road roller%' then 'Road Machinery'
      when lower(coalesce(m.product_type,c.model,'')) like '%motor grader%' then 'Motor Grader'
      when lower(coalesce(m.product_type,c.model,'')) like '%excavator%' then 'Excavator'
      when lower(coalesce(m.product_type,c.model,'')) like '%loader%' then 'Loader'
      when upper(coalesce(c.model,m.osf_model,'')) ~ '^L[0-9]' then 'Loader'
      else null
    end
  );

  v_model_token := upper(regexp_replace(coalesce(c.model,m.osf_model,''),'[^A-Z0-9]+','','g'));

  v_model_scope := coalesce(
    nullif(trim(c.policy_model_scope),''),
    nullif(trim(m.policy_model_scope),''),
    case
      when lower(coalesce(m.product_type,c.model,'')) like '%road roller%' then 'Other models'
      when v_product_family='Loader' and v_model_token ~ '^L9(1[0-9]|2[0-9])' then 'T < 3 t'
      when v_product_family='Loader' and v_model_token ~ '^L9(3[0-9]|4[0-9]|5[0-5])' then '3 t <= T <= 5 t'
      when v_product_family='Loader' and v_model_token ~ '^L9(5[6-9]|6[0-5])' then '5 t < T <= 6 t'
      when v_product_family='Loader' and v_model_token ~ '^L9(6[6-9]|7[0-9]|8[0-9]|9[0-9])' then 'T >= 7 t'
      when v_product_family='Loader' and v_model_token ~ '968' then 'T >= 7 t'
      else null
    end
  );

  v_contract_effective := case
    when coalesce(m.contract_customer,false)=true then true
    when m.bill_of_lading_date is not null and m.bill_of_lading_date < date '2026-01-01' then true
    else false
  end;

  v_tier := case when v_contract_effective then 'Contract Customer' else 'Standard' end;

  v_failure_date := c.failure_date;
  v_failure_hm := c.hm_failure;
  v_sale_date := coalesce(m.sale_date,c.sales_date);
  v_operation_start_date := m.operation_start_date;

  if v_failure_date < m.bill_of_lading_date then
    v_warranty_phase := 'DATE_ANOMALY_PRE_BILL_OF_LADING';
    v_date_anomaly := true;
  elsif v_sale_date is null then
    v_warranty_phase := 'PRE_SALE_YARD';
  elsif v_failure_date < v_sale_date then
    v_warranty_phase := 'PRE_SALE_YARD';
  else
    v_warranty_phase := 'SOLD_COMMERCIAL';
  end if;

  if nullif(trim(c.policy_component_category),'') is not null then
    v_component_category := trim(c.policy_component_category);
    v_component_source := 'CLAIM_POLICY_FIELD';
    v_component_confidence := 'HIGH';
  elsif m is not null and nullif(trim(m.policy_component_category),'') is not null then
    v_component_category := trim(m.policy_component_category);
    v_component_source := 'MACHINE_MASTER';
    v_component_confidence := 'HIGH';
  elsif nullif(trim(c.causing_part_no),'') is not null then
    v_part_master_found := false;

    select * into pp
    from public.sdlg_policy_part_master p
    where p.is_active=true
      and upper(trim(p.part_no))=upper(trim(c.causing_part_no))
      and lower(trim(p.product_family))=lower(trim(coalesce(v_product_family,'')))
    order by p.review_required asc,
      case p.confidence when 'HIGH' then 1 when 'MEDIUM_HIGH' then 2 when 'MEDIUM' then 3 else 4 end,
      p.updated_at desc
    limit 1;

    if found then
      v_part_master_found := true;
    end if;

    if not v_part_master_found then
      select * into pp
      from public.sdlg_policy_part_master p
      where p.is_active=true
        and upper(trim(p.part_no))=upper(trim(c.causing_part_no))
      order by p.review_required asc,
        case p.confidence when 'HIGH' then 1 when 'MEDIUM_HIGH' then 2 when 'MEDIUM' then 3 else 4 end,
        p.updated_at desc
      limit 1;
      if found then
        v_part_master_found := true;
      end if;
    end if;

    if v_part_master_found then
      v_component_source := 'EXACT_PART_POLICY_MASTER';
      v_component_confidence := pp.confidence;
      v_component_review_required := pp.review_required;
      v_component_review_reason := pp.review_reason;

      if pp.machine_coverage_class='KEY_COMPONENT' then
        v_component_category := coalesce(pp.component_category,'Key components');
      elsif pp.machine_coverage_class='OTHER_WARRANTABLE_PART' then
        v_component_category := coalesce(pp.component_category,'Other parts');
      elsif pp.machine_coverage_class='SPECIAL_POLICY' then
        v_component_category := pp.component_category;
      else
        v_component_category := null;
      end if;

      v_component_identity := nullif(trim(coalesce(c.causing_part_desc,'')),'');
      v_component_identity_source := case when v_component_identity is not null then 'CLAIM_DESCRIPTION' else 'PART_NUMBER_ONLY' end;
      v_component_identity_confidence := case when v_component_identity is not null then 'HIGH' else 'MEDIUM' end;
    end if;
  end if;

  if v_component_identity is null and nullif(trim(c.causing_part_no),'') is not null then
    select pm.part_name into v_component_identity
    from public.parts_master pm
    where pm.is_active=true
      and upper(trim(pm.part_no))=upper(trim(c.causing_part_no))
    order by pm.updated_at desc nulls last,pm.created_at desc nulls last limit 1;

    if v_component_identity is not null then
      v_component_identity_source := 'EXACT_PARTS_MASTER';
      v_component_identity_confidence := 'HIGH';
    end if;
  end if;

  if v_product_family is not null
     and v_model_scope is not null
     and (v_sale_date is not null or m.bill_of_lading_date is not null) then
    for r in
      select * from public.service_policy_warranty_rules w
      where lower(w.product_family)=lower(v_product_family)
        and lower(w.model_scope)=lower(v_model_scope)
      order by w.component_category
    loop
      v_policy_category_match :=
        case
          when v_component_category is null then false
          when lower(v_component_category)=lower(r.component_category) then true
          when lower(v_component_category)='other parts'
            and lower(r.component_category) in ('other parts','other components','other machine components') then true
          when lower(v_component_category)='key components'
            and lower(r.component_category) in ('key components','key critical components') then true
          else false
        end;

      v_months := case when v_contract_effective then r.contract_months else r.standard_months end;
      v_hours := case when v_contract_effective then r.contract_hours else r.standard_hours end;

      v_after_sales_expiry := case
        when v_sale_date is not null and v_months is not null
        then (v_sale_date + (v_months || ' months')::interval)::date
        else null end;

      v_bl_cap_months := case
        when r.bl_cap_mode='FIXED_MONTHS' then r.bl_cap_months
        when r.bl_cap_mode='WARRANTY_MONTHS_PLUS_EXTENSION' and v_months is not null
        then v_months + coalesce(r.bl_extension_months,0)
        else null end;

      v_after_departure_expiry := case
        when m.bill_of_lading_date is not null and v_bl_cap_months is not null
        then (m.bill_of_lading_date + (v_bl_cap_months || ' months')::interval)::date
        else null end;

      v_effective_expiry := case
        when v_after_sales_expiry is null then v_after_departure_expiry
        when v_after_departure_expiry is null then v_after_sales_expiry
        else least(v_after_sales_expiry,v_after_departure_expiry) end;

      v_expiry_basis := case
        when v_after_sales_expiry is not null and v_after_departure_expiry is not null
          and v_after_sales_expiry=v_after_departure_expiry then 'SALES_AND_B_L_SAME'
        when v_after_sales_expiry is not null and v_after_departure_expiry is not null
          and v_after_sales_expiry<v_after_departure_expiry then 'SALES_DATE_FIRST'
        when v_after_sales_expiry is not null and v_after_departure_expiry is not null
          and v_after_departure_expiry<v_after_sales_expiry then 'B_L_FIRST'
        when v_after_sales_expiry is not null then 'SALES_DATE_ONLY'
        when v_after_departure_expiry is not null then 'B_L_STOCK_FALLBACK'
        else 'NO_CALENDAR_CLOCK' end;

      v_date_ok := case when v_failure_date is null or v_effective_expiry is null then null else v_failure_date<=v_effective_expiry end;
      v_hours_ok := case when v_hours is null then true when v_failure_hm is null then null else v_failure_hm<=v_hours end;

      if v_date_ok is false or v_hours_ok is false then
        v_status:='OUT_OF_WARRANTY'; v_machine_any_out:=true;
      elsif v_date_ok is null or v_hours_ok is null then
        v_status:='UNKNOWN'; v_machine_any_unknown:=true;
      else
        v_status:='IN_WARRANTY'; v_machine_any_in:=true;
      end if;

      v_reason := case
        when v_date_ok is false and v_hours_ok is false then 'Failure date and HM exceed the applicable warranty limits.'
        when v_date_ok is false then format('Failure date %s is after effective expiry %s.',v_failure_date,v_effective_expiry)
        when v_hours_ok is false then format('Failure HM %s exceeds warranty limit %s.',v_failure_hm,v_hours)
        when v_date_ok is null and v_hours_ok is null then 'Failure date and HM are required to assess this policy.'
        when v_date_ok is null then 'Failure date is required to assess this policy.'
        when v_hours_ok is null then 'Failure HM is required to assess this policy.'
        else format('Failure is within calendar limit %s and HM limit %s; B/L ceiling and Sales Date clock are both applied.',coalesce(v_effective_expiry::text,'n/a'),coalesce(v_hours::text,'unlimited'))
      end;

      v_machine_policies := v_machine_policies || jsonb_build_array(jsonb_build_object(
        'component_category',r.component_category,'status',v_status,'reason',v_reason,
        'warranty_tier_used',v_tier,'warranty_months',v_months,'warranty_hours',v_hours,
        'standard_months',r.standard_months,'standard_hours',r.standard_hours,
        'contract_months',r.contract_months,'contract_hours',r.contract_hours,
        'sales_date',v_sale_date,'sales_expiry_date',v_after_sales_expiry,
        'bill_of_lading_date',m.bill_of_lading_date,'bl_cap_mode',r.bl_cap_mode,
        'bl_cap_months',v_bl_cap_months,'bill_of_lading_expiry_date',v_after_departure_expiry,
        'effective_expiry_date',v_effective_expiry,'expiry_basis',v_expiry_basis,
        'date_check',v_date_ok,'hour_check',v_hours_ok,
        'special_warranty_options',r.special_warranty_options,
        'is_claim_component',v_policy_category_match
      ));

      if v_policy_category_match then
        v_component_rule := jsonb_build_object(
          'component_category',r.component_category,'status',v_status,'reason',v_reason,
          'warranty_tier_used',v_tier,'warranty_months',v_months,'warranty_hours',v_hours,
          'standard_months',r.standard_months,'standard_hours',r.standard_hours,
          'contract_months',r.contract_months,'contract_hours',r.contract_hours,
          'sales_date',v_sale_date,'sales_expiry_date',v_after_sales_expiry,
          'bill_of_lading_date',m.bill_of_lading_date,'bl_cap_mode',r.bl_cap_mode,
          'bl_cap_months',v_bl_cap_months,'bill_of_lading_expiry_date',v_after_departure_expiry,
          'effective_expiry_date',v_effective_expiry,'expiry_basis',v_expiry_basis,
          'date_check',v_date_ok,'hour_check',v_hours_ok,
          'special_warranty_options',r.special_warranty_options,'notes',r.notes
        );
      end if;
    end loop;
  end if;

  if v_part_master_found and pp.machine_coverage_class='CONSUMABLE_NOT_COVERED' then
    v_component_status:=case when pp.review_required then 'UNKNOWN' else 'OUT_OF_WARRANTY' end;
    v_component_reason:=case
      when pp.review_required then coalesce(pp.review_reason,'Part is classified as potentially not covered but exact policy scope requires review.')
      else coalesce(pp.notes,'Part is classified as a consumable/not-covered item under the policy.')
    end;
    v_component_rule:=jsonb_build_object(
      'component_category',null,'coverage_class',pp.machine_coverage_class,'status',v_component_status,
      'reason',v_component_reason,'policy_source_section',pp.source_section,
      'classification_confidence',pp.confidence);
  elsif v_part_master_found and pp.machine_coverage_class='UNKNOWN_REQUIRES_REVIEW' then
    v_component_status:='UNKNOWN';
    v_component_reason:=coalesce(pp.review_reason,'Part is known but the applicable unit-warranty class is not explicit enough to auto-decide.');
  elsif v_component_rule is not null then
    v_component_status:=v_component_rule->>'status';
    v_component_reason:=v_component_rule->>'reason';
  else
    v_component_status:='UNKNOWN';
    v_component_reason:='Exact part is not present in the policy part master.';
  end if;

  if v_machine_any_in and not v_machine_any_out then
    v_machine_reason:='Unit is within at least one applicable warranty policy category.';
  elsif v_machine_any_out and not v_machine_any_in then
    v_machine_reason:='Unit exceeds all applicable warranty policy categories.';
  elsif v_machine_any_in then
    v_machine_reason:='Unit has mixed category outcomes; failed component classification determines claim eligibility.';
  else
    v_machine_reason:='Insufficient data or no applicable warranty policy rule.';
  end if;

  if v_part_master_found and pp.machine_coverage_class='CONSUMABLE_NOT_COVERED' then
    if pp.review_required then
      v_marketing_status:='REVIEW_REQUIRED';
      v_marketing_reason:='Part appears to be a consumable/rubber-type item, but exact policy scope requires review.';
    else
      v_marketing_status:='OUT_OF_WARRANTY';
      v_marketing_reason:='The failed part is not covered by the underlying SDLG warranty policy.';
    end if;
  elsif v_component_rule is not null and v_component_rule->>'warranty_months' is not null then
    v_marketing_months:=(v_component_rule->>'warranty_months')::numeric;
    v_marketing_hours:=case when v_component_rule->>'warranty_hours' is null then null else (v_component_rule->>'warranty_hours')::numeric end;
    v_marketing_expiry:=case when v_sale_date is not null then (v_sale_date+(v_marketing_months||' months')::interval)::date else null end;
    v_marketing_date_ok:=case when v_failure_date is null or v_marketing_expiry is null then null else v_failure_date<=v_marketing_expiry end;
    v_marketing_hours_ok:=case when v_marketing_hours is null then true when v_failure_hm is null then null else v_failure_hm<=v_marketing_hours end;

    if v_marketing_date_ok is false or v_marketing_hours_ok is false then
      v_marketing_status:='OUT_OF_WARRANTY';
      v_marketing_reason:=case
        when v_marketing_date_ok is false and v_marketing_hours_ok is false then 'Failure date and HM exceed the Marketing warranty limits.'
        when v_marketing_date_ok is false then format('Failure date %s is after Marketing expiry %s.',v_failure_date,v_marketing_expiry)
        else format('Failure HM %s exceeds Marketing warranty limit %s.',v_failure_hm,v_marketing_hours) end;
    elsif v_marketing_date_ok is null or v_marketing_hours_ok is null then
      v_marketing_status:='REVIEW_REQUIRED';
      v_marketing_reason:='Marketing warranty cannot be conclusively assessed from available Sales Date/HM.';
    else
      v_marketing_status:='IN_WARRANTY';
      v_marketing_reason:=format('Dealer-side Marketing warranty clock ends %s and HM limit is %s.',v_marketing_expiry,coalesce(v_marketing_hours::text,'unlimited'));
    end if;
  end if;

  if v_date_anomaly then
    v_final_route:='REVIEW_REQUIRED';
    v_final_route_reason:=format('Failure date %s is before B/L date %s; unit history must be verified before warranty routing.',v_failure_date,m.bill_of_lading_date);
  elsif v_part_master_found and v_component_review_required then
    v_final_route:='REVIEW_REQUIRED';
    v_final_route_reason:=coalesce(v_component_review_reason,'Component classification requires human review.');
  elsif v_part_master_found and pp.machine_coverage_class='CONSUMABLE_NOT_COVERED' then
    v_final_route:='NON_WARRANTY';
    v_final_route_reason:='Failed part is classified as consumable/not covered by the underlying policy.';
  elsif v_component_rule is null then
    v_final_route:='REVIEW_REQUIRED';
    v_final_route_reason:='Failed component has no conclusive policy rule.';
  elsif v_component_review_required then
    v_final_route:='REVIEW_REQUIRED';
    v_final_route_reason:=coalesce(v_component_review_reason,'Component classification requires human review.');
  elsif v_component_status='IN_WARRANTY' then
    v_final_route:='SDLG';
    v_final_route_reason:='Resolved failed component is within SDLG warranty.';
  elsif v_component_status='OUT_OF_WARRANTY' and v_marketing_status='IN_WARRANTY' then
    v_final_route:='MARKETING';
    v_final_route_reason:='SDLG warranty has expired while the dealer-side Sales Date warranty clock remains active.';
  elsif v_component_status='OUT_OF_WARRANTY' and v_marketing_status='OUT_OF_WARRANTY' then
    v_final_route:='NON_WARRANTY';
    v_final_route_reason:='Both SDLG and Marketing warranty are expired or the part is not covered.';
  else
    v_final_route:='REVIEW_REQUIRED';
    v_final_route_reason:='Warranty assessments are not conclusive.';
  end if;

  return
    jsonb_build_object(
      'claim_id',c.claim_id,'model',c.model,'serial_no',c.serial_no,'customer',c.customer,
      'product_family',v_product_family,'model_scope',v_model_scope,
      'contract_customer_effective',v_contract_effective,'warranty_tier_used',v_tier,
      'contract_resolution_source',case when coalesce(m.contract_customer,false) then 'MACHINE_MASTER'
        when m.bill_of_lading_date < date '2026-01-01' then 'B/L_CONTINUITY_RULE'
        else 'STANDARD_DEFAULT' end,
      'component_category',v_component_category,'component_category_source',v_component_source,
      'component_category_confidence',v_component_confidence,
      'component_coverage_class',case when v_part_master_found then pp.machine_coverage_class else null end,
      'component_policy_variant',case when v_part_master_found then pp.policy_variant else null end,
      'component_classification_review_required',v_component_review_required,
      'component_classification_review_reason',v_component_review_reason,
      'component_identity',v_component_identity,'component_identity_source',v_component_identity_source,
      'component_identity_confidence',v_component_identity_confidence,
      'component_mapping_part_no',nullif(trim(c.causing_part_no),''),
      'component_mapping_product_family',case when v_part_master_found then v_product_family else null end,
      'component_mapping_source_type',case when v_part_master_found then 'SDLG_POLICY_PART_MASTER' else null end,
      'component_mapping_notes',case when v_part_master_found then pp.notes else null end,
      'component_mapping_conflict',false
    )
    ||
    jsonb_build_object(
      'warranty_phase',v_warranty_phase,'date_anomaly',v_date_anomaly,
      'operation_start_date',v_operation_start_date,
      'commencement_basis',case when v_sale_date is not null then 'SALE_DATE_FOR_CALENDAR_CLOCK'
        when m.bill_of_lading_date is not null then 'B_L_STOCK_FALLBACK' else 'UNRESOLVED' end,
      'commencement_date',v_sale_date,'bill_of_lading_date',m.bill_of_lading_date,
      'sales_date',v_sale_date,'failure_date',v_failure_date,'failure_hm',v_failure_hm,
      'warranty_months',case when v_component_rule is null then null else nullif(v_component_rule->>'warranty_months','')::numeric end,
      'warranty_hours',case when v_component_rule is null then null else nullif(v_component_rule->>'warranty_hours','')::numeric end,
      'after_sales_expiry_date',case when v_component_rule is null then null else nullif(v_component_rule->>'sales_expiry_date','')::date end,
      'after_departure_expiry_date',case when v_component_rule is null then null else nullif(v_component_rule->>'bill_of_lading_expiry_date','')::date end,
      'effective_expiry_date',case when v_component_rule is null then null else nullif(v_component_rule->>'effective_expiry_date','')::date end,
      'expiry_basis',case when v_component_rule is null then null else v_component_rule->>'expiry_basis' end,
      'machine_status',case when v_machine_any_in and not v_machine_any_out then 'IN_WARRANTY'
        when v_machine_any_out and not v_machine_any_in then 'OUT_OF_WARRANTY'
        when v_machine_any_in then 'MIXED_POLICY' else 'UNKNOWN' end,
      'machine_reason',v_machine_reason,'component_status',v_component_status,'component_reason',v_component_reason,
      'overall_status',case
      when v_date_anomaly or v_component_review_required or v_component_status='UNKNOWN' then 'REVIEW_REQUIRED'
      when v_component_status='IN_WARRANTY' then 'ELIGIBLE'
      when v_component_status='OUT_OF_WARRANTY' then 'NOT_ELIGIBLE'
      else 'REVIEW_REQUIRED' end,
      'overall_reason',case
        when v_part_master_found and pp.machine_coverage_class='CONSUMABLE_NOT_COVERED' then 'Failed part is classified as consumable/not covered.'
        when v_date_anomaly then 'Failure occurred before B/L; unit history must be checked.'
        when v_component_status='IN_WARRANTY' and not v_component_review_required then 'Unit and resolved failed component are within applicable warranty limits.'
        when v_component_status='OUT_OF_WARRANTY' then v_component_reason
        else 'Warranty component assessment requires review.' end,
      'final_route',v_final_route,'final_route_reason',v_final_route_reason
    )
    ||
    jsonb_build_object(
      'sdlg_assessment',jsonb_build_object(
        'status',case when v_component_rule is null then 'REVIEW_REQUIRED' else v_component_status end,
        'coverage_class',case when v_part_master_found then pp.machine_coverage_class else null end,
        'warranty_months',case when v_component_rule is null then null else nullif(v_component_rule->>'warranty_months','')::numeric end,
        'warranty_hours',case when v_component_rule is null then null else nullif(v_component_rule->>'warranty_hours','')::numeric end,
        'sales_date',v_sale_date,'sales_expiry_date',case when v_component_rule is null then null else nullif(v_component_rule->>'sales_expiry_date','')::date end,
        'bill_of_lading_date',m.bill_of_lading_date,
        'bill_of_lading_cap_months',case when v_component_rule is null then null else nullif(v_component_rule->>'bl_cap_months','')::numeric end,
        'bill_of_lading_expiry_date',case when v_component_rule is null then null else nullif(v_component_rule->>'bill_of_lading_expiry_date','')::date end,
        'effective_expiry_date',case when v_component_rule is null then null else nullif(v_component_rule->>'effective_expiry_date','')::date end,
        'expiry_basis',case when v_component_rule is null then null else v_component_rule->>'expiry_basis' end,
        'warranty_phase',v_warranty_phase,'failure_date',v_failure_date,'failure_hm',v_failure_hm,
        'date_check',case when v_component_rule is null then null else nullif(v_component_rule->>'date_check','')::boolean end,
        'hour_check',case when v_component_rule is null then null else nullif(v_component_rule->>'hour_check','')::boolean end,
        'reason',case when v_component_rule is null then 'Component policy class unresolved.' else v_component_reason end),
      'marketing_assessment',jsonb_build_object(
        'status',v_marketing_status,'coverage_class',case when v_part_master_found then pp.machine_coverage_class else null end,
        'warranty_months',v_marketing_months,'warranty_hours',v_marketing_hours,
        'sales_date',v_sale_date,'expiry_date',v_marketing_expiry,
        'failure_date',v_failure_date,'failure_hm',v_failure_hm,
        'date_check',v_marketing_date_ok,'hour_check',v_marketing_hours_ok,'reason',v_marketing_reason),
      'component_rule',v_component_rule,'machine_policies',v_machine_policies,
      'evidence_summary',jsonb_build_object(
        'part_identity_evidence',jsonb_build_object(
          'part_no',c.causing_part_no,'part_description',c.causing_part_desc,
          'parts_master_match',v_component_identity_source='EXACT_PARTS_MASTER'),
        'narrative_role','SUPPORTING_CONTEXT_ONLY',
        'resolution_hierarchy',jsonb_build_array('CLAIM_POLICY_FIELD','MACHINE_MASTER','EXACT_PART_POLICY_MASTER','UNKNOWN')),
      'policy_code','SDLG_SERVICE_POLICY_2026'
    );
end;
$function$;

create or replace view public.claim_warranty_resolution_v as
select
  c.id,c.claim_id,c.model,c.serial_no,c.customer,c.failure_date,c.hm_failure,
  r.r ->> 'product_family' as product_family,
  r.r ->> 'model_scope' as model_scope,
  r.r ->> 'component_category' as component_category,
  r.r ->> 'component_category_source' as component_category_source,
  r.r ->> 'component_category_confidence' as component_category_confidence,
  r.r ->> 'component_identity' as component_identity,
  r.r ->> 'component_identity_source' as component_identity_source,
  r.r ->> 'component_identity_confidence' as component_identity_confidence,
  r.r ->> 'warranty_tier_used' as warranty_tier_used,
  (r.r ->> 'contract_customer_effective')::boolean as contract_customer_effective,
  r.r ->> 'contract_resolution_source' as contract_resolution_source,
  r.r ->> 'commencement_basis' as commencement_basis,
  nullif(r.r ->> 'commencement_date','')::date as commencement_date,
  nullif(r.r ->> 'bill_of_lading_date','')::date as bill_of_lading_date,
  r.r ->> 'machine_status' as machine_status,
  r.r ->> 'machine_reason' as machine_reason,
  r.r ->> 'component_status' as component_status,
  r.r ->> 'component_reason' as component_reason,
  r.r ->> 'overall_status' as overall_status,
  r.r ->> 'overall_reason' as overall_reason,
  r.r -> 'component_rule' as component_rule,
  r.r -> 'machine_policies' as machine_policies,
  r.r -> 'evidence_summary' as evidence_summary,
  r.r as resolution,
  r.r ->> 'component_coverage_class' as component_coverage_class,
  r.r ->> 'component_policy_variant' as component_policy_variant,
  (r.r ->> 'component_classification_review_required')::boolean as component_classification_review_required,
  r.r ->> 'component_classification_review_reason' as component_classification_review_reason,
  r.r ->> 'warranty_phase' as warranty_phase,
  (r.r ->> 'date_anomaly')::boolean as date_anomaly,
  nullif(r.r ->> 'operation_start_date','')::date as operation_start_date,
  nullif(r.r ->> 'sales_date','')::date as sales_date,
  r.r ->> 'expiry_basis' as expiry_basis,
  nullif(r.r ->> 'effective_expiry_date','')::date as effective_expiry_date,
  r.r ->> 'final_route' as final_route,
  r.r ->> 'final_route_reason' as final_route_reason
from public.claims c
cross join lateral public.sdlg_warranty_resolve_claim(c.claim_id) r(r)
where c.archived_at is null;

create or replace view public.claim_warranty_policy_v as
select
  x.claim_id,
  x.model,
  x.serial_no,
  x.customer,
  x.failure_date,
  x.hm_failure,
  c.claim_status,
  c.dealer_repair_date,
  c.dealer_claim_date,
  x.product_family,
  x.model_scope,
  x.component_category,
  m.sale_date,
  m.operation_start_date,
  x.bill_of_lading_date,
  x.contract_customer_effective as contract_customer,
  case
    when x.component_status='UNKNOWN' or x.component_rule is null then 'REVIEW_REQUIRED'
    when x.date_anomaly then 'REVIEW_REQUIRED'
    else 'READY_FOR_ASSESSMENT'
  end as assessment_data_status,
  jsonb_build_object(
    'status',x.component_status,
    'coverage_class',x.component_coverage_class,
    'reason',x.component_reason,
    'policy_code','SDLG_SERVICE_POLICY_2026',
    'warranty_tier_used',x.warranty_tier_used,
    'warranty_months',case when x.component_rule is not null then nullif(x.component_rule->>'warranty_months','')::numeric else null end,
    'warranty_hours',case when x.component_rule is not null then nullif(x.component_rule->>'warranty_hours','')::numeric else null end,
    'sales_expiry',case when x.component_rule is not null then nullif(x.component_rule->>'sales_expiry_date','')::date else null end,
    'bill_of_lading_expiry',case when x.component_rule is not null then nullif(x.component_rule->>'bill_of_lading_expiry_date','')::date else null end,
    'effective_expiry',x.effective_expiry_date,
    'expiry_basis',x.expiry_basis,
    'warranty_phase',x.warranty_phase,
    'final_route',x.final_route,
    'final_route_reason',x.final_route_reason,
    'resolution',x.resolution
  ) as warranty_assessment,
  x.component_coverage_class,
  x.component_category_source,
  x.component_category_confidence,
  x.component_policy_variant,
  x.component_classification_review_required,
  x.component_classification_review_reason,
  x.warranty_phase,
  x.date_anomaly,
  x.sales_date,
  x.expiry_basis,
  x.effective_expiry_date,
  x.final_route,
  x.final_route_reason
from public.claim_warranty_resolution_v x
join public.claims c on c.claim_id=x.claim_id and c.archived_at is null
left join public.machines m on m.id=c.machine_id and m.is_active=true;
