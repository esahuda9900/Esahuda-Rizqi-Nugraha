-- Idempotent seed for the 15-Sep-2026 SDLG payment confirmation.
-- Source: SDLG email confirmation + ITR Finance receipt confirmation.
-- This records batch-level evidence only; it does not invent bank value dates or per-claim payment allocations.

insert into public.sdlg_data_sources (
  source_name, source_type, source_mime_type, source_date, description, full_text, metadata
) values (
  'SDLG Payment Confirmation Email — 2026-09-15',
  'EMAIL',
  'text/plain',
  '2026-09-15',
  'Email evidence that SDLG payment was completed and ITR Finance confirmed funds were received. Batch amount requested/agreed in the thread: CNY 2,399,579.93. Two disputed ORFs were stated as outside the current agreement.',
  '2026-09-15 10:40 SDLG: payment finished; 2026-09-15 11:54 ITR Finance: funds received in ITR account. 2026-08-07 ITR requested release at CNY 2,399,579.93. 2026-08-11 SDLG confirmed ORF-260203-0017 and ORF-260421-0021 were not in the current agreement.',
  '{"evidence_level":"payment_confirmation","payment_received_in_bank":"confirmed_by_finance_email","official_bank_value_date":"unknown","requested_amount_cny":2399579.93,"disputed_orfs":["ORF-260203-0017","ORF-260421-0021"]}'::jsonb
) on conflict (source_name) do update
set source_type=excluded.source_type,
    source_date=excluded.source_date,
    description=excluded.description,
    full_text=excluded.full_text,
    metadata=excluded.metadata,
    updated_at=now();

insert into public.sdlg_payment_batches (
  batch_code, batch_name, currency, agreement_amount_cny, calculated_settlement_amount_cny,
  payment_status, sdlg_payment_completed_date, finance_received_date,
  agreement_reference, evidence_source_id, notes
)
select
  'SDLG-PAY-2026-09-15-01',
  'SDLG Settlement Payment — September 2026',
  'CNY',
  2399579.93,
  2399579.926,
  'RECEIVED',
  '2026-09-15',
  '2026-09-15',
  'Payment agreement / settlement batch confirmed by SDLG email',
  id,
  'Batch-level payment evidence. The source settlement calculation totals CNY 2,399,579.926 and rounds to CNY 2,399,579.93. No bank value date or per-claim bank allocation was supplied.'
from public.sdlg_data_sources
where source_name='SDLG Payment Confirmation Email — 2026-09-15'
on conflict (batch_code) do update
set agreement_amount_cny=excluded.agreement_amount_cny,
    calculated_settlement_amount_cny=excluded.calculated_settlement_amount_cny,
    payment_status=excluded.payment_status,
    sdlg_payment_completed_date=excluded.sdlg_payment_completed_date,
    finance_received_date=excluded.finance_received_date,
    agreement_reference=excluded.agreement_reference,
    evidence_source_id=excluded.evidence_source_id,
    notes=excluded.notes,
    updated_at=now();

insert into public.sdlg_payment_batch_settlements(batch_id, settlement_id)
select b.id, s.id
from public.sdlg_payment_batches b
join public.sdlg_settlements s on s.paid_confirmed=true
where b.batch_code='SDLG-PAY-2026-09-15-01'
on conflict do nothing;
