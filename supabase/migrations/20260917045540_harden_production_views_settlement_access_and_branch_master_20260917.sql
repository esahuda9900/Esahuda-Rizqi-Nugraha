-- Production hardening after AX snapshot repair.
-- 1) Views must obey underlying RLS and are only exposed to signed-in users.
ALTER VIEW public.wo_warranty_universe_v SET (security_invoker = true);
ALTER VIEW public.wo_outstanding_v SET (security_invoker = true);
ALTER VIEW public.wo_outstanding_by_branch_v SET (security_invoker = true);
REVOKE SELECT ON public.wo_warranty_universe_v FROM anon;
REVOKE SELECT ON public.wo_outstanding_v FROM anon;
REVOKE SELECT ON public.wo_outstanding_by_branch_v FROM anon;
GRANT SELECT ON public.wo_warranty_universe_v TO authenticated;
GRANT SELECT ON public.wo_outstanding_v TO authenticated;
GRANT SELECT ON public.wo_outstanding_by_branch_v TO authenticated;

-- 2) Settlement evidence is read-only for authenticated app users.
DROP POLICY IF EXISTS sdlg_settlements_select_authenticated ON public.sdlg_settlements;
CREATE POLICY sdlg_settlements_select_authenticated
ON public.sdlg_settlements
FOR SELECT TO authenticated
USING (true);
DROP POLICY IF EXISTS sdlg_settlement_lines_select_authenticated ON public.sdlg_settlement_lines;
CREATE POLICY sdlg_settlement_lines_select_authenticated
ON public.sdlg_settlement_lines
FOR SELECT TO authenticated
USING (true);

-- 3) AX snapshot is an imported source, not a client-editable table.
DROP POLICY IF EXISTS ax_warranty_work_orders_write_admin ON public.ax_warranty_work_orders;

-- 4) Fix RLS performance/indexing around the payment evidence path.
CREATE INDEX IF NOT EXISTS sdlg_payment_batches_evidence_source_id_idx
  ON public.sdlg_payment_batches(evidence_source_id);

-- Remove exact duplicate non-constraint indexes, keeping the original named indexes.
DROP INDEX IF EXISTS public.idx_ax_warranty_work_orders_serial;
DROP INDEX IF EXISTS public.idx_ax_wo_serial_no;
DROP INDEX IF EXISTS public.idx_ax_warranty_work_orders_type_status;
DROP INDEX IF EXISTS public.idx_ax_wo_wo_type_status;
DROP INDEX IF EXISTS public.sdlg_settlement_lines_settlement_line_uq;

-- 5) Current AX source explicitly identifies these two branches.
INSERT INTO public.branches (branch_name, is_active)
SELECT v.branch_name, true
FROM (VALUES ('KENDARI'), ('MANADO')) AS v(branch_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.branches b WHERE upper(btrim(b.branch_name)) = v.branch_name
);
