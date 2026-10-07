-- Fix Action Center precedence so workflow stage/ownership wins over data-quality flags.
-- Rejected / Approved / On Hold must keep their workflow action semantics even when
-- warranty readiness metadata is incomplete.

create or replace view public.claim_action_center_v as
select
  id,
  claim_id,
  claim_status,
  workflow_stage,
  readiness_status,
  next_action,
  model,
  serial_no,
  customer,
  failure_date,
  dealer_claim_date,
  status_date,
  last_updated,
  assessment_data_status,
  warranty_check_ready,
  validation_core_ok,
  priority,
  action_required,
  days_open,
  overdue_days,
  current_owner,
  ui_process
from (
  select
    w.id,
    w.claim_id,
    w.claim_status,
    w.status_date,
    w.input_date,
    w.last_updated,
    w.dealer_claim_date,
    w.sdlg_submission_no,
    w.sdlg_audit_date,
    w.sdlg_approval_date,
    w.billing_date,
    w.invoice_date,
    w.payment_date,
    w.rejection_reason,
    w.model,
    w.serial_no,
    w.customer,
    w.failure_date,
    w.hm_failure,
    w.product_family,
    w.model_scope,
    w.component_category,
    w.assessment_data_status,
    w.warranty_assessment,
    w.bill_of_lading_date,
    w.sale_date,
    w.operation_start_date,
    w.validation_core_ok,
    w.warranty_check_ready,
    w.workflow_stage,
    case
      when w.workflow_stage = 'Draft' then 'Lengkapi dan siapkan claim'
      when w.workflow_stage = 'SDLG Audit' then 'Menunggu keputusan SDLG'
      when w.workflow_stage = 'Ready to Claim' then 'Submit claim ke SDLG'
      when w.workflow_stage = 'Approved' then 'Lanjutkan settlement, payment agreement, dan invoice'
      when w.workflow_stage = 'Rejected' then 'Review alasan No to Settlement / dispute bila masih bisa'
      when w.workflow_stage = 'On Hold' then 'Follow up item yang menahan claim'
      when not w.validation_core_ok then 'Lengkapi data inti claim'
      when not w.warranty_check_ready then 'Lengkapi data untuk warranty check'
      when w.workflow_stage = 'Closed' and w.claim_status = 'Billing' then 'Menunggu payment'
      when w.workflow_stage = 'Closed' and w.claim_status = 'Paid' then 'Tutup claim / finalisasi'
      else 'Review'
    end as next_action,
    case
      when w.validation_core_ok and w.warranty_check_ready then 'READY'
      when w.validation_core_ok then 'WARRANTY_CHECK_PENDING'
      else 'VALIDATION_REQUIRED'
    end as readiness_status,
    w.current_owner,
    w.ui_process,
    case
      when w.workflow_stage = 'SDLG Audit' then 'NONE'
      when w.workflow_stage = 'On Hold' then 'NONE'
      when w.workflow_stage = 'Rejected' then 'P1'
      when w.workflow_stage = 'Approved' then 'P1'
      when not w.validation_core_ok then 'P0'
      when not w.warranty_check_ready then 'P1'
      when w.workflow_stage = 'Ready to Claim' then 'P1'
      else 'P2'
    end as priority,
    case
      when w.workflow_stage = 'SDLG Audit' then false
      when w.workflow_stage = 'On Hold' then false
      when w.workflow_stage = 'Rejected' then true
      when w.workflow_stage = 'Approved' then true
      when not w.validation_core_ok then true
      when not w.warranty_check_ready then true
      when w.workflow_stage = 'Ready to Claim' then true
      else false
    end as action_required,
    case
      when w.workflow_stage in ('Closed', 'Rejected', 'On Hold') then null
      when w.workflow_stage = 'SDLG Audit' then greatest(0, current_date - coalesce(w.dealer_claim_date, w.status_date, w.input_date, current_date))
      when w.workflow_stage = 'Ready to Claim' then greatest(0, current_date - coalesce(w.failure_date, w.input_date, current_date))
      when w.dealer_claim_date is not null then greatest(0, current_date - w.dealer_claim_date)
      else null
    end as days_open,
    case
      when w.workflow_stage = 'SDLG Audit' then 0
      when w.dealer_claim_date is not null and (current_date - w.dealer_claim_date) > 90 then current_date - w.dealer_claim_date - 90
      else 0
    end as overdue_days
  from public.claim_workflow_v w
) q;
