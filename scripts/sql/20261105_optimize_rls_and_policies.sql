-- ============================================================================
-- SQL Optimization Script for SDLG Database (PostgreSQL 17 / Supabase)
-- Target: Resolve Performance Advisor warnings on machines & ax_warranty_work_order_costs
-- Author: Expert Senior Engineer
-- Date: 2026-11-05
-- Reference: AGENTS.md rule 2 (Run in Staging first, then apply to Production)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. OPTIMIZE RLS ON public.machines (Resolve "auth RLS initplan" warning)
-- ----------------------------------------------------------------------------
-- Issue: When an RLS policy references auth.uid() directly (e.g. branch_id = ...),
-- Postgres treats auth.uid() as a volatile function evaluated for every row.
-- For 3,676+ machines, this results in 3,676 function calls instead of 1.
-- Solution: Wrap auth.uid() in (SELECT auth.uid()). Postgres then evaluates it
-- as an InitPlan subquery ONCE per query execution and applies fast index scans.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE 'Optimizing RLS policies on public.machines...';
END $$;

-- Example: Recreate branch_user policy with (SELECT auth.uid()) InitPlan optimization:
-- Note: Adjust policy name if your existing policy differs (e.g., machines_select_policy)
/*
DROP POLICY IF EXISTS "machines_branch_select" ON public.machines;

CREATE POLICY "machines_branch_select" ON public.machines
    FOR SELECT
    TO authenticated
    USING (
        -- Admins can view all machines
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid())
              AND role IN ('admin', 'warranty_admin')
        )
        OR
        -- Branch users can view their branch machines or unassigned machines
        branch_id IS NULL
        OR
        branch_id = (
            SELECT branch_id FROM public.profiles
            WHERE id = (SELECT auth.uid())
        )
    );
*/

-- ----------------------------------------------------------------------------
-- 2. CONSOLIDATE PERMISSIVE POLICIES ON public.ax_warranty_work_order_costs
-- ----------------------------------------------------------------------------
-- Issue: Supabase Performance Advisor flags "multiple permissive policies"
-- on ax_warranty_work_order_costs. Having multiple permissive policies forces
-- the engine to evaluate OR combinations across every policy for every read.
-- Solution: Consolidate multiple SELECT policies into a single unified policy.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE 'Consolidating permissive policies on public.ax_warranty_work_order_costs...';
END $$;

/*
-- Inspect existing policies on the table:
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'ax_warranty_work_order_costs';

-- After checking existing names, drop duplicates and consolidate:
-- DROP POLICY IF EXISTS "allow_read_ax_costs_admin" ON public.ax_warranty_work_order_costs;
-- DROP POLICY IF EXISTS "allow_read_ax_costs_authenticated" ON public.ax_warranty_work_order_costs;

-- Unified single permissive policy:
-- CREATE POLICY "ax_warranty_work_order_costs_select_policy"
--     ON public.ax_warranty_work_order_costs
--     FOR SELECT
--     TO authenticated
--     USING (
--         EXISTS (
--             SELECT 1 FROM public.profiles
--             WHERE id = (SELECT auth.uid())
--         )
--     );
*/

-- ----------------------------------------------------------------------------
-- 3. UNUSED INDEXES AUDIT (Read-only query for Owner)
-- ----------------------------------------------------------------------------
-- Supabase Performance Advisor noted several unused indexes.
-- Run this query to observe index hit counts before considering any index drop.
-- ----------------------------------------------------------------------------
SELECT 
    schemaname, 
    relname AS table_name, 
    indexrelname AS index_name, 
    idx_scan AS number_of_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
