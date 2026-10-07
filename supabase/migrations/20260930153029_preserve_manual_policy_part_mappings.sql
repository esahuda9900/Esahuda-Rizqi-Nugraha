-- Preserve exact manual policy mappings in the new authoritative part master.
-- Only exact SDLG part-number taxonomy entries are copied. Generic terms remain
-- non-authoritative helper vocabulary.
insert into public.sdlg_policy_part_master
  (part_no,product_family,machine_coverage_class,component_category,
   classification_basis,source_document_id,source_section,confidence,
   review_required,review_reason,notes)
select
  upper(trim(t.term)),
  trim(t.product_family),
  case
    when lower(trim(t.component_category)) = 'key components' then 'KEY_COMPONENT'
    when lower(trim(t.component_category)) in ('other parts','other components','other machine components')
      then 'OTHER_WARRANTABLE_PART'
    else 'UNKNOWN_REQUIRES_REVIEW'
  end,
  trim(t.component_category),
  'MANUAL_APPROVED_POLICY_MAPPING',
  d.id,
  'APPLICATION_APPROVED_MAPPING',
  'HIGH',
  false,
  null,
  'Preserved from an existing exact part-number manual approval. This exact part/family mapping takes precedence over generic name-based candidates.'
from public.sdlg_policy_component_taxonomy t
cross join lateral (
  select id
  from public.service_policy_documents
  where title='2026 Service Policy'
  limit 1
) d
where t.is_active=true
  and upper(trim(coalesce(t.source_type,'')))='MANUAL_APPROVAL'
  and upper(trim(coalesce(t.term,''))) like 'SLG-%'
  and nullif(trim(t.product_family),'') is not null
on conflict (upper(trim(part_no)),lower(trim(product_family))) do update
set
  machine_coverage_class=excluded.machine_coverage_class,
  component_category=excluded.component_category,
  classification_basis=excluded.classification_basis,
  source_document_id=excluded.source_document_id,
  source_section=excluded.source_section,
  confidence=excluded.confidence,
  review_required=false,
  review_reason=null,
  notes=excluded.notes,
  updated_at=now();
