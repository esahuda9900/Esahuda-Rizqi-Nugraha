-- 20260930230000_refine_sdlg_part_classification_and_legacy_assessor.sql
-- Refine the authoritative SDLG part-policy master and align the legacy machine assessor.
-- This migration intentionally preserves existing MANUAL_APPROVED_POLICY_MAPPING rows.

with part_names as (
  select upper(trim(pm.part_no)) as part_no,
         max(trim(pm.part_name)) as part_name
  from public.parts_master pm
  where pm.is_active = true
    and nullif(trim(pm.part_no),'') is not null
  group by upper(trim(pm.part_no))
  union
  select upper(trim(c.causing_part_no)) as part_no,
         max(trim(c.causing_part_desc)) as part_name
  from public.claims c
  where c.archived_at is null
    and nullif(trim(c.causing_part_no),'') is not null
  group by upper(trim(c.causing_part_no))
),
normalized as (
  select part_no,
         lower(trim(part_name)) as part_name,
         regexp_replace(lower(trim(coalesce(part_name,''))),'[^a-z0-9]+',' ','g') as norm
  from part_names
)
update public.sdlg_policy_part_master p
set machine_coverage_class = 'CONSUMABLE_NOT_COVERED',
    component_category = null,
    policy_variant = 'RUBBER_SEALING_CONSUMABLE',
    classification_basis = 'OFFICIAL_POLICY_RUBBER_COMPONENT',
    source_section = '§2.1.9',
    confidence = case
      when n.norm in ('o ring','o-ring','sealing ring','sealing ring kit','sealing kit','sealing kit center passage') then 'HIGH'
      else 'MEDIUM_HIGH'
    end,
    review_required = false,
    review_reason = null,
    notes = 'Classified as a rubber/sealing consumable under §2.1.9. No narrative text is used for the decision.',
    updated_at = now()
from normalized n
where upper(trim(p.part_no)) = n.part_no
  and lower(trim(p.product_family)) in ('excavator','loader','road machinery')
  and p.classification_basis <> 'MANUAL_APPROVED_POLICY_MAPPING'
  and n.norm in (
    'o ring','o-ring','sealing ring','sealing ring kit','sealing kit',
    'sealing kit center passage','hose','hose ac','fuel hose'
  );

with part_names as (
  select upper(trim(pm.part_no)) as part_no,
         max(trim(pm.part_name)) as part_name
  from public.parts_master pm
  where pm.is_active = true
  group by upper(trim(pm.part_no))
  union
  select upper(trim(c.causing_part_no)) as part_no,
         max(trim(c.causing_part_desc)) as part_name
  from public.claims c
  where c.archived_at is null
    and nullif(trim(c.causing_part_no),'') is not null
  group by upper(trim(c.causing_part_no))
),
normalized as (
  select part_no,
         regexp_replace(lower(trim(coalesce(part_name,''))),'[^a-z0-9]+',' ','g') as norm
  from part_names
)
update public.sdlg_policy_part_master p
set machine_coverage_class = 'OTHER_WARRANTABLE_PART',
    component_category = 'Other parts',
    policy_variant = 'WEAR_COMPONENT_POLICY_REVIEW',
    classification_basis = 'POLICY_RESIDUAL_OTHER_WITH_WEAR_REVIEW',
    source_section = '§2.1.9',
    confidence = 'MEDIUM',
    review_required = true,
    review_reason = 'The 2026 unit-warranty policy does not explicitly name this wear component in the exclusion list. It is categorized in the Other parts bucket but remains review-required because the policy also excludes similar consumable/wear items.',
    notes = 'Do not infer exclusion from narrative diagnosis. Human policy confirmation is required before final routing.',
    updated_at = now()
from normalized n
where upper(trim(p.part_no)) = n.part_no
  and lower(trim(p.product_family)) in ('excavator','loader','road machinery')
  and p.classification_basis <> 'MANUAL_APPROVED_POLICY_MAPPING'
  and n.norm in (
    'top roller','idler','idler roller','track chain','track chain assembly',
    'disc brake','break shoe kit','friction disc','friction plate'
  );

with part_names as (
  select upper(trim(pm.part_no)) as part_no,
         max(trim(pm.part_name)) as part_name
  from public.parts_master pm
  where pm.is_active = true
  group by upper(trim(pm.part_no))
  union
  select upper(trim(c.causing_part_no)) as part_no,
         max(trim(c.causing_part_desc)) as part_name
  from public.claims c
  where c.archived_at is null
    and nullif(trim(c.causing_part_no),'') is not null
  group by upper(trim(c.causing_part_no))
)
update public.sdlg_policy_part_master p
set machine_coverage_class = 'SPECIAL_POLICY',
    component_category = null,
    policy_variant = 'SDLG_BREAKER_WARRANTY',
    classification_basis = 'OFFICIAL_POLICY_SPECIAL_COMPONENT',
    source_section = '§2.1.10',
    confidence = 'HIGH',
    review_required = true,
    review_reason = 'Breaker warranty is governed by a separate §2.1.10 schedule and must not be forced through the normal machine Key/Other warranty matrix.',
    notes = 'Separate SDLG breaker warranty path. Verify breaker model, installation configuration and service record.',
    updated_at = now()
