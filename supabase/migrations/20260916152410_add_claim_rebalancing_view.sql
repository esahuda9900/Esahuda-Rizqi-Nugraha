-- Sync rebalancing views already applied to the live Supabase project.
-- Production migration version: 20260916152410 / add_claim_rebalancing_view.
--
-- Semantics (do not collapse these layers):
--   internal_claim_amount     = company claim / cost basis from claims.total_amount
--   calculated_settlement     = SDLG formula result from settlement import
--   approved_amount           = NOT_CAPTURED until formal approved amount exists
--   payment evidence          = batch-level only (no invented per-claim bank allocation)

CREATE OR REPLACE VIEW public.claim_rebalancing_v
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

COMMENT ON VIEW public.claim_rebalancing_v IS
  'Per-claim rebalancing evidence. Distinguishes internal claim cost, calculated settlement, approved amount (when known), and batch-level payment evidence. Does not invent per-claim bank allocation.';

CREATE OR REPLACE VIEW public.claim_rebalancing_summary_v
WITH (security_invoker = true)
AS
SELECT
  count(*) AS claim_rows,
  count(*) FILTER (WHERE settlement_tsi IS NOT NULL) AS settlement_matched,
  count(*) FILTER (WHERE rebalancing_evidence_status = 'BATCH_EVIDENCE_ONLY'::text) AS batch_evidence_only,
  count(*) FILTER (WHERE rebalancing_evidence_status = 'MISSING_SETTLEMENT'::text) AS missing_settlement,
  count(*) FILTER (WHERE payment_allocation_status = 'BATCH_RECEIVED_UNALLOCATED'::text) AS batch_received_unallocated,
  count(*) FILTER (WHERE payment_allocation_status = 'NO_PAYMENT_EVIDENCE'::text) AS no_payment_evidence,
  count(*) FILTER (WHERE approved_amount_status = 'NOT_CAPTURED'::text) AS approved_not_captured,
  round(sum(COALESCE(internal_claim_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(internal_claim_currency, ''::text)) = 'CNY'::text), 2) AS internal_cost_cny,
  round(sum(COALESCE(calculated_settlement_amount_cny, 0::numeric)), 2) AS calculated_settlement_cny
FROM public.claim_rebalancing_v;

COMMENT ON VIEW public.claim_rebalancing_summary_v IS
  'Aggregate rebalancing evidence counts and CNY totals. Batch payment is evidence-only; approved amount remains NOT_CAPTURED until formal source exists.';

GRANT SELECT ON public.claim_rebalancing_v TO authenticated, anon;
GRANT SELECT ON public.claim_rebalancing_summary_v TO authenticated, anon;
