-- Expose payment-batch evidence alongside settlement reconciliation.

drop view if exists public.claim_settlement_summary_v;

create view public.claim_settlement_summary_v as
select
  s.tsi,
  s.claim_id,
  c.claim_status,
  c.model as claim_model,
  c.serial_no as claim_serial_no,
  c.customer,
  c.branch,
  c.currency as claim_currency,
  c.total_amount as claim_total_amount,
  s.machine_model as settlement_model,
  s.serial_no as settlement_serial_no,
  s.failure_date,
  s.run_hour,
  s.calculated_settlement_amount_cny,
  s.settlement_ratio,
  s.paid_confirmed,
  s.payment_amount,
  s.payment_currency,
  s.payment_date,
  s.match_status,
  s.source_name,
  case when upper(coalesce(c.currency,''))='CNY'
    then s.calculated_settlement_amount_cny-coalesce(c.total_amount,0)
    else null end as settlement_minus_claim_cny,
  c.payment_amount as claim_payment_amount,
  c.payment_date as claim_payment_date,
  pb.batch_code as payment_batch_code,
  pb.payment_status as payment_batch_status,
  pb.sdlg_payment_completed_date as payment_batch_sdlg_completed_date,
  pb.finance_received_date as payment_batch_finance_received_date,
  pb.agreement_amount_cny as payment_batch_agreement_amount_cny,
  pb.calculated_settlement_amount_cny as payment_batch_calculated_amount_cny,
  s.imported_at,
  s.updated_at
from public.sdlg_settlements s
left join public.claims c on c.claim_id=s.claim_id
left join public.sdlg_payment_batch_settlements pbs on pbs.settlement_id=s.id
left join public.sdlg_payment_batches pb on pb.id=pbs.batch_id;