from part_names n
where upper(trim(p.part_no)) = n.part_no
  and lower(trim(p.product_family)) = 'excavator'
  and p.classification_basis <> 'MANUAL_APPROVED_POLICY_MAPPING'
  and lower(trim(n.part_name)) like '%breaker%';

create or replace function public.sdlg_warranty_assess(
  p_product_family text,
  p_model_scope text,
  p_component_category text,
  p_contract_customer boolean,
  p_sale_date date,
  p_bill_of_lading_date date,
  p_failure_date date,
  p_failure_hm numeric
)
returns jsonb
language plpgsql
stable
set search_path = public
as $function$
declare
  r record;
  v_months numeric;
  v_hours numeric;
  v_bl_cap_months numeric;
  v_sale_expiry date;
  v_bl_expiry date;
  v_effective_expiry date;
  v_date_ok boolean;
  v_hours_ok boolean;
  v_status text;
  v_reason text;
  v_expiry_basis text;
  v_date_anomaly boolean := false;
  v_phase text;
begin
  select *
  into r
  from public.service_policy_warranty_rules w
  where lower(w.product_family) = lower(p_product_family)
    and lower(w.model_scope) = lower(p_model_scope)
    and (
      lower(w.component_category) = lower(p_component_category)
      or (lower(p_component_category) = 'other parts'
          and lower(w.component_category) in ('other parts','other components','other machine components'))
      or (lower(p_component_category) = 'key components'
          and lower(w.component_category) in ('key components','key critical components'))
    )
  order by case when lower(w.component_category)=lower(p_component_category) then 0 else 1 end
  limit 1;

  if not found then
    return jsonb_build_object(
      'status','UNKNOWN',
      'reason','No exact policy rule match for product family/model scope/component category',
      'policy_code','SDLG_SERVICE_POLICY_2026'
    );
  end if;

  v_months := case when coalesce(p_contract_customer,false) then r.contract_months else r.standard_months end;
  v_hours := case when coalesce(p_contract_customer,false) then r.contract_hours else r.standard_hours end;

  v_sale_expiry :=
    case when p_sale_date is not null and v_months is not null
      then (p_sale_date + (v_months || ' months')::interval)::date
      else null end;

  v_bl_cap_months :=
    case
      when r.bl_cap_mode = 'FIXED_MONTHS' then r.bl_cap_months
      when r.bl_cap_mode = 'WARRANTY_MONTHS_PLUS_EXTENSION'
        and v_months is not null
        then v_months + coalesce(r.bl_extension_months,0)
      else null
    end;

  v_bl_expiry :=
    case when p_bill_of_lading_date is not null and v_bl_cap_months is not null
      then (p_bill_of_lading_date + (v_bl_cap_months || ' months')::interval)::date
      else null end;

  v_effective_expiry :=
    case
      when v_sale_expiry is null then v_bl_expiry
      when v_bl_expiry is null then v_sale_expiry
      else least(v_sale_expiry,v_bl_expiry)
    end;

  v_expiry_basis :=
    case
      when v_sale_expiry is not null and v_bl_expiry is not null and v_sale_expiry = v_bl_expiry then 'SALES_AND_B_L_SAME'
      when v_sale_expiry is not null and v_bl_expiry is not null and v_sale_expiry < v_bl_expiry then 'SALES_DATE_FIRST'
      when v_sale_expiry is not null and v_bl_expiry is not null and v_bl_expiry < v_sale_expiry then 'B_L_FIRST'
      when v_sale_expiry is not null then 'SALES_DATE_ONLY'
      when v_bl_expiry is not null then 'B_L_STOCK_FALLBACK'
      else 'NO_CALENDAR_CLOCK'
    end;

  v_date_anomaly := p_failure_date is not null
                    and p_bill_of_lading_date is not null
                    and p_failure_date < p_bill_of_lading_date;

  v_phase :=
    case
      when v_date_anomaly then 'DATE_ANOMALY_PRE_BILL_OF_LADING'
      when p_sale_date is null then 'PRE_SALE_YARD'
      when p_failure_date < p_sale_date then 'PRE_SALE_YARD'
      else 'SOLD_COMMERCIAL'
    end;

  v_date_ok :=
    case
      when p_failure_date is null or v_effective_expiry is null then null
      else p_failure_date <= v_effective_expiry
    end;

  v_hours_ok :=
    case
      when v_hours is null then true
      when p_failure_hm is null then null
      else p_failure_hm <= v_hours
    end;

  if v_date_anomaly then
    v_status := 'REVIEW_REQUIRED';
    v_reason := format(
      'Failure date %s is before B/L date %s; verify unit history before warranty routing.',
      p_failure_date,p_bill_of_lading_date
    );
  elsif v_date_ok is false or v_hours_ok is false then
    v_status := 'OUT_OF_WARRANTY';
    v_reason := case
      when v_date_ok is false and v_hours_ok is false then 'Failure date and HM exceed the applicable warranty limits.'
      when v_date_ok is false then format('Failure date %s is after effective expiry %s.',p_failure_date,v_effective_expiry)
      else format('Failure HM %s exceeds warranty limit %s.',p_failure_hm,v_hours)
    end;
  elsif v_date_ok is null or v_hours_ok is null then
    v_status := 'UNKNOWN';
    v_reason := 'Insufficient data to determine calendar and hour eligibility.';
  else
    v_status := 'IN_WARRANTY';
    v_reason := 'Failure is within the applicable warranty calendar and HM limits, with the earlier Sales/B/L expiry applied.';
  end if;

  return jsonb_build_object(
    'status',v_status,
    'reason',v_reason,
    'policy_code','SDLG_SERVICE_POLICY_2026',
    'standard_or_contract',case when coalesce(p_contract_customer,false) then 'Contract' else 'Standard' end,
    'warranty_months',v_months,
    'warranty_hours',v_hours,
    'sale_date',p_sale_date,
    'sale_expiry_date',v_sale_expiry,
    'bill_of_lading_date',p_bill_of_lading_date,
    'bill_of_lading_cap_months',v_bl_cap_months,
    'bill_of_lading_expiry_date',v_bl_expiry,
    'effective_expiry_date',v_effective_expiry,
    'expiry_basis',v_expiry_basis,
    'warranty_phase',v_phase,
    'date_anomaly',v_date_anomaly,
    'failure_date',p_failure_date,
    'failure_hm',p_failure_hm,
    'date_check',v_date_ok,
    'hour_check',v_hours_ok
  );
