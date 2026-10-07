-- Applied on production as wo_outstanding_and_dispute_rejected_v3
-- Warranty WO = case_group WM% (not wo_type WAR)
-- Paid = member of RECEIVED payment batch only
-- Report exists = claim row exists for that WO number

INSERT INTO public.claim_workflow_transitions (from_status, to_status)
SELECT 'On Hold', 'Rejected'
WHERE NOT EXISTS (
  SELECT 1 FROM public.claim_workflow_transitions
  WHERE from_status = 'On Hold' AND to_status = 'Rejected'
);

UPDATE public.claims c
SET claim_status = 'Rejected',
    status_date = DATE '2026-09-15',
    status_update_reason = 'Rejected by SDLG: out of warranty (OOW). Excluded from payment batch SDLG-PAY-2026-09-15-01. Clarification requested to SDLG; awaiting principal response. Branch should move WO case group out of WM….',
    rejection_reason = COALESCE(NULLIF(btrim(c.rejection_reason), ''), 'SDLG OOW — out of warranty; excluded from paid settlement batch'),
    last_updated = now()
WHERE c.archived_at IS NULL
  AND c.claim_id IN ('0022-2026-SDLG-PFR', '0097-2026-SDLG-PFR')
  AND c.claim_status IN ('On Hold', 'SDLG Audit', 'Rejected');

INSERT INTO public.claim_status_history (claim_id, status, status_date, reason)
SELECT v.claim_id, 'Rejected', DATE '2026-09-15',
       'Rejected by SDLG: out of warranty (OOW). Excluded from payment batch. Clarification requested to SDLG; branch should correct WO case group out of WM….'
FROM (VALUES ('0022-2026-SDLG-PFR'), ('0097-2026-SDLG-PFR')) AS v(claim_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.claim_status_history h
  WHERE h.claim_id = v.claim_id AND h.status = 'Rejected' AND h.status_date = DATE '2026-09-15'
);

UPDATE public.sdlg_settlement_disputes
SET status = 'REJECTED_OOW',
    reason = 'SDLG rejected as out of warranty. Excluded from paid batch. Clarification asked to SDLG; ball with principal. Branch must move case group out of WM….',
    updated_at = now()
WHERE tsi IN ('ORF-260203-0017', 'ORF-260421-0021');

CREATE OR REPLACE VIEW public.wo_warranty_universe_v
WITH (security_invoker = true)
AS
SELECT
  wo.wo_no,
  wo.case_group,
  wo.wo_type,
  wo.status AS ax_status,
  wo.created_date,
  wo.start_date,
  COALESCE(wo.start_date, wo.created_date) AS aging_anchor_date,
  CASE
    WHEN COALESCE(wo.start_date, wo.created_date) IS NULL THEN NULL
    ELSE (CURRENT_DATE - COALESCE(wo.start_date, wo.created_date))
  END AS aging_days,
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
  upper(regexp_replace(COALESCE(btrim(wo.wo_no), ''), '[^A-Za-z0-9]', '', 'g')) AS wo_key
FROM public.ax_warranty_work_orders wo
WHERE wo.source_quality_status = 'OK'
  AND upper(btrim(COALESCE(wo.case_group, ''))) LIKE 'WM%'
  AND upper(btrim(COALESCE(wo.status, ''))) <> 'CANCELED';

