# PRD — SDLG Warranty Claim System

**Status:** Approved baseline for frontend rebuild  
**Owner:** Esahuda Rizqi Nugraha (product)  
**Last updated:** 2026-10-16  
**Primary URL (production):** https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/  
**Backend (immutable for rebuild):** Supabase project `frqvelcreczmnofldrga` (SDLG Warranty Claim)

---

## 1. Problem statement

Dealer and warranty admins at PT. Indo Traktor Utama must ingest SDLG warranty claim forms (Excel/paste), match units/customers/parts, store claims, and track status.

The current frontend is a ~3MB monolithic `index.html` plus many global `window.*` modules. Multiple DOM/React writers race on the same claim form, causing flicker, cross-claim field contamination, and endless patch PRs.

**Backend data and RPCs are production-critical and must not be redesigned in v1 rebuild.**

---

## 2. Goal

Ship a **clean frontend** that:

1. Uses the **existing Supabase** schema, RLS, Auth, and warranty RPCs.
2. Makes the **eight mandatory flows** below reliable under real admin use.
3. Has **one writer** for claim UI state (no interval DOM hydrators).
4. Is maintainable by AI-assisted coding under a strict module layout.

Success is measured by **smoke checklist pass on production URL**, not by “CI grepped a string.”

---

## 3. Non-goals (v1 rebuild)

- Migrating or rewriting Postgres schema “for cleanliness.”
- Replacing warranty policy engine in the browser.
- Public customer portal.
- Multi-tenant / multi-distributor productization.
- Full visual rebrand.
- Fancy pagination, full audit-log UI, boss analytics polish (defer to v1.1+).
- Keeping Cloudflare Workers as a second production host.

---

## 4. Users & roles

| Role | Capabilities |
|------|----------------|
| **Warranty Admin** | Login, overview, list/detail claims, parse, create/update claims, master data read, data quality signals |
| **Viewer** (if granted in Supabase) | Read-only list/detail/overview |

Auth = Supabase Auth. Never ship `service_role` to the browser.

---

## 5. System context

```
[Browser — new frontend]
    → Supabase Auth
    → Postgres via RLS + official client
    → Domain RPCs (warranty resolve, policy snapshot, etc.)

[Legacy monolith]
    → Frozen after cutover; archive branch only
```

| Layer | Authority |
|-------|-----------|
| Claim / machine / audit data | Supabase |
| Warranty eligibility / policy | Supabase RPC (e.g. `sdlg_warranty_resolve_claim`, `sdlg_policy_runtime_snapshot`) |
| UI state, routing, parse UX | New frontend only |

---

## 6. Mandatory flows (Definition of Done)

A build may **not** replace production until **all** of these pass on an authenticated session against live Supabase:

| ID | Flow | Pass criteria |
|----|------|----------------|
| F1 | **Login** | Valid user enters app; refresh keeps session; invalid creds show clear error |
| F2 | **Overview** | KPI/counts match DB order of magnitude; no lying “0” flash that never resolves |
| F3 | **Claims list → detail A → detail B** | Within 10s switch, fields show **B only**; no residue from A |
| F4 | **Parse paste / Excel** | Core fields populated (model, serial, WO, fault, part, HM, dates); money placeholders (`USD -`, `¥-`) → 0, not serial leakage |
| F5 | **WO collision** | Same WO as existing claim → modal with old vs new fault/part; **Simpan Baru** clears WO on new row; **Update** requires confirm when weak/audit |
| F6 | **Save create** | Row appears in Supabase + list; claim id stable |
| F7 | **Save update** | Same claim id updated; no silent overwrite without confirm when policy requires it |
| F8 | **Logout** | Session cleared; protected routes inaccessible |

Optional but recommended before cutover:

| ID | Flow |
|----|------|
| F9 | Master / unit lookup read path (branch/customer from unit history) |
| F10 | Mobile: list + detail usable on phone width |

---

## 7. Business rules (frontend must respect)

Full detail: `docs/business/BUSINESS_RULES.md`, `WARRANTY_LOGIC.md`, `DATA_DICTIONARY.md`.

**Hard rules for UI:**

1. **1 WO ≈ 1 active claim**, exception allowlist includes `WO26040309` only (ops-approved).
2. On **Simpan Baru** with WO collision: clear `dealer_wo_so` on the **new** claim; do not attach the colliding WO.
3. **Update** of an existing claim that is weak-match (different fault/part) or audit-like status → explicit confirm with diff.
4. **SOURCE LOCK / master match** are guidance; do not invent canonical values that contradict source without user confirmation where legacy lock required it.
5. Portal/Home field mapping (if still exposed): Service Method ← `repair_method` (fallback `service_method`); repair report date ← repair/completion/failure date chain — see `AGENTS.md`.
6. Domain policy stays in Supabase; frontend displays results and sends structured inputs only.

---

## 8. Functional scope — v1 frontend

### In scope

- Auth (login / logout / session)
- Overview (stable counts)
- Claims list + claim detail (read)
- Claim create/update via parse pipeline
- Parse: paste text + Excel import (SheetJS or equivalent)
- WO collision modal (modern in-app UI)
- Error and empty states (fail closed on fetch/RLS errors for selected claim)
- Basic responsive layout

### Explicitly out of scope for v1

- New policy rules tables in browser
- Rebuilding all historical injector CSS
- Boss analytics / command center feature parity day-one
- Payment/rebalancing evidence full parity (port later if still required)

---

## 9. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Hosting | **Single** production host: GitHub Pages (unless product later chooses otherwise) |
| Security | RLS on; no service_role in client; CSP as strict as practical |
| Performance | First meaningful list under ~3s on normal office network after auth |
| Reliability | Selected claim always loaded by **exact claim_id**; never `live \|\| listCache` fallback for editor body |
| Observability | Clear console/pipeline guard for auth and failed fetches (no silent empty shell) |
| Maintainability | TypeScript preferred; no new `scripts/apply-*.js` injectors for product features |

---

## 10. Technical constraints

- Supabase URL/ref: `https://frqvelcreczmnofldrga.supabase.co`
- Existing tables/RPCs remain source of truth (claims, machines, audit, warranty RPCs).
- Legacy repo paths and anti-regression notes in `AGENTS.md` apply until monolith is archived.
- Rebuild must not require free-tier paid upgrade as a “fix.”

---

## 11. UX principles

1. Prefer **confirm modals with diff** over silent save when data loss is possible.
2. Prefer **human labels** (“WO sama · kerusakan beda”) over jargon (“weak match”) in user-facing copy.
3. One primary action per screen; destructive actions secondary + confirmed.
4. Loading / error / success must be distinguishable (no blank white “success”).

---

## 12. Rollout plan (summary)

See `docs/FRONTEND_REBUILD_PLAN.md`.

1. Freeze legacy feature work  
2. Scaffold clean app  
3. Read paths (list/detail)  
4. Parse + save  
5. Smoke F1–F8  
6. Cutover Pages → new build  
7. Archive monolith branch  

Rollback: point Pages back to `backup/latest-green` / last known monolith SHA.

---

## 13. Acceptance (product)

Product owner accepts cutover when:

- [ ] F1–F8 checked on production Supabase with real admin account  
- [ ] At least one real parse of a dealer form saved without cross-claim pollution  
- [ ] WO collision path exercised once (Baru + cancel Update)  
- [ ] Legacy URL either redirects or is clearly marked retired  

---

## 14. Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-10-16 | Initial PRD for clean frontend rebuild |

Changes to mandatory flows or hard business rules require explicit product approval and a version bump here.