end
$function$;

create or replace view public.machine_warranty_policy_v as
select
  id as machine_id,
  serial_no,
  model_id,
  customer_id,
  branch_id,
  dealer_id,
  policy_product_family,
  policy_model_scope,
  policy_component_category,
  sale_date,
  operation_start_date,
  bill_of_lading_date,
  contract_customer,
  current_hm,
  case
    when policy_product_family is null
      or policy_model_scope is null
      or policy_component_category is null
      or (sale_date is null and bill_of_lading_date is null)
      then 'INCOMPLETE_INPUT'
    else 'READY_FOR_ASSESSMENT'
  end as assessment_data_status,
  case
    when policy_product_family is not null
      and policy_model_scope is not null
      and policy_component_category is not null
      and (sale_date is not null or bill_of_lading_date is not null)
      then public.sdlg_warranty_assess(
        policy_product_family,
        policy_model_scope,
        policy_component_category,
        coalesce(contract_customer,false),
        sale_date,
        bill_of_lading_date,
        current_date,
        current_hm
      )
    else jsonb_build_object(
      'status','UNKNOWN',
      'reason','Missing policy product family/model scope/component category and both Sales/B/L dates are unavailable.'
    )
  end as warranty_assessment
from public.machines
where is_active = true;

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
    when x.component_status='UNKNOWN'
      or x.component_rule is null
      or x.component_classification_review_required
      or x.date_anomaly
      then 'REVIEW_REQUIRED'
    else 'READY_FOR_ASSESSMENT'
  end as assessment_data_status,
  jsonb_build_object(
    'status', x.component_status,
    'coverage_class', x.component_coverage_class,
    'reason', x.component_reason,
    'policy_code', 'SDLG_SERVICE_POLICY_2026',
    'warranty_tier_used', x.warranty_tier_used,
    'warranty_months', case when x.component_rule is not null then nullif(x.component_rule->>'warranty_months','')::numeric else null end,
    'warranty_hours', case when x.component_rule is not null then nullif(x.component_rule->>'warranty_hours','')::numeric else null end,
    'sales_expiry', case when x.component_rule is not null then nullif(x.component_rule->>'sales_expiry_date','')::date else null end,
    'bill_of_lading_expiry', case when x.component_rule is not null then nullif(x.component_rule->>'bill_of_lading_expiry_date','')::date else null end,
    'effective_expiry', x.effective_expiry_date,
    'expiry_basis', x.expiry_basis,
    'warranty_phase', x.warranty_phase,
    'date_anomaly', x.date_anomaly,
    'final_route', x.final_route,
    'final_route_reason', x.final_route_reason,
    'resolution', x.resolution
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
