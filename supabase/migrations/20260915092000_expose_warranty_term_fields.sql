-- Keep the canonical warranty resolver as the single source of truth.
-- Expose the component-rule term/expiry fields at the top level so the UI
-- does not need to understand the resolver's internal component-rule shape.
DO $do$
declare
  def text;
  target text := $q$'failure_date',v_failure_date,'failure_hm',v_failure_hm,
    'machine_status'$q$;
  replacement text := $q$'failure_date',v_failure_date,'failure_hm',v_failure_hm,
    'warranty_months',case when v_component_rule is null then null else (v_component_rule->>'warranty_months')::numeric end,
    'warranty_hours',case when v_component_rule is null then null else (v_component_rule->>'warranty_hours')::numeric end,
    'after_sales_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'after_sales_expiry_date')::date end,
    'after_departure_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'after_departure_expiry_date')::date end,
    'effective_expiry_date',case when v_component_rule is null then null else (v_component_rule->>'effective_expiry_date')::date end,
    'machine_status'$q$;
begin
  select pg_get_functiondef('public.sdlg_warranty_resolve_claim(text)'::regprocedure) into def;
  if position(target in def) = 0 then
    raise exception 'Resolver patch target not found';
  end if;
  def := replace(def, target, replacement);
  execute def;
end $do$;
