# SDLG Warranty Claim Web App — Warranty & Auto-Enrichment Logic

Last updated: 2026-09-23
Status: Agreed project business logic / implementation target

This document records the warranty-routing and master-enrichment logic agreed for the SDLG Warranty Claim Web App. It is intended to prevent repeated re-explanation across future chats and to guide implementation, regression tests, and UI behavior.

## 1. Core principle

The application must not behave like an Excel form that only stores pasted values.
After a claim is parsed, the system should automatically connect the claim to existing authoritative data in Supabase and derive normalized operational context.
Target flow:
Paste/Input → Parser → Machine Resolution → AX WO Resolution → Master Enrichment → Warranty Assessment → Final Routing → Claim Monitoring

## 2. Master-enrichment logic

### 2.1 Machine resolution
Use the existing machine resolver to identify the canonical machine.
When a sufficiently confident exact machine is found, hydrate the claim with available machine-master fields such as machine_id, canonical serial, canonical model, indent, sale date, bill of lading date, dealer, product family, policy scope, and other authoritative machine attributes.
Do not invent identity mappings when evidence is ambiguous.

### 2.2 AX Work Order is the operational source of truth
For warranty repair claims, the AX WO created by the branch/mechanic is the operational source for the current repair context.
When an exact WO is supplied and found: resolve the AX WO; use customer account / delivery name / custodian evidence to resolve the operational customer; use location / primary resource / primary resource group to resolve the operational branch; retain the original pasted/source values separately.

### 2.3 Customer resolution
Customer resolution should prefer evidence from the exact AX WO over an unverified pasted customer label.
Keep both source_customer and resolved_customer/customer_id, together with resolution_source and confidence where practical.
Do not overwrite or delete source customer text merely because the normalized master customer is different.
Established example: source claim customer = PT. DIA INDAH AUTO SERVICE; AX customer_account = 4018; AX delivery_name = INDAH PERKASA TRANS CV.; AX custodian = INDAH PERKASA TRANS CV.; normalized master = PT. INDAH PERKASA TRANS.
This is a normalization/enrichment result, not permission to rewrite the historical source field.

### 2.4 Branch resolution
For the claim/WO, resolve branch from authoritative AX operational evidence such as location, primary resource, and primary resource group.
Established example: location = PALEMBANG; primary_resource = Palembang_Field; primary_resource_group = ITR - PALEMBANG → normalized claim branch = PALEMBANG.
Do not automatically overwrite machines.branch_id unless that field is explicitly defined as the machine's current/home operational branch. Claim/WO branch is the safer deterministic target.

### 2.5 Provenance
Preserve how important normalization was resolved. At minimum, preserve source value, normalized value, source/system, and confidence for customer, branch, and machine identity when practical.

## 3. Warranty model: two independent warranty assessments

The application must distinguish SDLG principal warranty from company/Marketing warranty.
Do not reduce the result to one generic IN WARRANTY / OUT OF WARRANTY flag.
Required conceptual outputs: SDLG Warranty Status; SDLG Warranty Expiry; SDLG Warranty Basis / Reason; Marketing Warranty Status; Marketing Warranty Expiry; Marketing Warranty Basis / Reason; Component Policy Category; Component Classification Confidence; Final Claim Route.

## 4. SDLG warranty logic

### 4.1 Contract rule agreed for this application
For units with B/L date before 2026-01-01: B/L < 2026-01-01 → treat as Contract Customer. This is an internal application business rule for operational continuity.
For units with B/L date on/after 2026-01-01: determine Contract Customer from available authoritative data; do not infer contract status from unrelated fields unless an explicit business rule says so.

### 4.2 Warranty duration
Use the applicable policy category's warranty duration from the policy database.
Current Excavator 20 t <= T < 65 t policy data examples: Key components = Standard 24 months / Contract 36 months; Chinese-brand main pump/valve = Standard 30 months / Contract 36 months; Other parts = Standard 18 months / Contract 24 months.
The exact category must come from a trustworthy component classification. Exact part identity alone is not automatically a policy category.

### 4.3 B/L maximum rule
For the agreed SDLG logic: B/L maximum = applicable warranty duration + 6 months.
Examples: 18 → 24 months maximum from B/L; 24 → 30; 30 → 36; 36 → 42.
This replaces the simplistic implementation that hardcodes only 30 months for key/critical and 24 months for other parts.

