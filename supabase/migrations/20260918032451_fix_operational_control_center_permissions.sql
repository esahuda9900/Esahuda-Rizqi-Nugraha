-- Operational Control Center needs SELECT on the source table because its
-- security-invoker views execute with the authenticated caller's privileges.
GRANT SELECT ON TABLE public.ax_warranty_work_orders TO authenticated;

-- Keep the read surface explicit and limited to the control-center views.
GRANT SELECT ON TABLE public.warranty_control_summary_v TO authenticated;
GRANT SELECT ON TABLE public.wo_followup_queue_v TO authenticated;
GRANT SELECT ON TABLE public.wo_outstanding_by_branch_v TO authenticated;

-- Follow-up logging is an authenticated-only workflow.
GRANT INSERT ON TABLE public.wo_followups TO authenticated;

-- Ensure the source table is protected by RLS while allowing the control-center
-- read path for signed-in users only.
ALTER TABLE public.ax_warranty_work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ax_warranty_work_orders_select_authenticated ON public.ax_warranty_work_orders;
CREATE POLICY ax_warranty_work_orders_select_authenticated
  ON public.ax_warranty_work_orders
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.wo_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wo_followups_insert_authenticated ON public.wo_followups;
CREATE POLICY wo_followups_insert_authenticated
  ON public.wo_followups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
