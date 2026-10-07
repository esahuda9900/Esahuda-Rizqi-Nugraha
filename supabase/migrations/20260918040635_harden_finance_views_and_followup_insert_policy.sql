revoke select on table public.sdlg_settlement_disputes from anon;
revoke select on table public.claim_rebalancing_summary_v from anon;
revoke select on table public.claim_rebalancing_v from anon;
revoke select on table public.claim_settlement_summary_v from anon;
revoke select on table public.wo_outstanding_summary_v from anon;
drop policy if exists wo_followups_insert_authenticated on public.wo_followups;
