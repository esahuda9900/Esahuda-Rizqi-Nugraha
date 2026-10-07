# SDLG Warranty Claim Web App — Permanent Project Context

Last updated: 2026-09-23 (expert pass — Vercel retired; Cloudflare sole host)

## Purpose
Internal web application for monitoring and managing SDLG warranty claims, replacing repetitive Excel/manual tracking while preserving the existing warranty business rules.

## Current production baseline

| Layer | Value |
|-------|-------|
| Production frontend host | Cloudflare Workers — https://sdlg-warranty-backup.esahuda9900.workers.dev |
| Git branch | main |
| Repository | esahuda9900/sdlg-warranty-backup |
| Supabase project | frqvelcreczmnofldrga (SDLG Warranty Claim, ap-southeast-2) |

## Technology
- Frontend: monolithic index.html + extracted modules/*.js
- Database / Auth / RPC: Supabase (Postgres 17, RLS, SECURITY DEFINER claim RPCs)
- Hosting: Cloudflare Workers (static assets via wrangler.jsonc) — sole production surface
- Source control: GitHub

## Core business workflow
Technical Support / Branch → Warranty → SDLG audit → Settlement / Payment → Finance billing → Final rebalancing.
The application must distinguish current action/status, workflow milestone/history, next action/follow-up, and eligibility decision versus operational claim status.

## Canonical warranty engine
The canonical warranty decision function is public.sdlg_warranty_resolve_claim(claim_id).
The frontend should prefer the canonical RPC and must not silently replace it with legacy warranty logic.

### Agreed warranty-routing model (2026-09-23)
The application must assess two separate warranty layers:
- SDLG Warranty — principal warranty eligibility based on B/L ceiling, policy duration, and HM.
- Marketing Warranty — company/internal coverage checked from Sales Date after SDLG OOW.
- Final Route — SDLG, Marketing, Review Required, or applicable non-warranty handling.

Agreed operational rule:
- B/L before 2026-01-01 is treated as Contract Customer.
- B/L on/after 2026-01-01 uses authoritative Contract Customer evidence.
- SDLG B/L maximum = applicable warranty duration + 6 months.
- SDLG effective calendar expiry uses the earlier applicable Sales Date warranty expiry and B/L ceiling.
- HM remains a separate 'whichever comes first' limit.
- SDLG OOW must not automatically mean no warranty; Marketing warranty must still be evaluated.
- Unresolved component policy category means REVIEW REQUIRED, even when part identity is known.

Full durable logic is documented in WARRANTY_LOGIC.md.

## Auto-enrichment / master-resolution target (2026-09-23)
After parsing, the application should automatically:
1. Resolve canonical machine.
2. Resolve exact AX WO when supplied.
3. Resolve operational customer from AX WO evidence (customer account / delivery name / custodian) into normalized customer master.
4. Resolve operational branch from AX WO evidence (location / primary resource / primary resource group).
5. Preserve source customer / source branch separately from normalized values.
6. Persist normalized FKs and provenance/confidence where appropriate.
7. Feed the enriched context into the canonical warranty engine.

AX WO is the operational source of truth for current warranty repair context. Do not invent machine/customer/branch relationships from weak matches.

For the established E6210F example:
- source customer was PT. DIA INDAH AUTO SERVICE
- AX WO WO26044098 showed account 4018, delivery/custodian INDAH PERKASA TRANS CV.
- normalized customer master is PT. INDAH PERKASA TRANS
- AX location/resource evidence resolves branch to PALEMBANG.

Do not automatically set machines.branch_id unless that field is explicitly defined as current/home machine branch; claim/WO branch is safer.

## Current important database objects
- public.claims — primary claim table
- public.claim_warranty_resolution_v — compatibility/read view for warranty resolution data
- public.sdlg_warranty_resolve_claim(claim_id) — canonical warranty resolver
- public.app_user_roles — application role mapping used by claims RLS policies
- public.free_tier_db_health — read-only size/volume monitor (authenticated only)

## Security model
Claims access is authenticated and role/branch controlled through RLS policies. Admin/Warranty Admin can write; Viewer can read; Branch User is restricted by branch. Database authorization is the security boundary; UI visibility is not sufficient authorization.

## Current build system warning
Production currently uses a sequence of scripts/apply-*.js injectors against the monolithic index.html. This is legacy technical debt and a primary regression risk. New fixes must avoid broad/global source rewriting and should be isolated whenever possible. See INJECTOR_ROADMAP.md and the freeze rule in DEPLOYMENT.md.

## Expert operating posture (locked 2026-09-23)
- Stabilization phase is complete.
- Cloudflare is the sole production surface (Vercel retired).
- No new injectors for routine fixes; prefer modules/*.js.
- Domain logic stays in Supabase.
- Remaining material gate: authenticated browser E2E (issue #12) using a dedicated test account.
- Free-tier headroom is protected.

## Engineering rule
Never fix one visible error by changing unrelated behavior. Every change must identify root cause, apply the smallest safe fix, run regression checks, and verify production afterward on the Cloudflare URL.

## Latest Production State — 2026-09-23
Claim `0241-2026-SDLG-PFR` now resolves through the canonical warranty engine as **SDLG OUT_OF_WARRANTY → Marketing IN_WARRANTY → final route MARKETING**. Exact AX WO `WO26044098` enrichment remains active (machine/customer/branch links populated while source customer text is preserved). Exact part `SLG-4120016088001` is classified as Excavator / Other parts through a controlled `MANUAL_APPROVAL` mapping with HIGH confidence; this is an application routing classification, not an assertion that SDLG's policy explicitly names the part category.