CREATE OR REPLACE VIEW public.wo_outstanding_v
WITH (security_invoker = true)
AS
WITH claim_by_wo AS (
  SELECT
    upper(regexp_replace(COALESCE(btrim(c.dealer_wo_so), ''), '[^A-Za-z0-9]', '', 'g')) AS wo_key,
    c.claim_id,
    c.claim_status,
    c.dealer_claim_no,
    c.branch AS claim_branch,
    c.rejection_reason,
    c.status_update_reason,
    c.payment_amount,
    c.payment_date,
    c.dealer_claim_date,
    c.total_amount AS claim_fob_amount,
    c.currency AS claim_currency,
    EXISTS (
      SELECT 1
      FROM public.sdlg_settlements s
      JOIN public.sdlg_payment_batch_settlements pbs ON pbs.settlement_id = s.id
      JOIN public.sdlg_payment_batches b ON b.id = pbs.batch_id
      WHERE s.claim_id = c.claim_id
        AND b.payment_status = 'RECEIVED'
    ) AS is_batch_paid
  FROM public.claims c
  WHERE c.archived_at IS NULL
    AND nullif(btrim(c.dealer_wo_so), '') IS NOT NULL
),
ranked AS (
  SELECT cb.*,
    row_number() OVER (
      PARTITION BY cb.wo_key
      ORDER BY CASE
        WHEN cb.is_batch_paid THEN 1
        WHEN cb.claim_status = 'Paid' THEN 2
        WHEN cb.claim_status = 'Rejected' THEN 3
        WHEN cb.claim_status = 'On Hold' THEN 4
        WHEN cb.claim_status = 'SDLG Audit' THEN 5
        ELSE 6
      END, cb.claim_id
    ) AS rn
  FROM claim_by_wo cb
  WHERE nullif(cb.wo_key, '') IS NOT NULL
)
SELECT
  u.wo_no, u.case_group, u.ax_status, u.branch_location,
  u.aging_anchor_date, u.aging_days,
  CASE
    WHEN u.aging_days IS NULL THEN 'UNKNOWN'
    WHEN u.aging_days < 30 THEN '0-29d'
    WHEN u.aging_days < 90 THEN '30-89d'
    WHEN u.aging_days < 180 THEN '90-179d'
    WHEN u.aging_days < 300 THEN '180-299d'
    ELSE '300d+'
  END AS aging_bucket,
  u.serial_no, u.chassis_no, u.description, u.person_in_charge,
  r.claim_id, r.claim_status, r.dealer_claim_no, r.claim_branch,
  r.rejection_reason, r.status_update_reason,
  r.payment_amount, r.payment_date, r.dealer_claim_date,
  r.claim_fob_amount, r.claim_currency,
  COALESCE(r.is_batch_paid, false) AS is_batch_paid,
  CASE
    WHEN r.claim_id IS NULL THEN 'NO_REPORT'
    WHEN COALESCE(r.is_batch_paid, false) THEN 'PAID_CLOSED'
    WHEN r.claim_status IN ('Rejected', 'On Hold') THEN 'REJECTED_NEED_CASE_GROUP_CORRECTION'
    WHEN r.claim_status IN ('SDLG Audit', 'Submitted to SDLG', 'Claimed to SDLG', 'Approved', 'Billing') THEN 'IN_CLAIM_PIPELINE'
    WHEN r.claim_status = 'Paid' AND NOT COALESCE(r.is_batch_paid, false) THEN 'CLAIM_MARKED_PAID_NOT_IN_BATCH'
    ELSE 'IN_CLAIM_PIPELINE'
  END AS outstanding_class,
  CASE
    WHEN r.claim_id IS NULL THEN 'BRANCH'
    WHEN COALESCE(r.is_batch_paid, false) THEN 'CLOSED'
    WHEN r.claim_status = 'Rejected' THEN 'BRANCH'
    WHEN r.claim_status = 'On Hold' THEN 'SDLG'
    WHEN r.claim_status IN ('SDLG Audit', 'Submitted to SDLG', 'Claimed to SDLG') THEN 'SDLG'
    WHEN r.claim_status IN ('Approved', 'Billing') THEN 'HO_FINANCE'
    ELSE 'HO_WARRANTY_ADMIN'
  END AS ball_in_court,
  CASE
    WHEN r.claim_id IS NULL THEN true
    WHEN r.claim_status IN ('Rejected', 'On Hold') THEN true
    ELSE false
  END AS include_in_branch_followup,
  CASE
    WHEN r.claim_id IS NULL THEN 'No claim in system = no report. Branch: prepare report or move case group out of WM.'
    WHEN COALESCE(r.is_batch_paid, false) THEN 'Paid via settlement batch + debit note. Closed.'
    WHEN r.claim_status = 'Rejected' THEN 'Claim rejected. Branch must move WO case group out of WM. Reason: ' || COALESCE(r.rejection_reason, r.status_update_reason, '(not recorded)')
    WHEN r.claim_status IN ('SDLG Audit', 'Submitted to SDLG', 'Claimed to SDLG') THEN 'Claim in SDLG pipeline. Ball at principal.'
    ELSE 'Monitor at HO.'
  END AS action_hint
