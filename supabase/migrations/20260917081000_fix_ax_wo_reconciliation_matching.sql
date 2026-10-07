CREATE OR REPLACE VIEW public.claim_wo_reconciliation_v WITH (security_invoker=true) AS
WITH normalized_claims AS (
  SELECT c.*, upper(regexp_replace(coalesce(btrim(c.dealer_wo_so),''), '[^A-Za-z0-9]', '', 'g')) AS wo_key,
         upper(regexp_replace(coalesce(btrim(c.serial_no),''), '[^A-Za-z0-9]', '', 'g')) AS serial_key
  FROM public.claims c WHERE c.archived_at IS NULL
), normalized_ax AS (
  SELECT wo.*, upper(regexp_replace(coalesce(btrim(wo.wo_no),''), '[^A-Za-z0-9]', '', 'g')) AS wo_key,
         upper(regexp_replace(coalesce(btrim(wo.serial_no),''), '[^A-Za-z0-9]', '', 'g')) AS serial_key
  FROM public.ax_warranty_work_orders wo
)
SELECT c.claim_id,
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
         WHEN nullif(c.wo_key,'') IS NULL THEN 'CLAIM_WO_MISSING'
         WHEN wo.wo_no IS NULL THEN 'WO_NOT_FOUND_IN_AX'
         WHEN upper(btrim(wo.wo_type)) <> 'WAR' THEN 'AX_WO_NON_WARRANTY_TYPE'
         WHEN upper(btrim(wo.status)) = 'CANCELED' THEN 'AX_WO_CANCELED'
         WHEN nullif(c.serial_key,'') IS NOT NULL AND nullif(wo.serial_key,'') IS NOT NULL
              AND c.serial_key <> wo.serial_key AND right(c.serial_key,6) <> right(wo.serial_key,6)
           THEN 'AX_WO_SERIAL_MISMATCH'
         ELSE 'WO_MATCHED'
       END AS reconciliation_status,
       CASE
         WHEN wo.wo_no IS NULL THEN 'AX_WO_NOT_FOUND'
         WHEN nullif(c.serial_key,'') IS NULL OR nullif(wo.serial_key,'') IS NULL THEN 'NOT_COMPARABLE'
         WHEN c.serial_key = wo.serial_key THEN 'MATCH'
         WHEN right(c.serial_key,6) = right(wo.serial_key,6) THEN 'MATCH_SUFFIX_6'
         ELSE 'MISMATCH'
       END AS serial_reconciliation_status,
       (wo.wo_no IS NOT NULL) AS wo_found_in_ax,
       (upper(btrim(wo.wo_type)) = 'WAR') AS ax_is_warranty_type,
       (upper(btrim(wo.status)) = 'CANCELED') AS ax_is_canceled,
       CASE
         WHEN wo.wo_no IS NULL OR nullif(c.serial_key,'') IS NULL OR nullif(wo.serial_key,'') IS NULL THEN NULL
         WHEN c.serial_key = wo.serial_key OR right(c.serial_key,6) = right(wo.serial_key,6) THEN true
         ELSE false
       END AS serial_match
FROM normalized_claims c LEFT JOIN normalized_ax wo ON c.wo_key = wo.wo_key;
GRANT SELECT ON public.claim_wo_reconciliation_v TO authenticated;
REVOKE ALL ON public.claim_wo_reconciliation_v FROM anon;
