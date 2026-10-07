# Claim warranty decisions (persist assessment)

## Why

Claim Detail currently waits on live views (`claim_warranty_policy_v`, matrix, aging). That makes **Warranty Assessment** feel slow and sometimes empty on first paint.

## Target table (proposal — apply in Supabase when ready)

```sql
create table if not exists public.claim_warranty_decisions (
  claim_id text primary key references public.claims(claim_id) on delete cascade,
  route text not null, -- SDLG | MARKETING | REVIEW | NON_WARRANTABLE
  in_warranty boolean,
  coverage_class text,
  component_category text,
  tier text,
  effective_expiry date,
  hm_limit numeric,
  reason text,
  matrix jsonb,
  policy_version text,
  decided_at timestamptz not null default now(),
  decided_by text
);

create index if not exists claim_warranty_decisions_route_idx
  on public.claim_warranty_decisions (route);
```

## Write path

- On claim create / failure part+date+HM change / explicit Recompute:
  - Run existing engine / read current views
  - Upsert one row into `claim_warranty_decisions`
- Do **not** overwrite on every page view

## Read path (UI)

1. Prefer `claim_warranty_decisions` by `claim_id` (instant)
2. Fallback to live views if missing
3. Optional button: Recompute from live policy

## Unit portfolio (phase 2)

Separate `unit_warranty_snapshots` keyed by serial for Unit 360 — not mixed with claim decisions.

## Status

- **Documented:** yes
- **Migrated in production DB:** not by this frontend-only change
- **UI wired to table:** pending after migration
