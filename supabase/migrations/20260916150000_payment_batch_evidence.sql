-- SDLG payment batch evidence model.
-- This file mirrors the payment-batch objects already applied to the live Supabase project.

create table if not exists public.sdlg_payment_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,
  batch_name text not null,
  currency text not null default 'CNY',
  agreement_amount_cny numeric(18,6),
  calculated_settlement_amount_cny numeric(18,6),
  payment_status text not null default 'RECORDED'
    check (payment_status = any(array['RECORDED','AGREED','INVOICED','PAYMENT_RELEASED','RECEIVED','CLOSED'])),
  sdlg_payment_completed_date date,
  finance_received_date date,
  agreement_reference text,
  invoice_no text,
  evidence_source_id uuid references public.sdlg_data_sources(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sdlg_payment_batch_settlements (
  batch_id uuid not null references public.sdlg_payment_batches(id) on delete cascade,
  settlement_id uuid not null references public.sdlg_settlements(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(batch_id, settlement_id),
  unique(settlement_id)
);

create unique index if not exists sdlg_settlement_lines_settlement_line_uq
  on public.sdlg_settlement_lines(settlement_id,line_no);
create index if not exists sdlg_payment_batch_settlements_batch_idx
  on public.sdlg_payment_batch_settlements(batch_id);
create index if not exists sdlg_payment_batches_status_idx
  on public.sdlg_payment_batches(payment_status);

alter table public.sdlg_payment_batches enable row level security;
alter table public.sdlg_payment_batch_settlements enable row level security;

create policy sdlg_payment_batches_select_authenticated
  on public.sdlg_payment_batches for select to authenticated using (true);
create policy sdlg_payment_batch_settlements_select_authenticated
  on public.sdlg_payment_batch_settlements for select to authenticated using (true);

create or replace view public.sdlg_payment_batch_summary_v as
select
  b.id,
  b.batch_code,
  b.batch_name,
  b.currency,
  b.agreement_amount_cny,
  b.calculated_settlement_amount_cny,
  round(coalesce(b.calculated_settlement_amount_cny,0)-coalesce(b.agreement_amount_cny,0),6)
    as calculated_vs_agreement_delta_cny,
  b.payment_status,
  b.sdlg_payment_completed_date,
  b.finance_received_date,
  b.agreement_reference,
  b.invoice_no,
  count(bs.settlement_id)::int as settlement_count,
  count(distinct s.claim_id)::int as claim_count,
  sum(coalesce(s.calculated_settlement_amount_cny,0)) as member_calculated_amount_cny
from public.sdlg_payment_batches b
left join public.sdlg_payment_batch_settlements bs on bs.batch_id=b.id
left join public.sdlg_settlements s on s.id=bs.settlement_id
group by b.id;

create or replace view public.sdlg_settlement_batch_claims_v as
select
  b.batch_code,
  b.payment_status,
  b.sdlg_payment_completed_date,
  b.finance_received_date,
  s.tsi,
  s.claim_id,
  s.serial_no,
  s.machine_model,
  s.calculated_settlement_amount_cny,
  s.paid_confirmed,
  s.payment_date,
  s.payment_amount
from public.sdlg_payment_batches b
join public.sdlg_payment_batch_settlements bs on bs.batch_id=b.id
join public.sdlg_settlements s on s.id=bs.settlement_id;