FROM public.wo_warranty_universe_v u
LEFT JOIN ranked r ON r.wo_key = u.wo_key AND r.rn = 1;

CREATE OR REPLACE VIEW public.wo_outstanding_summary_v
WITH (security_invoker = true)
AS
SELECT
  count(*) AS wm_wo_total,
  count(*) FILTER (WHERE outstanding_class = 'NO_REPORT') AS no_report,
  count(*) FILTER (WHERE outstanding_class = 'IN_CLAIM_PIPELINE') AS in_claim_pipeline,
  count(*) FILTER (WHERE outstanding_class = 'REJECTED_NEED_CASE_GROUP_CORRECTION') AS rejected_need_correction,
  count(*) FILTER (WHERE outstanding_class = 'PAID_CLOSED') AS paid_closed,
  count(*) FILTER (WHERE outstanding_class = 'CLAIM_MARKED_PAID_NOT_IN_BATCH') AS paid_flag_not_in_batch,
  count(*) FILTER (WHERE include_in_branch_followup) AS branch_followup_count,
  count(*) FILTER (WHERE ball_in_court = 'BRANCH') AS ball_branch,
  count(*) FILTER (WHERE ball_in_court = 'SDLG') AS ball_sdlg,
  count(*) FILTER (WHERE ball_in_court = 'HO_WARRANTY_ADMIN') AS ball_ho_wa,
  count(*) FILTER (WHERE ball_in_court = 'HO_FINANCE') AS ball_ho_finance,
  count(*) FILTER (WHERE ball_in_court = 'CLOSED') AS ball_closed,
  count(*) FILTER (WHERE aging_bucket = '0-29d') AS age_0_29,
  count(*) FILTER (WHERE aging_bucket = '30-89d') AS age_30_89,
  count(*) FILTER (WHERE aging_bucket = '90-179d') AS age_90_179,
  count(*) FILTER (WHERE aging_bucket = '180-299d') AS age_180_299,
  count(*) FILTER (WHERE aging_bucket = '300d+') AS age_300_plus,
  round(avg(aging_days) FILTER (WHERE include_in_branch_followup)::numeric, 1) AS avg_aging_followup_days,
  round((percentile_cont(0.5) WITHIN GROUP (ORDER BY aging_days) FILTER (WHERE include_in_branch_followup))::numeric, 1) AS med_aging_followup_days
FROM public.wo_outstanding_v;

CREATE OR REPLACE VIEW public.wo_outstanding_by_branch_v
WITH (security_invoker = true)
AS
SELECT
  COALESCE(nullif(btrim(branch_location), ''), '(blank)') AS branch_location,
  count(*) AS wm_wo_total,
  count(*) FILTER (WHERE outstanding_class = 'NO_REPORT') AS no_report,
  count(*) FILTER (WHERE outstanding_class = 'IN_CLAIM_PIPELINE') AS in_claim_pipeline,
  count(*) FILTER (WHERE outstanding_class = 'REJECTED_NEED_CASE_GROUP_CORRECTION') AS rejected_need_correction,
  count(*) FILTER (WHERE outstanding_class = 'PAID_CLOSED') AS paid_closed,
  count(*) FILTER (WHERE include_in_branch_followup) AS branch_followup_count,
  round(avg(aging_days) FILTER (WHERE include_in_branch_followup)::numeric, 1) AS avg_aging_followup_days,
  max(aging_days) FILTER (WHERE include_in_branch_followup) AS max_aging_followup_days
FROM public.wo_outstanding_v
GROUP BY 1;

GRANT SELECT ON public.wo_warranty_universe_v TO authenticated, anon;
GRANT SELECT ON public.wo_outstanding_v TO authenticated, anon;
GRANT SELECT ON public.wo_outstanding_summary_v TO authenticated, anon;
GRANT SELECT ON public.wo_outstanding_by_branch_v TO authenticated, anon;
