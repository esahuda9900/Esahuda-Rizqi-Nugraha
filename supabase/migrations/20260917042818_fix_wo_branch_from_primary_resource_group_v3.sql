-- Align WO warranty branch identity with AX primary_resource_group.
-- Keep existing view column order intact; add canonical branch metadata after the existing columns.

CREATE OR REPLACE VIEW public.wo_warranty_universe_v AS
SELECT
  wo.wo_no,
  wo.case_group,
  wo.wo_type,
  wo.status AS ax_status,
  wo.created_date,
  wo.start_date,
  COALESCE(wo.start_date, wo.created_date) AS aging_anchor_date,
  CASE WHEN COALESCE(wo.start_date, wo.created_date) IS NULL THEN NULL::integer ELSE (CURRENT_DATE - COALESCE(wo.start_date, wo.created_date)) END AS aging_days,
  wo.serial_no,
  wo.chassis_no,
  wo.location AS branch_location,
  wo.location2,
  wo.description,
  wo.customer_account,
  wo.device_name,
  wo.person_in_charge,
  wo.primary_resource,
  wo.source_quality_status,
  upper(regexp_replace(COALESCE(btrim(wo.wo_no), ''::text), '[^A-Za-z0-9]'::text, ''::text, 'g'::text)) AS wo_key,
  wo.primary_resource_group,
  CASE
    WHEN upper(trim(coalesce(wo.primary_resource_group,''))) = 'ITR - JAKARTA BRANCH' THEN 'JAKARTA'
    WHEN upper(trim(coalesce(wo.primary_resource_group,''))) = 'ITR - MAKASAR' THEN 'MAKASSAR'
    WHEN upper(trim(coalesce(wo.primary_resource_group,''))) = 'ITR - MUARA ENIM' THEN 'TANJUNG ENIM'
    WHEN upper(trim(coalesce(wo.primary_resource_group,''))) LIKE 'ITR - %' THEN trim(substr(wo.primary_resource_group, 7))
    ELSE NULL
  END AS branch_name,
  CASE WHEN upper(trim(coalesce(wo.primary_resource_group,''))) LIKE 'ITR - %' THEN 'PRIMARY_RESOURCE_GROUP' ELSE 'UNMAPPED' END AS branch_source
FROM public.ax_warranty_work_orders wo
WHERE wo.source_quality_status='OK'
  AND upper(btrim(COALESCE(wo.case_group,''))) LIKE 'WM%'
  AND upper(btrim(COALESCE(wo.status,''))) <> 'CANCELED';

CREATE OR REPLACE VIEW public.wo_outstanding_v AS
WITH claim_by_wo AS (
  SELECT upper(regexp_replace(COALESCE(btrim(c.dealer_wo_so), ''::text), '[^A-Za-z0-9]'::text, ''::text, 'g'::text)) AS wo_key,
    c.claim_id,c.claim_status,c.dealer_claim_no,c.branch AS claim_branch,c.rejection_reason,c.status_update_reason,c.payment_amount,c.payment_date,c.dealer_claim_date,c.total_amount AS claim_fob_amount,c.currency AS claim_currency,
    EXISTS (SELECT 1 FROM public.sdlg_settlements s JOIN public.sdlg_payment_batch_settlements pbs ON pbs.settlement_id=s.id JOIN public.sdlg_payment_batches b ON b.id=pbs.batch_id WHERE s.claim_id=c.claim_id AND b.payment_status='RECEIVED') AS is_batch_paid
  FROM public.claims c WHERE c.archived_at IS NULL AND NULLIF(btrim(c.dealer_wo_so),'') IS NOT NULL
), ranked AS (
  SELECT cb.*, row_number() OVER (PARTITION BY cb.wo_key ORDER BY CASE WHEN cb.is_batch_paid THEN 1 WHEN cb.claim_status='Paid' THEN 2 WHEN cb.claim_status='Rejected' THEN 3 WHEN cb.claim_status='On Hold' THEN 4 WHEN cb.claim_status='SDLG Audit' THEN 5 ELSE 6 END, cb.claim_id) rn
  FROM claim_by_wo cb WHERE NULLIF(cb.wo_key,'') IS NOT NULL
)
SELECT
  u.wo_no,u.case_group,u.ax_status,u.branch_location,u.aging_anchor_date,u.aging_days,
  CASE WHEN u.aging_days IS NULL THEN 'UNKNOWN' WHEN u.aging_days<30 THEN '0-29d' WHEN u.aging_days<90 THEN '30-89d' WHEN u.aging_days<180 THEN '90-179d' WHEN u.aging_days<300 THEN '180-299d' ELSE '300d+' END AS aging_bucket,
  u.serial_no,u.chassis_no,u.description,u.person_in_charge,
  r.claim_id,r.claim_status,r.dealer_claim_no,r.claim_branch,r.rejection_reason,r.status_update_reason,r.payment_amount,r.payment_date,r.dealer_claim_date,r.claim_fob_amount,r.claim_currency,COALESCE(r.is_batch_paid,false) AS is_batch_paid,
  CASE WHEN r.claim_id IS NULL THEN 'NO_REPORT' WHEN COALESCE(r.is_batch_paid,false) THEN 'PAID_CLOSED' WHEN r.claim_status IN ('Rejected','On Hold') THEN 'REJECTED_NEED_CASE_GROUP_CORRECTION' WHEN r.claim_status IN ('SDLG Audit','Submitted to SDLG','Claimed to SDLG','Approved','Billing') THEN 'IN_CLAIM_PIPELINE' WHEN r.claim_status='Paid' AND NOT COALESCE(r.is_batch_paid,false) THEN 'CLAIM_MARKED_PAID_NOT_IN_BATCH' ELSE 'IN_CLAIM_PIPELINE' END AS outstanding_class,
  CASE WHEN r.claim_id IS NULL THEN 'BRANCH' WHEN COALESCE(r.is_batch_paid,false) THEN 'CLOSED' WHEN r.claim_status='Rejected' THEN 'BRANCH' WHEN r.claim_status='On Hold' THEN 'SDLG' WHEN r.claim_status IN ('SDLG Audit','Submitted to SDLG','Claimed to SDLG') THEN 'SDLG' WHEN r.claim_status IN ('Approved','Billing') THEN 'HO_FINANCE' ELSE 'HO_WARRANTY_ADMIN' END AS ball_in_court,
  CASE WHEN r.claim_id IS NULL THEN true WHEN r.claim_status IN ('Rejected','On Hold') THEN true ELSE false END AS include_in_branch_followup,
  CASE WHEN r.claim_id IS NULL THEN 'No claim in system = no report. Branch: prepare report or move case group out of WM.' WHEN COALESCE(r.is_batch_paid,false) THEN 'Paid via settlement batch + debit note. Closed.' WHEN r.claim_status='Rejected' THEN 'Claim rejected. Branch must move WO case group out of WM. Reason: ' || COALESCE(r.rejection_reason,r.status_update_reason,'(not recorded)') WHEN r.claim_status='On Hold' THEN 'Reject-class for branch follow-up; principal clarification pending.' WHEN r.claim_status IN ('SDLG Audit','Submitted to SDLG','Claimed to SDLG') THEN 'Claim in SDLG pipeline. Ball at principal.' ELSE 'Monitor at HO.' END AS action_hint,
  u.primary_resource_group,u.primary_resource,u.branch_name,u.branch_source,u.location2 AS unit_location2
FROM public.wo_warranty_universe_v u LEFT JOIN ranked r ON r.wo_key=u.wo_key AND r.rn=1;