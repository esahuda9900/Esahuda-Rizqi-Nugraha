DROP VIEW IF EXISTS public.claim_wo_reconciliation_detail_v;
CREATE VIEW public.claim_wo_reconciliation_detail_v WITH (security_invoker=true) AS
SELECT r.*, wo.source_quality_status AS ax_source_quality_status,
       wo.source_quality_notes AS ax_source_quality_notes,
       CASE WHEN wo.wo_no IS NULL THEN 'NOT_FOUND'
            WHEN wo.source_quality_status='LEGACY_NOT_IN_CURRENT_SNAPSHOT' THEN 'LEGACY_SOURCE'
            WHEN r.reconciliation_status='WO_MATCHED' THEN 'CURRENT_SOURCE_MATCH'
            ELSE 'CURRENT_SOURCE_REVIEW' END AS evidence_state
FROM public.claim_wo_reconciliation_v r
LEFT JOIN public.ax_warranty_work_orders wo ON wo.wo_no=r.ax_wo_no;
GRANT SELECT ON public.claim_wo_reconciliation_detail_v TO authenticated;
REVOKE ALL ON public.claim_wo_reconciliation_detail_v FROM anon;
COMMENT ON VIEW public.claim_wo_reconciliation_detail_v IS 'Detailed read-only AX claim reconciliation including source snapshot quality/evidence state. Does not mutate historical claim values.';

DROP VIEW IF EXISTS public.ax_wo_control_tower_v;
CREATE VIEW public.ax_wo_control_tower_v WITH (security_invoker=true) AS
SELECT
  count(*) FILTER (WHERE source_quality_status='OK')::bigint AS current_source_wo_count,
  count(*) FILTER (WHERE source_quality_status='OK' AND upper(btrim(wo_type))='WAR')::bigint AS current_warranty_type_count,
  count(*) FILTER (WHERE source_quality_status='OK' AND upper(btrim(status))='CANCELED')::bigint AS current_canceled_count,
  count(*) FILTER (WHERE source_quality_status='LEGACY_NOT_IN_CURRENT_SNAPSHOT')::bigint AS legacy_wo_count,
  count(*) FILTER (WHERE source_quality_status='OK' AND (nullif(btrim(serial_no),'') IS NULL OR nullif(btrim(chassis_no),'') IS NULL))::bigint AS current_missing_identity_count
FROM public.ax_warranty_work_orders;
GRANT SELECT ON public.ax_wo_control_tower_v TO authenticated;
REVOKE ALL ON public.ax_wo_control_tower_v FROM anon;
COMMENT ON VIEW public.ax_wo_control_tower_v IS 'Read-only AX work-order control totals for operations dashboards.';
