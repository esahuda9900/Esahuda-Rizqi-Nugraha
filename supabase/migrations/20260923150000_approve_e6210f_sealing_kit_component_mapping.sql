-- Exact approved component mapping for the E6210F Turning Joint sealing kit.
-- This is an application/manual classification, not a claim that SDLG's policy
-- explicitly names "Sealing Kit" as a Key Component.
insert into public.sdlg_policy_component_taxonomy
  (product_family, term, component_category, source_type, priority, is_active)
select
  'Excavator',
  'SLG-4120016088001',
  'Other parts',
  'MANUAL_APPROVAL',
  5,
  true
where not exists (
  select 1
  from public.sdlg_policy_component_taxonomy
  where lower(coalesce(product_family,''))='excavator'
    and upper(trim(term))='SLG-4120016088001'
);

CREATE OR REPLACE FUNCTION public.sdlg_warranty_resolve_claim(p_claim_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  c record;
  m record;
  r record;
  tax record;
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
  v_evidence text;
  v_commencement_date date;
  v_failure_date date;
  v_failure_hm numeric;
  v_machine_any_in boolean := false;
  v_machine_any_out boolean := false;
  v_machine_any_unknown boolean := false;
  v_machine_reason text := 'No warranty policy could be assessed';
  v_component_status text := 'UNKNOWN';
  v_component_reason text := 'Failure component could not yet be resolved to a warranty category';
  v_component_rule jsonb := null;
  v_machine_policies jsonb := '[]'::jsonb;
  v_date_ok boolean;
  v_hours_ok boolean;
  v_status text;
  v_reason text;
  v_bl_cap_months numeric;
  v_note text;
  v_note_max numeric;
  v_effective_expiry date;
  v_after_sales_expiry date;
  v_after_departure_expiry date;
  v_months numeric;
  v_hours numeric;
  v_hit_count integer := 0;
  v_candidate_category text;
  v_candidate_term text;
  v_candidate_source_type text;
  v_marketing_status text := 'REVIEW_REQUIRED';
  v_marketing_reason text := 'Marketing warranty requires a resolved component policy category.';
  v_marketing_months numeric;
  v_marketing_hours numeric;
  v_marketing_expiry date;
  v_marketing_date_ok boolean;
  v_marketing_hours_ok boolean;
  v_final_route text := 'REVIEW_REQUIRED';
  v_final_route_reason text := 'Warranty routing requires component classification.';
begin
  select * into c from public.claims where claim_id = p_claim_id and archived_at is null limit 1;
  if not found then
    return jsonb_build_object('status','UNKNOWN','overall_status','UNKNOWN','reason','Claim tidak ditemukan atau sudah diarsipkan','claim_id',p_claim_id);
  end if;

  select * into m from public.machines where id = c.machine_id and is_active = true limit 1;

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

  v_model_token := upper(regexp_replace(coalesce(c.model, m.osf_model, ''), '\s+', '', 'g'));

  v_model_scope := coalesce(
    nullif(trim(c.policy_model_scope),''),
    nullif(trim(m.policy_model_scope),''),
    case
      when lower(coalesce(m.product_type,c.model,'')) like '%road roller%' then 'Other models'
      when v_product_family = 'Loader' and v_model_token ~ '^L9(1[0-9]|2[0-9])' then 'T < 3 t'
      when v_product_family = 'Loader' and v_model_token ~ '^L9(3[0-9]|4[0-9]|5[0-5])' then '3 t <= T <= 5 t'
      when v_product_family = 'Loader' and v_model_token ~ '^L9(5[6-9]|6[0-5])' then '5 t < T < 6 t'
      when v_product_family = 'Loader' and v_model_token ~ '^L9(6[6-9]|7[0-9]|8[0-9]|9[0-9])' then 'T >= 7 t'
      when v_product_family = 'Loader' and v_model_token ~ '968' then 'T >= 7 t'
      else null
    end
  );

  v_contract_effective := case
    when coalesce(m.contract_customer,false) = true then true
    when m.bill_of_lading_date is not null and m.bill_of_lading_date < date '2026-01-01' then true
    else false
  end;
  v_tier := case when v_contract_effective then 'Contract Customer' else 'Standard' end;

  v_failure_date := c.failure_date;
  v_failure_hm := c.hm_failure;
  v_commencement_date := coalesce(m.operation_start_date,m.sale_date,c.sales_date);

  v_evidence := trim(regexp_replace(concat_ws(' | ',
    c.causing_part_no,
    c.causing_part_desc,
    c.failure_part_location,
    c.fault_description,
    c.cause_analyze,
    c.repair_method,
    c.comment,
    case when jsonb_typeof(c.parts)='array' then (
      select string_agg(coalesce(p.value->>'description',''),' | ' order by p.ordinality)
      from jsonb_array_elements(c.parts) with ordinality p(value,ordinality)
      where nullif(trim(coalesce(p.value->>'description','')),'') is not null
    ) end
  ),'\s+',' ','g'));

  if nullif(trim(c.policy_component_category),'') is not null then
    v_component_category := trim(c.policy_component_category);
    v_component_source := 'CLAIM_POLICY_FIELD';
    v_component_confidence := 'HIGH';
  elsif m is not null and nullif(trim(m.policy_component_category),'') is not null then
    v_component_category := trim(m.policy_component_category);
    v_component_source := 'MACHINE_MASTER';
    v_component_confidence := 'HIGH';
  end if;

  if v_component_category is null and nullif(trim(c.causing_part_no),'') is not null then
    select x.category into v_candidate_category
    from (
      select trim(policy_component_category) as category,
             count(*) as n,
             count(*) over () as category_count
      from public.claims
      where archived_at is null
        and claim_id <> c.claim_id
        and upper(trim(coalesce(causing_part_no,''))) = upper(trim(c.causing_part_no))
        and nullif(trim(policy_component_category),'') is not null
      group by trim(policy_component_category)
    ) x
    where x.category_count = 1
    order by x.n desc
    limit 1;
    if v_candidate_category is not null then
      v_component_category := v_candidate_category;
      v_component_source := 'HISTORICAL_CONFIRMED_CLAIMS';
      v_component_confidence := 'MEDIUM_HIGH';
    end if;
  end if;

  if nullif(trim(c.causing_part_no),'') is not null then
    select pm.part_name into v_component_identity
    from public.parts_master pm
    where pm.is_active = true
      and upper(trim(pm.part_no)) = upper(trim(c.causing_part_no))
    order by pm.updated_at desc nulls last, pm.created_at desc nulls last
    limit 1;
    if v_component_identity is not null then
      v_component_identity_source := 'EXACT_PARTS_MASTER';
      v_component_identity_confidence := 'HIGH';
    end if;
  end if;
  if v_component_identity is null then
    v_component_identity := nullif(trim(coalesce(c.causing_part_desc,'')),'');
    if v_component_identity is not null then
      v_component_identity_source := 'CLAIM_DESCRIPTION';
      v_component_identity_confidence := 'MEDIUM_HIGH';
    end if;
  end if;

  if v_component_category is null and v_product_family is not null and v_evidence <> '' then
    for tax in
      select t.term,t.component_category,t.priority,t.source_type
      from public.sdlg_policy_component_taxonomy t
      where t.is_active = true
        and (t.product_family is null or lower(t.product_family)=lower(v_product_family))
        and position(lower(trim(t.term)) in lower(v_evidence)) > 0
      order by t.priority asc, length(t.term) desc
    loop
      if v_component_category is null then
        v_component_category := tax.component_category;
        v_candidate_term := tax.term;
        v_candidate_source_type := tax.source_type;
        v_hit_count := 1;
      elsif lower(tax.component_category)=lower(v_component_category) then
        v_hit_count := v_hit_count + 1;
      end if;
    end loop;
    if v_component_category is not null then
      if upper(trim(coalesce(v_candidate_term,''))) = upper(trim(coalesce(c.causing_part_no,'')))
         and upper(trim(coalesce(v_candidate_source_type,''))) = 'MANUAL_APPROVAL' then
        v_component_source := 'MANUAL_APPROVED_PART_OVERRIDE';
        v_component_confidence := 'HIGH';
      elsif v_hit_count >= 2 then
        v_component_source := 'CONTROLLED_TAXONOMY_MULTI_EVIDENCE';
        v_component_confidence := 'HIGH';
      else
        v_component_source := 'CONTROLLED_TAXONOMY_SINGLE_EVIDENCE';
        v_component_confidence := 'MEDIUM_HIGH';
      end if;
      if v_component_identity is null then
        v_component_identity := v_candidate_term;
        v_component_identity_source := 'CONTROLLED_TAXONOMY';
        v_component_identity_confidence := case when v_hit_count >= 2 then 'HIGH' else 'MEDIUM_HIGH' end;
      end if;
    end if;
  end if;

  if v_product_family is not null and v_model_scope is not null and v_commencement_date is not null then
    for r in
      select * from public.service_policy_warranty_rules w
      where lower(w.product_family)=lower(v_product_family)
        and lower(w.model_scope)=lower(v_model_scope)
      order by w.component_category
    loop
      v_months := case when v_contract_effective then r.contract_months else r.standard_months end;
      v_hours := case when v_contract_effective then r.contract_hours else r.standard_hours end;
      -- Agreed SDLG rule: B/L maximum = applicable warranty duration + 6 months.
      v_bl_cap_months := case when v_months is not null then v_months + 6 else null end;
      v_after_sales_expiry := case when v_commencement_date is not null and v_months is not null then (v_commencement_date + (v_months||' months')::interval)::date else null end;
      v_after_departure_expiry := case when m.bill_of_lading_date is not null and v_bl_cap_months is not null then (m.bill_of_lading_date + (v_bl_cap_months||' months')::interval)::date else null end;
      v_effective_expiry := case when v_after_sales_expiry is null then v_after_departure_expiry when v_after_departure_expiry is null then v_after_sales_expiry else least(v_after_sales_expiry,v_after_departure_expiry) end;
      v_date_ok := case when v_failure_date is null or v_effective_expiry is null then null else v_failure_date <= v_effective_expiry end;
      v_hours_ok := case when v_hours is null then true when v_failure_hm is null then null else v_failure_hm <= v_hours end;
      if v_date_ok is false or v_hours_ok is false then v_status:='OUT_OF_WARRANTY'; v_machine_any_out:=true;
      elsif v_date_ok is null or v_hours_ok is null then v_status:='UNKNOWN'; v_machine_any_unknown:=true;
      else v_status:='IN_WARRANTY'; v_machine_any_in:=true; end if;
      v_reason := case when v_date_ok is false and v_hours_ok is false then 'Failure date and HM exceed the applicable warranty limits' when v_date_ok is false then format('Failure date %s is after effective out-of-warranty date %s',v_failure_date,v_effective_expiry) when v_hours_ok is false then format('Failure HM %s exceeds warranty limit %s',v_failure_hm,v_hours) when v_date_ok is null and v_hours_ok is null then 'Failure date and HM are required to assess this policy' when v_date_ok is null then 'Failure date is required to assess this policy' when v_hours_ok is null then 'Failure HM is required to assess this policy' else 'Failure is within policy calendar and hour limits, including the B/L maximum ceiling' end;
      v_machine_policies := v_machine_policies || jsonb_build_array(jsonb_build_object(
        'component_category',r.component_category,'status',v_status,'reason',v_reason,
        'warranty_tier_used',v_tier,'warranty_months',v_months,'warranty_hours',v_hours,
        'standard_months',r.standard_months,'standard_hours',r.standard_hours,
        'contract_months',r.contract_months,'contract_hours',r.contract_hours,
        'after_sales_expiry_date',v_after_sales_expiry,'after_departure_expiry_date',v_after_departure_expiry,
        'effective_expiry_date',v_effective_expiry,'date_check',v_date_ok,'hour_check',v_hours_ok,
        'bill_of_lading_date',m.bill_of_lading_date,'bill_of_lading_cap_months',v_bl_cap_months,
        'failure_date',v_failure_date,'failure_hm',v_failure_hm,
        'is_claim_component', lower(trim(r.component_category))=lower(trim(coalesce(v_component_category,'')))
      ));
      if v_component_category is not null and lower(trim(r.component_category)) = lower(trim(v_component_category)) then
        v_component_rule := jsonb_build_object(
          'component_category',r.component_category,'status',v_status,'reason',v_reason,
          'warranty_tier_used',v_tier,'warranty_months',v_months,'warranty_hours',v_hours,
          'standard_months',r.standard_months,'standard_hours',r.standard_hours,
          'contract_months',r.contract_months,'contract_hours',r.contract_hours,
          'after_sales_expiry_date',v_after_sales_expiry,'after_departure_expiry_date',v_after_departure_expiry,
          'effective_expiry_date',v_effective_expiry,'date_check',v_date_ok,'hour_check',v_hours_ok,
          'bill_of_lading_date',m.bill_of_lading_date,'bill_of_lading_cap_months',v_bl_cap_months,
          'failure_date',v_failure_date,'failure_hm',v_failure_hm,'notes',r.notes
        );
      end if;
    end loop;
  end if;

  if v_machine_any_in and not v_machine_any_out then
    v_machine_reason := 'Unit is within at least one applicable warranty policy category.';
  elsif v_machine_any_out and not v_machine_any_in then
    v_machine_reason := 'Unit exceeds all applicable warranty policy categories.';
  elsif v_machine_any_in then
    v_machine_reason := 'Unit has mixed category outcomes; failed component classification determines claim eligibility.';
  else
    v_machine_reason := 'Insufficient data or no applicable warranty policy rule.';
  end if;

  if v_component_rule is not null then
    v_component_status := v_component_rule->>'status';
    v_component_reason := v_component_rule->>'reason';
  end if;

  -- Marketing warranty is assessed independently from the SDLG B/L ceiling.
  if v_component_rule is not null then
    v_marketing_months := (v_component_rule->>'warranty_months')::numeric;
    v_marketing_hours := (v_component_rule->>'warranty_hours')::numeric;
    v_marketing_expiry := case
      when coalesce(m.sale_date,c.sales_date) is not null and v_marketing_months is not null
      then (coalesce(m.sale_date,c.sales_date) + (v_marketing_months||' months')::interval)::date
      else null
    end;
    v_marketing_date_ok := case when v_failure_date is null or v_marketing_expiry is null then null else v_failure_date <= v_marketing_expiry end;
    v_marketing_hours_ok := case when v_marketing_hours is null then true when v_failure_hm is null then null else v_failure_hm <= v_marketing_hours end;
    if v_marketing_date_ok is false or v_marketing_hours_ok is false then
      v_marketing_status := 'OUT_OF_WARRANTY';
      v_marketing_reason := case
        when v_marketing_date_ok is false and v_marketing_hours_ok is false then 'Failure date and HM exceed the Marketing warranty limits'
        when v_marketing_date_ok is false then format('Failure date %s is after Marketing warranty expiry %s',v_failure_date,v_marketing_expiry)
        else format('Failure HM %s exceeds Marketing warranty limit %s',v_failure_hm,v_marketing_hours)
      end;
    elsif v_marketing_date_ok is null or v_marketing_hours_ok is null then
      v_marketing_status := 'REVIEW_REQUIRED';
      v_marketing_reason := 'Marketing warranty cannot be conclusively assessed from available dates/HM.';
    else
      v_marketing_status := 'IN_WARRANTY';
      v_marketing_reason := format('Failure is within Sales Date warranty expiry %s and HM limit %s.',v_marketing_expiry,v_marketing_hours);
    end if;
  end if;

  if v_component_rule is null then
    v_final_route := 'REVIEW_REQUIRED';
    v_final_route_reason := 'Failed component policy category is unresolved.';
  elsif v_component_status = 'IN_WARRANTY' then
    v_final_route := 'SDLG';
    v_final_route_reason := 'Resolved failed component is within SDLG warranty.';
  elsif v_component_status = 'OUT_OF_WARRANTY' and v_marketing_status = 'IN_WARRANTY' then
    v_final_route := 'MARKETING';
    v_final_route_reason := 'SDLG warranty is expired; Sales Date warranty is still active.';
  elsif v_component_status = 'OUT_OF_WARRANTY' and v_marketing_status = 'OUT_OF_WARRANTY' then
    v_final_route := 'NON_WARRANTY';
    v_final_route_reason := 'Both SDLG and Marketing warranty are expired.';
  else
    v_final_route := 'REVIEW_REQUIRED';
    v_final_route_reason := 'Warranty assessments are not conclusive.';
  end if;

  return jsonb_build_object(
    'claim_id',c.claim_id,'model',c.model,'serial_no',c.serial_no,'customer',c.customer,
    'product_family',v_product_family,'model_scope',v_model_scope,
    'contract_customer_effective',v_contract_effective,'warranty_tier_used',v_tier,
    'contract_resolution_source',case when coalesce(m.contract_customer,false) then 'MACHINE_MASTER' when m.bill_of_lading_date < date '2026-01-01' then 'B/L_CONTINUITY_RULE' else 'STANDARD_DEFAULT' end,
    'component_category',v_component_category,'component_category_source',v_component_source,'component_category_confidence',v_component_confidence,
    'component_identity',v_component_identity,'component_identity_source',v_component_identity_source,'component_identity_confidence',v_component_identity_confidence,
    'commencement_basis',case when m.operation_start_date is not null then 'OPERATION_START_DATE' when coalesce(m.sale_date,c.sales_date) is not null then 'SALE_DATE' else 'UNRESOLVED' end,
    'commencement_date',v_commencement_date,'bill_of_lading_date',m.bill_of_lading_date,
    'failure_date',v_failure_date,'failure_hm',v_failure_hm,
    'warranty_months',case when v_component_rule is null then null else (v_component_rule->>'warranty_months')::numeric end,
    'warranty_hours',case when v_component_rule is null then null else (v_component_rule->>'warranty_hours')::numeric end,
    'after_sales_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'after_sales_expiry_date')::date end,
    'after_departure_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'after_departure_expiry_date')::date end,
    'effective_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'effective_expiry_date')::date end,
    'machine_status',case when v_machine_any_in and not v_machine_any_out then 'IN_WARRANTY' when v_machine_any_out and not v_machine_any_in then 'OUT_OF_WARRANTY' when v_machine_any_in then 'MIXED_POLICY' else 'UNKNOWN' end,
    'machine_reason',v_machine_reason,'component_status',v_component_status,'component_reason',v_component_reason,
    'overall_status',case when v_component_rule is null then 'REVIEW_REQUIRED' when v_component_status='IN_WARRANTY' then 'ELIGIBLE' when v_component_status='OUT_OF_WARRANTY' then 'NOT_ELIGIBLE' else 'REVIEW_REQUIRED' end,
    'overall_reason',case when v_component_rule is null then 'Machine is assessable, but the failed component still needs a warranty-category resolution.' when v_component_status='IN_WARRANTY' then 'Machine and resolved failed component are within the applicable warranty limits.' when v_component_status='OUT_OF_WARRANTY' then v_component_reason else 'Warranty component assessment is not conclusive.' end,
    'final_route',v_final_route,
    'final_route_reason',v_final_route_reason,
    'sdlg_assessment',jsonb_build_object(
      'status',case when v_component_rule is null then 'REVIEW_REQUIRED' else v_component_status end,
      'warranty_months',case when v_component_rule is null then null else (v_component_rule->>'warranty_months')::numeric end,
      'warranty_hours',case when v_component_rule is null then null else (v_component_rule->>'warranty_hours')::numeric end,
      'sales_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'after_sales_expiry_date')::date end,
      'bill_of_lading_date',m.bill_of_lading_date,
      'bill_of_lading_cap_months',case when v_component_rule is null then null else (v_component_rule->>'bill_of_lading_cap_months')::numeric end,
      'bill_of_lading_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'after_departure_expiry_date')::date end,
      'effective_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'effective_expiry_date')::date end,
      'failure_date',v_failure_date,'failure_hm',v_failure_hm,
      'reason',case when v_component_rule is null then 'Component policy category unresolved.' else v_component_reason end
    ),
    'marketing_assessment',jsonb_build_object(
      'status',v_marketing_status,
      'warranty_months',v_marketing_months,
      'warranty_hours',v_marketing_hours,
      'sales_date',coalesce(m.sale_date,c.sales_date),
      'expiry_date',v_marketing_expiry,
      'failure_date',v_failure_date,'failure_hm',v_failure_hm,
      'date_check',v_marketing_date_ok,'hour_check',v_marketing_hours_ok,
      'reason',v_marketing_reason
    ),
    'component_rule',v_component_rule,'machine_policies',v_machine_policies,
    'evidence_summary',jsonb_build_object('evidence_text',v_evidence,'resolution_hierarchy',jsonb_build_array('CLAIM_POLICY_FIELD','MACHINE_MASTER','HISTORICAL_CONFIRMED_CLAIMS','EXACT_PARTS_MASTER','CONTROLLED_TAXONOMY','UNKNOWN')),
    'policy_code','SDLG_SERVICE_POLICY_2026'
  );
end;
$function$;
