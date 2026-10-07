-- Harden warranty resolution views to invoke caller permissions/RLS.
-- Add the source-document FK index for policy-master lookup integrity/performance.

alter view public.machine_warranty_policy_v set (security_invoker = true);
alter view public.claim_warranty_resolution_v set (security_invoker = true);
alter view public.claim_warranty_policy_v set (security_invoker = true);

create index if not exists idx_sdlg_policy_part_master_source_document
  on public.sdlg_policy_part_master(source_document_id);
