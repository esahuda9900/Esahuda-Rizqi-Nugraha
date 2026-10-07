-- Production-grade rebalancing layers (v2).
-- Applied on production as harden_claim_rebalancing_production_v2.
-- Layers stay separate: internal cost | calculated settlement | approved | batch payment.

CREATE TABLE IF NOT EXISTS public.sdlg_settlement_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tsi text NOT NULL,
  disputed_amount_cny numeric(18,6),
  currency text NOT NULL DEFAULT 'CNY',
  reason text,
  excluded_from_batch_code text,
  status text NOT NULL DEFAULT 'EXCLUDED_FROM_BATCH',
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sdlg_settlement_disputes_tsi_key UNIQUE (tsi)
);

COMMENT ON TABLE public.sdlg_settlement_disputes IS
  'ORFs/TSIs explicitly excluded from a settlement payment batch (dispute evidence). Not paid.';

ALTER TABLE public.sdlg_settlement_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sdlg_settlement_disputes_read ON public.sdlg_settlement_disputes;
CREATE POLICY sdlg_settlement_disputes_read
  ON public.sdlg_settlement_disputes
  FOR SELECT
  TO authenticated, anon
  USING (true);

GRANT SELECT ON public.sdlg_settlement_disputes TO authenticated, anon;

INSERT INTO public.sdlg_settlement_disputes (tsi, disputed_amount_cny, currency, reason, excluded_from_batch_code, status, source_note)
VALUES
  ('ORF-260203-0017', 371.28, 'CNY', 'Disputed ORF excluded from September 2026 settlement payment batch', 'SDLG-PAY-2026-09-15-01', 'EXCLUDED_FROM_BATCH', 'Explicitly excluded from batch; not present in sdlg_settlements'),
  ('ORF-260421-0021', 570.50, 'CNY', 'Disputed ORF excluded from September 2026 settlement payment batch', 'SDLG-PAY-2026-09-15-01', 'EXCLUDED_FROM_BATCH', 'Explicitly excluded from batch; not present in sdlg_settlements')
ON CONFLICT (tsi) DO UPDATE SET
  disputed_amount_cny = EXCLUDED.disputed_amount_cny,
  reason = EXCLUDED.reason,
  excluded_from_batch_code = EXCLUDED.excluded_from_batch_code,
  status = EXCLUDED.status,
  source_note = EXCLUDED.source_note,
  updated_at = now();

DROP VIEW IF EXISTS public.claim_rebalancing_summary_v;
DROP VIEW IF EXISTS public.claim_rebalancing_v;

CREATE VIEW public.claim_rebalancing_v
WITH (security_invoker = true)
AS
SELECT
  c.claim_id,
  c.claim_status,
  c.model,
  c.serial_no,
  c.customer,
  c.branch,
  c.currency AS internal_claim_currency,
  c.total_amount AS internal_claim_amount,
  'claims.total_amount'::text AS internal_cost_basis,
  s.tsi AS settlement_tsi,
  s.match_status AS settlement_match_status,
  s.calculated_settlement_amount_cny,
  NULL::numeric AS approved_amount_cny,
  'NOT_CAPTURED'::text AS approved_amount_status,
  c.payment_amount AS claim_recorded_payment_amount,
  c.payment_date AS claim_recorded_payment_date,
  b.batch_code AS payment_batch_code,
  b.payment_status AS payment_batch_status,
  b.debit_note_no AS payment_batch_debit_note_no,
  b.agreement_amount_cny AS payment_batch_agreement_amount_cny,
  b.calculated_settlement_amount_cny AS payment_batch_calculated_amount_cny,
  b.sdlg_payment_completed_date AS payment_batch_sdlg_completed_date,
  b.finance_received_date AS payment_batch_finance_received_date,
  CASE
    WHEN c.payment_amount IS NOT NULL THEN 'CLAIM_LEVEL_AMOUNT_RECORDED'::text
    WHEN b.id IS NOT NULL AND b.payment_status = 'RECEIVED'::text THEN 'BATCH_RECEIVED_UNALLOCATED'::text
    WHEN b.id IS NOT NULL THEN 'BATCH_LINKED_NO_CLAIM_ALLOCATION'::text
    ELSE 'NO_PAYMENT_EVIDENCE'::text
  END AS payment_allocation_status,
  CASE
    WHEN upper(COALESCE(c.currency, ''::text)) = 'CNY'::text
         AND s.calculated_settlement_amount_cny IS NOT NULL
      THEN round(s.calculated_settlement_amount_cny - COALESCE(c.total_amount, 0::numeric), 6)
    ELSE NULL::numeric
  END AS calculated_settlement_minus_internal_claim_cny,
  CASE
    WHEN upper(COALESCE(c.currency, ''::text)) = 'CNY'::text
         AND c.payment_amount IS NOT NULL
      THEN round(c.payment_amount - COALESCE(c.total_amount, 0::numeric), 6)
    ELSE NULL::numeric
  END AS recorded_payment_minus_internal_claim_cny,
  CASE
    WHEN s.id IS NULL THEN 'MISSING_SETTLEMENT'::text
    WHEN b.id IS NULL THEN 'MISSING_PAYMENT_BATCH_EVIDENCE'::text
    WHEN b.payment_status = 'RECEIVED'::text AND c.payment_amount IS NULL THEN 'BATCH_EVIDENCE_ONLY'::text
    ELSE 'REVIEW'::text
  END AS rebalancing_evidence_status
