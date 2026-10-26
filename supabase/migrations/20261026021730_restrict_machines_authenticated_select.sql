BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for all" ON public.machines;
REVOKE SELECT ON TABLE public.machines FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.machines TO authenticated;
DROP POLICY IF EXISTS machines_authenticated_select_gate ON public.machines;
CREATE POLICY machines_authenticated_select_gate
ON public.machines AS RESTRICTIVE FOR SELECT TO authenticated
USING (
 (SELECT auth.uid()) IS NOT NULL
 AND COALESCE((SELECT auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
);
COMMIT;
