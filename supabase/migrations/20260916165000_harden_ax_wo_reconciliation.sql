CREATE INDEX IF NOT EXISTS idx_ax_warranty_work_orders_serial ON public.ax_warranty_work_orders (serial_no);
CREATE INDEX IF NOT EXISTS idx_ax_warranty_work_orders_type_status ON public.ax_warranty_work_orders (wo_type, status);
CREATE INDEX IF NOT EXISTS idx_claims_active_dealer_wo ON public.claims (dealer_wo_so) WHERE archived_at IS NULL;

CREATE OR REPLACE VIEW public.claim_wo_reconciliation_v
WITH (security_invoker = true)
AS
SELECT
  c.claim_id,
  c.dealer_wo_so AS claim_wo_no,
  c.claim_status,
  c.branch,
  c.model,
  c.serial_no AS claim_serial_no,
  c.customer AS claim_customer,
  wo.wo_no AS ax_wo_no,
  wo.status AS ax_wo_status,
  wo.wo_type AS ax_wo_type,
  wo.created_date AS ax_created_date,
  wo.start_date AS ax_start_date,
  wo.chassis_no AS ax_chassis_no,
  wo.serial_no AS ax_serial_no,
  wo.device_name AS ax_device_name,
  wo.delivery_name AS ax_delivery_name,
  wo.customer_account AS ax_customer_account,
  wo.device_number AS ax_device_number,
  wo.person_in_charge AS ax_person_in_charge,
  wo.primary_resource AS ax_primary_resource,
  wo.primary_resource_group AS ax_resource_group,
  wo.description AS ax_description,
  CASE
    WHEN nullif(trim(c.dealer_wo_so),'') IS NULL THEN 'CLAIM_WO_MISSING'
    WHEN wo.wo_no IS NULL THEN 'WO_NOT_FOUND_IN_AX'
    WHEN upper(trim(coalesce(wo.status,''))) = 'CANCELED' THEN 'AX_WO_CANCELED'
    WHEN upper(trim(coalesce(wo.wo_type,''))) <> 'WAR' THEN 'AX_WO_NON_WARRANTY_TYPE'
    WHEN nullif(trim(c.serial_no),'') IS NOT NULL
      AND (nullif(trim(wo.serial_no),'') IS NOT NULL OR nullif(trim(wo.chassis_no),'') IS NOT NULL)
      AND upper(trim(c.serial_no)) <> upper(trim(coalesce(wo.serial_no,wo.chassis_no)))
      AND upper(trim(c.serial_no)) <> upper(trim(coalesce(wo.chassis_no,wo.serial_no)))
      THEN 'AX_WO_SERIAL_MISMATCH'
    ELSE 'WO_MATCHED'
  END AS reconciliation_status,
  CASE
    WHEN wo.wo_no IS NULL THEN 'AX_WO_NOT_FOUND'
    WHEN nullif(trim(c.serial_no),'') IS NULL OR (nullif(trim(wo.serial_no),'') IS NULL AND nullif(trim(wo.chassis_no),'') IS NULL) THEN 'SOURCE_SERIAL_MISSING'
    WHEN upper(trim(c.serial_no)) = upper(trim(wo.serial_no)) OR upper(trim(c.serial_no)) = upper(trim(wo.chassis_no)) THEN 'MATCH'
    ELSE 'MISMATCH'
  END AS serial_reconciliation_status,
  (wo.wo_no IS NOT NULL) AS wo_found_in_ax,
  (wo.wo_no IS NOT NULL AND upper(trim(coalesce(wo.wo_type,''))) = 'WAR') AS ax_is_warranty_type,
  (wo.wo_no IS NOT NULL AND upper(trim(coalesce(wo.status,''))) = 'CANCELED') AS ax_is_canceled,
  CASE
    WHEN wo.wo_no IS NULL OR nullif(trim(c.serial_no),'') IS NULL THEN NULL
    WHEN nullif(trim(wo.serial_no),'') IS NULL AND nullif(trim(wo.chassis_no),'') IS NULL THEN NULL
    WHEN upper(trim(c.serial_no)) = upper(trim(wo.serial_no)) OR upper(trim(c.serial_no)) = upper(trim(wo.chassis_no)) THEN true
    ELSE false
  END AS serial_match
FROM public.claims c
LEFT JOIN public.ax_warranty_work_orders wo
  ON upper(trim(c.dealer_wo_so)) = upper(trim(wo.wo_no))
WHERE c.archived_at IS NULL;

COMMENT ON VIEW public.claim_wo_reconciliation_v IS 'Read-only reconciliation between active warranty claims and Dynamics AX work orders. WO number is the primary join key; serial/model/customer checks are validation signals, not destructive auto-corrections.';