FROM public.claims c
LEFT JOIN public.sdlg_settlements s ON s.claim_id = c.claim_id
LEFT JOIN public.sdlg_payment_batch_settlements pbs ON pbs.settlement_id = s.id
LEFT JOIN public.sdlg_payment_batches b ON b.id = pbs.batch_id
WHERE c.archived_at IS NULL;

CREATE VIEW public.claim_rebalancing_summary_v
WITH (security_invoker = true)
AS
SELECT
  count(*) AS claim_rows,
  count(*) FILTER (WHERE settlement_tsi IS NOT NULL) AS settlement_matched,
  count(*) FILTER (WHERE settlement_tsi IS NULL) AS settlement_unmatched,
  count(*) FILTER (WHERE rebalancing_evidence_status = 'BATCH_EVIDENCE_ONLY'::text) AS batch_evidence_only,
  count(*) FILTER (WHERE rebalancing_evidence_status = 'MISSING_SETTLEMENT'::text) AS missing_settlement,
  count(*) FILTER (WHERE payment_allocation_status = 'BATCH_RECEIVED_UNALLOCATED'::text) AS batch_received_unallocated,
  count(*) FILTER (WHERE payment_allocation_status = 'NO_PAYMENT_EVIDENCE'::text) AS no_payment_evidence,
  count(*) FILTER (WHERE approved_amount_status = 'NOT_CAPTURED'::text) AS approved_not_captured,
  round(sum(COALESCE(internal_claim_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(internal_claim_currency, ''::text)) = 'CNY'::text), 2) AS internal_cost_all_cny,
  round(sum(COALESCE(internal_claim_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(internal_claim_currency, ''::text)) = 'CNY'::text
                AND settlement_tsi IS NOT NULL), 2) AS internal_cost_matched_cny,
  round(sum(COALESCE(internal_claim_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(internal_claim_currency, ''::text)) = 'CNY'::text
                AND settlement_tsi IS NULL), 2) AS internal_cost_unmatched_cny,
  round(sum(COALESCE(internal_claim_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(internal_claim_currency, ''::text)) = 'USD'::text), 2) AS internal_cost_all_usd,
  round(sum(COALESCE(calculated_settlement_amount_cny, 0::numeric)), 2) AS calculated_settlement_cny,
  round(
    sum(COALESCE(calculated_settlement_amount_cny, 0::numeric))
    - sum(COALESCE(internal_claim_amount, 0::numeric))
      FILTER (WHERE upper(COALESCE(internal_claim_currency, ''::text)) = 'CNY'::text
              AND settlement_tsi IS NOT NULL)
  , 2) AS calculated_minus_matched_internal_cny,
  (SELECT round(COALESCE(sum(agreement_amount_cny), 0::numeric), 2)
     FROM public.sdlg_payment_batches
    WHERE payment_status = 'RECEIVED') AS batch_received_agreement_cny,
  (SELECT count(*)::integer FROM public.sdlg_settlement_disputes) AS dispute_orf_count,
  (SELECT round(COALESCE(sum(disputed_amount_cny), 0::numeric), 2)
     FROM public.sdlg_settlement_disputes) AS dispute_amount_cny
FROM public.claim_rebalancing_v;

DROP VIEW IF EXISTS public.claim_settlement_summary_v;

CREATE VIEW public.claim_settlement_summary_v
WITH (security_invoker = true)
AS
SELECT
  s.tsi,
  s.claim_id,
  c.claim_status,
  c.model AS claim_model,
  c.serial_no AS claim_serial_no,
  c.customer,
  c.branch,
  c.currency AS claim_currency,
  c.total_amount AS claim_total_amount,
  s.machine_model AS settlement_model,
  s.serial_no AS settlement_serial_no,
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
  CASE
    WHEN upper(COALESCE(c.currency, ''::text)) = 'CNY'::text
      THEN s.calculated_settlement_amount_cny - COALESCE(c.total_amount, 0::numeric)
    ELSE NULL::numeric
  END AS settlement_minus_claim_cny,
  c.payment_amount AS claim_payment_amount,
  c.payment_date AS claim_payment_date,
  pb.batch_code AS payment_batch_code,
  pb.payment_status AS payment_batch_status,
  pb.debit_note_no AS payment_batch_debit_note_no,
  pb.sdlg_payment_completed_date AS payment_batch_sdlg_completed_date,
  pb.finance_received_date AS payment_batch_finance_received_date,
  pb.agreement_amount_cny AS payment_batch_agreement_amount_cny,
  pb.calculated_settlement_amount_cny AS payment_batch_calculated_amount_cny,
  s.imported_at,
  s.updated_at
FROM public.sdlg_settlements s
LEFT JOIN public.claims c ON c.claim_id = s.claim_id
LEFT JOIN public.sdlg_payment_batch_settlements pbs ON pbs.settlement_id = s.id
LEFT JOIN public.sdlg_payment_batches pb ON pb.id = pbs.batch_id;

GRANT SELECT ON public.claim_rebalancing_v TO authenticated, anon;
GRANT SELECT ON public.claim_rebalancing_summary_v TO authenticated, anon;
GRANT SELECT ON public.claim_settlement_summary_v TO authenticated, anon;
