create table if not exists public.wo_followups (
  id uuid primary key default gen_random_uuid(),
  wo_no text not null,
  wo_key text generated always as (upper(regexp_replace(trim(wo_no), '[^A-Za-z0-9]+', '', 'g'))) stored,
  branch_name text,
  followup_type text not null check (followup_type in ('REPORT_REQUEST','REJECTION_CORRECTION','SDLG_AUDIT','FINANCE_PAYMENT','OTHER')),
  recipient_scope text not null default 'BRANCH' check (recipient_scope in ('BRANCH','SDLG','FINANCE','INTERNAL')),
  sent_date date not null default current_date,
  response_date date,
  response_status text not null default 'PENDING' check (response_status in ('PENDING','RECEIVED','NOT_RECEIVED','NOT_REQUIRED')),
  response_summary text,
  next_action text,
  next_due_date date,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wo_followups_response_after_sent check (response_date is null or response_date >= sent_date)
);

create index if not exists idx_wo_followups_wo_key on public.wo_followups(wo_key);
create index if not exists idx_wo_followups_branch_due on public.wo_followups(branch_name,next_due_date);
create index if not exists idx_wo_followups_sent_date on public.wo_followups(sent_date desc);

alter table public.wo_followups enable row level security;

drop policy if exists wo_followups_select on public.wo_followups;
drop policy if exists wo_followups_insert on public.wo_followups;
drop policy if exists wo_followups_update on public.wo_followups;
drop policy if exists wo_followups_delete on public.wo_followups;

create policy wo_followups_select on public.wo_followups
for select to authenticated
using (
  exists (
    select 1 from public.app_user_roles aur
    where aur.user_id = (select auth.uid())
      and aur.is_active = true
      and (
        aur.role in ('admin','warranty_admin','viewer')
        or (aur.role = 'branch_user' and upper(coalesce(aur.branch_id::text,'')) = upper(coalesce((select b.id::text from public.branches b where upper(b.branch_name)=upper(public.wo_followups.branch_name) limit 1),'')))
      )
  )
);

create policy wo_followups_insert on public.wo_followups
for insert to authenticated
with check (
  exists (
    select 1 from public.app_user_roles aur
    where aur.user_id = (select auth.uid())
      and aur.is_active = true
      and aur.role in ('admin','warranty_admin')
  )
);

create policy wo_followups_update on public.wo_followups
for update to authenticated
using (
  exists (
    select 1 from public.app_user_roles aur
    where aur.user_id = (select auth.uid())
      and aur.is_active = true
      and aur.role in ('admin','warranty_admin')
  )
)
with check (
  exists (
    select 1 from public.app_user_roles aur
    where aur.user_id = (select auth.uid())
      and aur.is_active = true
      and aur.role in ('admin','warranty_admin')
  )
);

create policy wo_followups_delete on public.wo_followups
for delete to authenticated
using (
  exists (
    select 1 from public.app_user_roles aur
    where aur.user_id = (select auth.uid())
      and aur.is_active = true
      and aur.role = 'admin'
  )
);

grant select, insert, update, delete on public.wo_followups to authenticated;
revoke all on public.wo_followups from anon;

create or replace view public.wo_followup_queue_v
with (security_invoker = true)
as
select
  o.wo_no,
  o.case_group,
  o.ax_status,
  o.branch_name,
  o.branch_source,
  o.primary_resource_group,
  o.primary_resource,
  o.serial_no,
  o.chassis_no,
  o.description,
  o.person_in_charge,
  o.unit_location2,
  o.aging_anchor_date,
  o.aging_days,
  o.aging_bucket,
  o.outstanding_class,
  o.claim_id,
  o.claim_status,
  o.dealer_claim_no,
  o.claim_branch,
  o.rejection_reason,
  o.status_update_reason,
  o.claim_fob_amount,
  o.claim_currency,
  o.ball_in_court,
  o.action_hint,
  o.include_in_branch_followup,
  f.id as followup_id,
  f.followup_type,
  f.recipient_scope,
  f.sent_date,
  f.response_date,
  f.response_status,
  f.response_summary,
  f.next_action,
  f.next_due_date,
  f.notes as followup_notes,
  f.updated_at as followup_updated_at,
  case
    when not o.include_in_branch_followup then 'NOT_IN_BRANCH_QUEUE'
    when f.id is null then 'NOT_FOLLOWED_UP'
    when f.response_status in ('RECEIVED','NOT_REQUIRED') then 'RESPONDED'
    when f.next_due_date < current_date then 'OVERDUE'
    when f.next_due_date = current_date then 'DUE_TODAY'
    else 'PENDING'
  end as followup_state,
  case
    when f.sent_date is null then null
    else greatest(0, current_date - f.sent_date)
  end as days_since_last_followup
from public.wo_outstanding_v o
left join lateral (
  select wf.*
  from public.wo_followups wf
  where wf.wo_key = upper(regexp_replace(trim(o.wo_no), '[^A-Za-z0-9]+', '', 'g'))
  order by wf.sent_date desc, wf.updated_at desc, wf.created_at desc
  limit 1
) f on true;

grant select on public.wo_followup_queue_v to authenticated;
revoke all on public.wo_followup_queue_v from anon;

create or replace view public.warranty_control_summary_v
with (security_invoker = true)
as
select
  (select count(*) from public.wo_warranty_universe_v) as valid_warranty_wo,
  (select count(*) from public.wo_outstanding_v where include_in_branch_followup) as branch_followup_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='NO_REPORT') as no_report_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='IN_CLAIM_PIPELINE') as claim_pipeline_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='PAID_CLOSED') as paid_closed_wo,
  (select count(*) from public.wo_outstanding_v where outstanding_class='REJECTED_NEED_CORRECTION') as rejected_followup_wo,
  (select count(*) from public.claims where archived_at is null) as active_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='SDLG Audit') as sdlg_audit_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='Paid') as paid_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='Rejected') as rejected_claims,
  (select count(*) from public.claims where archived_at is null and claim_status='Draft') as draft_claims,
  (select count(*) from public.sdlg_settlements) as settlement_rows,
  (select count(*) from public.sdlg_settlement_disputes where status not in ('RESOLVED','CLOSED')) as open_disputes;

grant select on public.warranty_control_summary_v to authenticated;
revoke all on public.warranty_control_summary_v from anon;

create or replace function public.set_wo_followup_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then new.updated_by = auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists trg_wo_followups_updated_at on public.wo_followups;
create trigger trg_wo_followups_updated_at
before update on public.wo_followups
for each row execute function public.set_wo_followup_updated_at();

revoke execute on function public.set_wo_followup_updated_at() from public, anon, authenticated;
