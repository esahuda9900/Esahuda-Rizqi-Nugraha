create index if not exists idx_wo_followups_created_by on public.wo_followups(created_by);
create index if not exists idx_wo_followups_updated_by on public.wo_followups(updated_by);
