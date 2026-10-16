# DECISIONS — SDLG Warranty web rebuild

## D-001 — Frontend only rebuild
Backend = existing Supabase. No schema change without written owner OK + staging.

## D-002 — Roles
Source of truth: `public.app_user_roles` (`admin`, `warranty_admin`, `viewer`). UI hide ≠ security; RLS + RPC enforce.

## D-003 — Claim identity
Always load claim by exact `claim_id`. Fail closed. No list-cache fallback for detail.

## D-004 — Empty overwrite forbidden
Update patches omit null/empty strings so filled DB fields are not wiped.

## D-005 — Writes prefer RPC
- New claim: `create_sdlg_claim`
- Status: `update_claim_status`
- Id hint: `next_sdlg_claim_id`

## D-006 — Cutover deferred (owner)
**As of 2026-10-16:** Milestone 3 cutover is **explicitly deferred**. Old monolith stays production. New app lives at `/preview/` only until owner accepts feature parity. Do not archive or replace root Pages with React app without owner OK.

## D-007 — SOURCE LOCK soft in M1
Customer PT/CV strip both ends (`baseCustomerName`). Mismatch shows warning; hard block deferred until parity review.
