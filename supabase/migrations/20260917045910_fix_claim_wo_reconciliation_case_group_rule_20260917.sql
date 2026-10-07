ALTER VIEW public.claim_wo_reconciliation_v RENAME TO claim_wo_reconciliation_legacy_v;

CREATE VIEW public.claim_wo_reconciliation_v
WITH (security_invoker = true)
AS
SELECT
  l.claim_id,
  l.claim_wo_no,
  l.claim_status,
  l.branch,
  l.model,
  l.claim_serial_no,
  l.claim_customer,
  l.ax_wo_no,
  l.ax_wo_status,
  l.ax_wo_type,
  l.ax_created_date,
  l.ax_start_date,
  l.ax_chassis_no,
  l.ax_serial_no,
  l.ax_device_name,
  l.ax_delivery_name,
  l.ax_customer_account,
  l.ax_device_number,
  l.ax_person_in_charge,
  l.ax_primary_resource,
  l.ax_resource_group,
  l.ax_description,
  CASE
    WHEN nullif(btrim(l.claim_wo_no),'') IS NULL THEN 'CLAIM_WO_MISSING'
    WHEN l.ax_wo_no IS NULL THEN 'WO_NOT_FOUND_IN_AX'
    WHEN upper(btrim(coalesce(w.case_group,''))) NOT LIKE 'WM%' THEN 'AX_WO_NON_WARRANTY_CASE_GROUP'
    WHEN upper(btrim(coalesce(w.status,'')))='CANCELED' THEN 'AX_WO_CANCELED'
    WHEN l.serial_reconciliation_status='MISMATCH' THEN 'AX_WO_SERIAL_MISMATCH'
    ELSE 'WO_MATCHED'
  END AS reconciliation_status,
  l.serial_reconciliation_status,
  l.wo_found_in_ax,
  upper(btrim(coalesce(w.case_group,''))) LIKE 'WM%' AS ax_is_warranty_type,
  l.ax_is_canceled,
  l.serial_match
FROM public.claim_wo_reconciliation_legacy_v l
LEFT JOIN public.ax_warranty_work_orders w ON w.wo_no=l.ax_wo_no;

REVOKE SELECT ON public.claim_wo_reconciliation_v FROM anon;
REVOKE SELECT ON public.claim_wo_reconciliation_legacy_v FROM anon;
GRANT SELECT ON public.claim_wo_reconciliation_v TO authenticated;
GRANT SELECT ON public.claim_wo_reconciliation_legacy_v TO authenticated;
