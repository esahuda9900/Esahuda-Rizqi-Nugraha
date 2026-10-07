-- Loader HVAC component classification.
-- The 2026 service policy groups compressors/accessories/other components
-- outside the Key Components bucket. These exact HVAC terms are therefore
-- classified as Other parts by explicit application approval.
--
-- This is a controlled mapping, not a claim that the policy explicitly names
-- each term as "Other parts".

insert into public.sdlg_policy_component_taxonomy
  (product_family, term, component_category, source_type, priority, is_active)
select v.product_family, v.term, v.component_category, v.source_type, v.priority, true
from (
  values
    ('Loader', 'Evaporator', 'Other parts', 'MANUAL_APPROVAL', 5),
    ('Loader', 'Expansion Valve', 'Other parts', 'MANUAL_APPROVAL', 5),
    ('Loader', 'Reservoir', 'Other parts', 'MANUAL_APPROVAL', 5)
) as v(product_family, term, component_category, source_type, priority)
where not exists (
  select 1
  from public.sdlg_policy_component_taxonomy t
  where lower(coalesce(t.product_family,'')) = lower(v.product_family)
    and lower(trim(t.term)) = lower(v.term)
);
