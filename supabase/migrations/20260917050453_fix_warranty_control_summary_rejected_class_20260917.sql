create or replace view public.warranty_control_summary_v
with (security_invoker = true)
as
select
  (select count(*) from public.wo_warranty_universe_v) as valid_warranty_wo,
  (select count(*) from public.wo_outstanding_v where include_in_branch_followup) as branch_followup_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='NO_REPORT') as no_report_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='IN_CLAIM_PIPELINE') as claim_pipeline_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='PAID_CLOSED') as paid_closed_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='REJECTED_NEED_CASE_GROUP_CORRECTION') as rejected_followup_wo,
  (select count(*) from public.claims where archived_at is null) as active_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='SDLG Audit') as sdlg_audit_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='Paid') as paid_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='Rejected') as rejected_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='Draft') as draft_claims,
  (select count(*) from public.sdlg_settlements) as settlement_rows,
  (select count(*) from public.sdlg_settlement_disputes where status not in ('RESOLVED','CLOSED')) as open_disputes;

grant select on public.warranty_control_summary_v to authenticated;
revoke all on public.warranty_control_summary_v from anon;
