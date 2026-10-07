-- One summary row per branch. Branch identity comes from primary_resource_group-derived branch_name;
-- unit location must not split the branch KPI.

CREATE OR REPLACE VIEW public.wo_outstanding_by_branch_v AS
SELECT
  COALESCE(NULLIF(btrim(branch_name),''),'(unmapped)') AS branch_location,
  COUNT(*) AS wm_wo_total,
  COUNT(*) FILTER (WHERE outstanding_class='NO_REPORT') AS no_report,
  COUNT(*) FILTER (WHERE outstanding_class='IN_CLAIM_PIPELINE') AS in_claim_pipeline,
  COUNT(*) FILTER (WHERE outstanding_class='REJECTED_NEED_CASE_GROUP_CORRECTION') AS rejected_need_correction,
  COUNT(*) FILTER (WHERE outstanding_class='PAID_CLOSED') AS paid_closed,
  COUNT(*) FILTER (WHERE include_in_branch_followup) AS branch_followup_count,
  ROUND(AVG(aging_days) FILTER (WHERE include_in_branch_followup),1) AS avg_aging_followup_days,
  MAX(aging_days) FILTER (WHERE include_in_branch_followup) AS max_aging_followup_days,
  COALESCE(NULLIF(btrim(branch_name),''),'(unmapped)') AS branch_name
FROM public.wo_outstanding_v
GROUP BY COALESCE(NULLIF(btrim(branch_name),''),'(unmapped)');