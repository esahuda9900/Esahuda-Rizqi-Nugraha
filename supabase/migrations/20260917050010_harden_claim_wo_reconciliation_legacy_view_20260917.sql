ALTER VIEW public.claim_wo_reconciliation_legacy_v SET (security_invoker = true);
REVOKE SELECT ON public.claim_wo_reconciliation_legacy_v FROM anon;
GRANT SELECT ON public.claim_wo_reconciliation_legacy_v TO authenticated;