### 4.4 SDLG effective expiry
Sales-based warranty expiry = applicable warranty months from Sales Date.
B/L ceiling expiry = B/L + applicable warranty months + 6 months.
SDLG effective expiry = the earlier of the applicable calendar limits.
Operating-hour limits must also be checked. The policy principle remains whichever comes first. A claim can fail because of calendar expiry or HM expiry.

## 5. Marketing warranty logic

Marketing warranty is a separate assessment.
If SDLG warranty has expired because the B/L ceiling has been reached, the system MUST still evaluate whether the machine remains covered from Sales Date.
Marketing expiry = Sales Date + applicable internal/marketing warranty duration.
Also evaluate the applicable HM limit if the business rule for the marketing coverage includes one.
Do not treat SDLG OOW as equivalent to no warranty anywhere.

## 6. Final routing logic

Case A: SDLG = IN WARRANTY → route to SDLG claim workflow.
Case B: SDLG = OOW and Marketing = IN WARRANTY → route to MARKETING / internal warranty handling.
Case C: SDLG = OOW and Marketing = OOW → route as non-warranty / customer-pay / applicable commercial process according to operational rules.
Case D: either assessment is incomplete or component classification is unresolved → REVIEW REQUIRED.
Do not manufacture a final eligibility result from missing policy evidence.

## 7. Component classification gate

Warranty category is a separate problem from part identity.
Example: part master can confidently identify Sealing Kit Center Passage while policy category remains unresolved.
Therefore component identity can be HIGH confidence while policy category is simultaneously LOW/UNKNOWN confidence.
The application should only issue a final claim route when the required policy category is resolved with sufficient evidence.

## 8. UI requirement

Claim detail should show the two warranty assessments explicitly:
SDLG WARRANTY — status, expiry, basis, reason.
MARKETING WARRANTY — status, expiry, basis, reason.
FINAL ROUTING — SDLG / MARKETING / REVIEW REQUIRED / applicable non-warranty route.
The actual dates/durations must be computed from resolved component category and policy data, not hardcoded into the UI.

## 9. Example: E6210F

Serial = VLGE621FCN0609734; Model = E6210F; B/L = 2023-01-07; Sales = 2025-08-12; Failure = 2026-09-19; Failure HM = 2789; WO = WO26044098.
Because B/L < 2026-01-01, the agreed internal rule treats this unit as Contract.
If the failed component is classified as a 36-month Contract category such as Key Components: Sales-based expiry = 2028-08-12; B/L maximum = 2026-07-07; SDLG effective expiry = 2026-07-07; failure 2026-09-19 → SDLG OOW.
If that same component category also has a 36-month Marketing coverage from Sales Date: Marketing expiry = 2028-08-12; failure 2026-09-19 → Marketing IN WARRANTY; final route = MARKETING.
This example is illustrative. The actual claim still requires the component policy category to be resolved.

## 10. Implementation architecture target

Prefer one server-side composition/enrichment layer rather than many independent frontend queries.
Target conceptual RPC/service: resolve_claim_context(...).
Inputs may include serial, model, indent, WO, source customer, and sales date.
Output should compose machine identity, AX WO, resolved customer, resolved branch, dealer, part identity, provenance, confidence, and warranty inputs / assessment references.
The frontend should render normalized context and should not implement a second independent warranty-policy engine.

## 11. Non-negotiable engineering rules

Preserve source values; enrichment should add normalized values, not silently erase provenance.
Do not invent machine/customer/branch relationships.
Do not make UI a second warranty engine.
Do not use a single generic warranty flag when SDLG and Marketing can differ.
Do not call a claim final-eligible when component classification is unresolved.
Keep current workflow/status separate from warranty eligibility and historical milestones.
Any change to these rules requires an explicit business-rule change and regression verification.

## 2026-09-23 Component Classification Gate
For exact part numbers that are not explicitly named in the SDLG category list, the resolver may use a controlled manual-approval taxonomy mapping. The current production example is **SLG-4120016088001 / Sealing Kit Center Passage → Excavator / Other parts**, recorded as `MANUAL_APPROVAL` with HIGH classification confidence. This is an application classification for routing; it must not be presented as an official SDLG policy label.
