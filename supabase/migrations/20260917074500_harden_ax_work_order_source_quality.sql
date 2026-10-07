alter table public.ax_warranty_work_orders add column if not exists source_quality_status text not null default 'OK';
alter table public.ax_warranty_work_orders add column if not exists source_quality_notes text;

create table if not exists public.ax_warranty_work_order_import_issues (
  id uuid primary key default gen_random_uuid(),
  source_row_number integer not null,
  source_name text not null,
  source_payload jsonb not null default '{}'::jsonb,
  issue_code text not null,
  issue_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_name, source_row_number)
);

alter table public.ax_warranty_work_order_import_issues enable row level security;
drop policy if exists ax_wo_import_issues_read_authenticated on public.ax_warranty_work_order_import_issues;
create policy ax_wo_import_issues_read_authenticated
  on public.ax_warranty_work_order_import_issues
  for select to authenticated using (true);

create index if not exists idx_ax_wo_source_quality_status on public.ax_warranty_work_orders(source_quality_status);
create index if not exists idx_ax_wo_wo_type_status on public.ax_warranty_work_orders(wo_type,status);
create index if not exists idx_ax_wo_serial_no on public.ax_warranty_work_orders(serial_no);
create index if not exists idx_ax_wo_location on public.ax_warranty_work_orders(location);

comment on table public.ax_warranty_work_order_import_issues is 'Source-quality exceptions from Dynamics AX warranty work order imports; preserves malformed/non-WO source rows without fabricating WO identities.';
