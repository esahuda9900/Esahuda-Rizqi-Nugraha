-- Align business semantics (applied on production as align_rebalancing_paid_semantics_and_disputes_v1).
-- 1) 313 RECEIVED batch members = SDLG approved + paid (settlement amount)
-- 2) claims.total_amount = FOB/claim amount (NOT company COGS)
-- 3) 2 disputed ORFs -> On Hold + dispute registry

ALTER TABLE public.sdlg_settlement_disputes
  ADD COLUMN IF NOT EXISTS claim_id text;

UPDATE public.sdlg_settlement_disputes d
SET claim_id = c.claim_id,
    updated_at = now()
FROM public.claims c
WHERE c.archived_at IS NULL
  AND c.dealer_claim_no = d.tsi;

UPDATE public.sdlg_settlement_disputes
SET status = 'UNDER_NEGOTIATION',
    reason = 'SDLG indicates out-of-warranty reject; company still negotiating. Excluded from paid batch SDLG-PAY-2026-09-15-01.',
    source_note = 'Mapped via dealer_claim_no = ORF/TSI. Claim remains unmatched to sdlg_settlements because excluded from paid import.',
    updated_at = now()
WHERE tsi IN ('ORF-260203-0017', 'ORF-260421-0021');

UPDATE public.claims c
SET claim_status = 'On Hold',
    status_date = DATE '2026-09-15',
    status_update_reason = 'Dispute: SDLG intends OOW reject; excluded from payment batch SDLG-PAY-2026-09-15-01; under negotiation.',
    last_updated = now()
WHERE c.archived_at IS NULL
  AND c.claim_id IN ('0022-2026-SDLG-PFR', '0097-2026-SDLG-PFR')
  AND c.claim_status = 'SDLG Audit';

INSERT INTO public.claim_status_history (claim_id, status, status_date, reason)
SELECT v.claim_id, 'On Hold', DATE '2026-09-15',
       'Dispute: SDLG intends OOW reject; excluded from payment batch SDLG-PAY-2026-09-15-01; under negotiation.'
FROM (VALUES ('0022-2026-SDLG-PFR'), ('0097-2026-SDLG-PFR')) AS v(claim_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.claim_status_history h
  WHERE h.claim_id = v.claim_id
    AND h.status = 'On Hold'
    AND h.status_date = DATE '2026-09-15'
);

UPDATE public.sdlg_settlements s
SET paid_confirmed = true,
    payment_amount = s.calculated_settlement_amount_cny,
    payment_currency = 'CNY',
    payment_date = b.finance_received_date,
    updated_at = now()
FROM public.sdlg_payment_batch_settlements pbs
JOIN public.sdlg_payment_batches b ON b.id = pbs.batch_id
WHERE pbs.settlement_id = s.id
  AND b.payment_status = 'RECEIVED'
  AND b.batch_code = 'SDLG-PAY-2026-09-15-01';

UPDATE public.claims c
SET payment_amount = s.calculated_settlement_amount_cny,
    payment_date = b.finance_received_date,
    last_updated = now()
FROM public.sdlg_settlements s
JOIN public.sdlg_payment_batch_settlements pbs ON pbs.settlement_id = s.id
JOIN public.sdlg_payment_batches b ON b.id = pbs.batch_id
WHERE s.claim_id = c.claim_id
  AND c.archived_at IS NULL
  AND b.payment_status = 'RECEIVED'
  AND b.batch_code = 'SDLG-PAY-2026-09-15-01';

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
  c.currency AS claim_fob_currency,
  c.total_amount AS claim_fob_amount,
  'claims.total_amount (FOB / claim amount, NOT company COGS)'::text AS claim_fob_basis,
  s.tsi AS settlement_tsi,
  s.match_status AS settlement_match_status,
  s.calculated_settlement_amount_cny AS sdlg_approved_paid_amount_cny,
  CASE
    WHEN b.id IS NOT NULL AND b.payment_status = 'RECEIVED' THEN s.calculated_settlement_amount_cny
    ELSE NULL::numeric
  END AS approved_amount_cny,
  CASE
    WHEN b.id IS NOT NULL AND b.payment_status = 'RECEIVED' THEN 'CAPTURED_FROM_SETTLEMENT_PAID'::text
    WHEN d.tsi IS NOT NULL THEN 'DISPUTED_EXCLUDED_FROM_BATCH'::text
    ELSE 'NOT_CAPTURED'::text
  END AS approved_amount_status,
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
    WHEN d.tsi IS NOT NULL THEN 'DISPUTED_EXCLUDED'::text
    WHEN b.id IS NOT NULL AND b.payment_status = 'RECEIVED' AND c.payment_amount IS NOT NULL
      THEN 'SETTLEMENT_AMOUNT_AS_PAID_SHARE'::text
    WHEN b.id IS NOT NULL AND b.payment_status = 'RECEIVED'
      THEN 'BATCH_RECEIVED_MEMBER'::text
    WHEN s.id IS NOT NULL THEN 'SETTLEMENT_ONLY_NOT_IN_PAID_BATCH'::text
    ELSE 'NO_PAYMENT_EVIDENCE'::text
  END AS payment_allocation_status,
  CASE
    WHEN upper(COALESCE(c.currency, ''::text)) = 'CNY'::text
         AND s.calculated_settlement_amount_cny IS NOT NULL
      THEN round(s.calculated_settlement_amount_cny - COALESCE(c.total_amount, 0::numeric), 6)
    ELSE NULL::numeric
  END AS sdlg_paid_minus_claim_fob_cny,
  CASE
    WHEN d.tsi IS NOT NULL THEN 'DISPUTED_UNDER_NEGOTIATION'::text
    WHEN b.id IS NOT NULL AND b.payment_status = 'RECEIVED' THEN 'PAID_BATCH_COMPLETE'::text
    WHEN s.id IS NULL THEN 'MISSING_SETTLEMENT'::text
    ELSE 'REVIEW'::text
  END AS rebalancing_evidence_status,
  d.status AS dispute_status,
  d.disputed_amount_cny,
  d.reason AS dispute_reason
