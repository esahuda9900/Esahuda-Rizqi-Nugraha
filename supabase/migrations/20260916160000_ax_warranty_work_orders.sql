-- Dynamics AX warranty work-order source layer.
-- Source file SHA-256: c9afaffb7508e61abc7fe95b22fca5998a3cd816fcfd3922e996e88d47955122
-- 789 source rows.
CREATE TABLE IF NOT EXISTS public.ax_warranty_work_orders (
  wo_no text PRIMARY KEY, created_at_source text, created_date date, start_date date,
  chassis_no text, serial_no text, case_group text, wo_type text, status text NOT NULL,
  description text, device_name text, delivery_name text, custodian text,
  customer_account text, device_number text, person_in_charge text,
  primary_resource text, primary_resource_group text, estimated_hours numeric,
  brand_number text, location text, location2 text, mobile_phone text,
  telephone text, name text, source_name text NOT NULL DEFAULT 'tableConvert.com_f5h7ki.md',
  source_sha256 text NOT NULL DEFAULT 'c9afaffb7508e61abc7fe95b22fca5998a3cd816fcfd3922e996e88d47955122',
  source_row_number integer, source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ax_warranty_work_orders_status_idx ON public.ax_warranty_work_orders(status);
CREATE INDEX IF NOT EXISTS ax_warranty_work_orders_type_status_idx ON public.ax_warranty_work_orders(wo_type,status);
CREATE INDEX IF NOT EXISTS ax_warranty_work_orders_serial_idx ON public.ax_warranty_work_orders(serial_no);
CREATE INDEX IF NOT EXISTS ax_warranty_work_orders_chassis_idx ON public.ax_warranty_work_orders(chassis_no);
ALTER TABLE public.ax_warranty_work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ax_warranty_work_orders_select_authenticated ON public.ax_warranty_work_orders;
CREATE POLICY ax_warranty_work_orders_select_authenticated ON public.ax_warranty_work_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ax_warranty_work_orders_write_admin ON public.ax_warranty_work_orders;
CREATE POLICY ax_warranty_work_orders_write_admin ON public.ax_warranty_work_orders FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.app_user_roles r WHERE r.user_id=auth.uid() AND r.is_active=true AND r.role='admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.app_user_roles r WHERE r.user_id=auth.uid() AND r.is_active=true AND r.role='admin'));
DROP VIEW IF EXISTS public.warranty_wo_source_v;
CREATE VIEW public.warranty_wo_source_v WITH (security_invoker=true) AS
SELECT wo.*, CASE WHEN wo.status='Canceled' THEN 'CANCELED' WHEN wo.wo_type='WAR' THEN 'VALID_WARRANTY_WO' WHEN coalesce(btrim(wo.wo_type),'')='' THEN 'TYPE_MISSING' ELSE 'NON_WARRANTY_TYPE' END AS wo_qualification
FROM public.ax_warranty_work_orders wo WHERE wo.wo_no ~ '^WO[0-9]{8}$';
GRANT SELECT ON public.warranty_wo_source_v TO authenticated;
REVOKE ALL ON public.warranty_wo_source_v FROM anon;
DROP VIEW IF EXISTS public.claim_wo_reconciliation_v;
CREATE VIEW public.claim_wo_reconciliation_v WITH (security_invoker=true) AS
SELECT c.claim_id,c.dealer_wo_so AS claim_wo_no,c.claim_status,c.branch,c.model,c.serial_no,c.customer,
wo.wo_no AS ax_wo_no,wo.status AS ax_wo_status,wo.wo_type AS ax_wo_type,wo.created_date AS ax_created_date,
wo.start_date AS ax_start_date,wo.chassis_no AS ax_chassis_no,wo.serial_no AS ax_serial_no,
wo.device_number AS ax_device_number,wo.primary_resource_group AS ax_resource_group,wo.description AS ax_description,
CASE WHEN nullif(btrim(c.dealer_wo_so),'') IS NULL THEN 'CLAIM_WO_MISSING'
WHEN wo.wo_no IS NULL THEN 'WO_NOT_FOUND_IN_AX'
WHEN wo.wo_type <> 'WAR' THEN 'AX_WO_NON_WARRANTY_TYPE'
WHEN wo.status='Canceled' THEN 'AX_WO_CANCELED'
WHEN nullif(btrim(c.serial_no),'') IS NOT NULL AND nullif(btrim(wo.serial_no),'') IS NOT NULL AND upper(btrim(c.serial_no))<>upper(btrim(wo.serial_no)) THEN 'WO_FOUND_SERIAL_MISMATCH'
ELSE 'WO_MATCHED' END AS reconciliation_status
FROM public.claims c LEFT JOIN public.ax_warranty_work_orders wo ON upper(btrim(c.dealer_wo_so))=upper(btrim(wo.wo_no)) WHERE c.archived_at IS NULL;
GRANT SELECT ON public.claim_wo_reconciliation_v TO authenticated;
REVOKE ALL ON public.claim_wo_reconciliation_v FROM anon;
COMMENT ON TABLE public.ax_warranty_work_orders IS 'Dynamics AX source snapshot for warranty work orders. AX is authoritative for WO existence; claims owns the warranty workflow lifecycle.';
COMMENT ON VIEW public.claim_wo_reconciliation_v IS 'Read-only reconciliation of active claims against their authoritative Dynamics AX WO reference.';