FROM public.claims c
LEFT JOIN public.sdlg_settlements s ON s.claim_id = c.claim_id
LEFT JOIN public.sdlg_payment_batch_settlements pbs ON pbs.settlement_id = s.id
LEFT JOIN public.sdlg_payment_batches b ON b.id = pbs.batch_id
LEFT JOIN public.sdlg_settlement_disputes d
  ON d.claim_id = c.claim_id OR d.tsi = c.dealer_claim_no
WHERE c.archived_at IS NULL;

CREATE VIEW public.claim_rebalancing_summary_v
WITH (security_invoker = true)
AS
SELECT
  count(*) AS claim_rows,
  count(*) FILTER (WHERE settlement_tsi IS NOT NULL) AS settlement_matched,
  count(*) FILTER (WHERE settlement_tsi IS NULL) AS settlement_unmatched,
  count(*) FILTER (WHERE rebalancing_evidence_status = 'PAID_BATCH_COMPLETE'::text) AS paid_batch_complete,
  count(*) FILTER (WHERE rebalancing_evidence_status = 'MISSING_SETTLEMENT'::text) AS missing_settlement,
  count(*) FILTER (WHERE rebalancing_evidence_status = 'DISPUTED_UNDER_NEGOTIATION'::text) AS disputed_under_negotiation,
  count(*) FILTER (WHERE payment_allocation_status = 'SETTLEMENT_AMOUNT_AS_PAID_SHARE'::text) AS paid_share_recorded,
  count(*) FILTER (WHERE payment_allocation_status = 'NO_PAYMENT_EVIDENCE'::text) AS no_payment_evidence,
  count(*) FILTER (WHERE approved_amount_status = 'CAPTURED_FROM_SETTLEMENT_PAID'::text) AS approved_captured_paid,
  count(*) FILTER (WHERE approved_amount_status = 'NOT_CAPTURED'::text) AS approved_not_captured,
  count(*) FILTER (WHERE approved_amount_status = 'DISPUTED_EXCLUDED_FROM_BATCH'::text) AS approved_disputed,
  round(sum(COALESCE(claim_fob_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(claim_fob_currency, ''::text)) = 'CNY'::text), 2) AS claim_fob_all_cny,
  round(sum(COALESCE(claim_fob_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(claim_fob_currency, ''::text)) = 'CNY'::text
                AND settlement_tsi IS NOT NULL), 2) AS claim_fob_matched_cny,
  round(sum(COALESCE(claim_fob_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(claim_fob_currency, ''::text)) = 'CNY'::text
                AND settlement_tsi IS NULL), 2) AS claim_fob_unmatched_cny,
  round(sum(COALESCE(claim_fob_amount, 0::numeric))
        FILTER (WHERE upper(COALESCE(claim_fob_currency, ''::text)) = 'USD'::text), 2) AS claim_fob_all_usd,
  round(sum(COALESCE(sdlg_approved_paid_amount_cny, 0::numeric)), 2) AS sdlg_approved_paid_cny,
  round(sum(COALESCE(claim_recorded_payment_amount, 0::numeric))
        FILTER (WHERE claim_recorded_payment_amount IS NOT NULL), 2) AS claim_payment_recorded_cny,
  round(
    sum(COALESCE(sdlg_approved_paid_amount_cny, 0::numeric))
    - sum(COALESCE(claim_fob_amount, 0::numeric))
      FILTER (WHERE upper(COALESCE(claim_fob_currency, ''::text)) = 'CNY'::text
              AND settlement_tsi IS NOT NULL)
  , 2) AS sdlg_paid_minus_matched_fob_cny,
  (SELECT round(COALESCE(sum(agreement_amount_cny), 0::numeric), 2)
     FROM public.sdlg_payment_batches
    WHERE payment_status = 'RECEIVED') AS batch_received_agreement_cny,
  (SELECT count(*)::integer FROM public.sdlg_settlement_disputes) AS dispute_orf_count,
  (SELECT round(COALESCE(sum(disputed_amount_cny), 0::numeric), 2)
     FROM public.sdlg_settlement_disputes) AS dispute_amount_cny
FROM public.claim_rebalancing_v;

GRANT SELECT ON public.claim_rebalancing_v TO authenticated, anon;
GRANT SELECT ON public.claim_rebalancing_summary_v TO authenticated, anon;
