# SDLG Warranty Claim Web App — Business Rules

This document is the business source of truth captured from the established project requirements. Code may implement these rules but must not redefine them silently.

## Claim identity
- Claim ID format: `NNNN-YYYY-SDLG-PFR` (example: `0231-2026-SDLG-PFR`).
- Distributor No must equal Claim ID exactly.
- Claim IDs for a year are sequential.
- Year attribution follows the Claim ID year, not Claim Date year.
- Records without a claim date are treated as 2026 for current monitoring unless the Claim ID establishes another year.

## Claim submission state
- **Dealer Claim No is the principal submission identity** (same role as “submission no” in day-to-day ops).
- Dealer Claim No blank means the claim has **not** yet been claimed/submitted to the SDLG principal.
- Field `sdlg_submission_no` is optional/legacy; effective reference used in ops views:
  - `submission_ref = COALESCE(sdlg_submission_no, dealer_claim_no)`
- Do not treat empty `sdlg_submission_no` alone as “not submitted” when `dealer_claim_no` is present.
- The application should derive/display submission status from these fields rather than letting duplicated manual statuses drift.

## Work order / repair dates
- Work Order (WO) is the internal AX reference created by mechanic/branch for warranty repair.
- Completion Date represents mechanic repair completion.
- Completion Date must be after Repair Date and before Dealer Claim Date.
- Missing WO/report information can block submission and should expose a useful reason/next action.
- **Date of repair report** on the SDLG Dealer Portal maps from Repair Date (fallback Completion Date). See `docs/SDLG_DEALER_PORTAL_MAPPING.md`.

## Warranty eligibility
Warranty eligibility must be evaluated before the claim is treated as claimable. The canonical engine is `sdlg_warranty_resolve_claim(claim_id)`.

The UI should display the resolver outcome using canonical fields. `IN_WARRANTY` is displayed to users as `IN WARRANTY`.

Important established test case:
- Claim: `0231-2026-SDLG-PFR`
- Expected overall: `PASS / IN WARRANTY`
- Customer type: Contract Customer
- Component: Fuel Tank
- Category: Other parts
- Term: 18 months / 3000 hours

## Actual operational warranty workflow (source of truth)

This is the real end-to-end process the product must track. UI, status labels, next-action copy, and tracking panels must stay aligned with this flow. Do not invent shortcuts that skip handoffs.

1. **Customer reports unit damage to Branch.**
2. **Branch inspects**, creates **Marketing WO**, prepares damage report, and sends it to **Technical Support**.
3. **Technical Support** checks unit warranty + failure warranty eligibility.
   - **Not covered** → reject and inform Branch (with clear reason).
   - **Covered** → issue **Warranty Approval Code**.
4. **Branch** creates **Warranty WO** and replaces the failed part.
5. **Branch** sends **Warranty Replacement Report** to Technical Support.
6. **Technical Support** reviews the replacement report.
   - **Incorrect** → return to Branch for revision (loop).
   - **Correct** → forward to **Warranty Admin**.
7. **Warranty Admin** submits the claim to **SDLG** using the correct Warranty WO.
8. **SDLG** reviews the claim:
   - Outcome: **Approved** / **Rejected**
   - Separately track **Yes to Settlement** / **No to Settlement**
9. **Yes to Settlement** → Warranty Admin sends the claim list/details to SDLG for payment verification.
10. **Rejected claims** must contain a clear rejection reason and supporting evidence for data reconciliation / dispute.
11. **SDLG sends agreement** → signed by authorized management → **Finance** prepares invoice → claim to SDLG.
12. **SDLG pays** → claim closed.

### Condensed monitoring view (for dashboards / status track)
For dense UI, the same process may be summarized as stages without losing meaning:

1. Branch intake / Marketing WO  
2. TS eligibility + Approval Code (or reject + reason)  
3. Warranty WO + part replacement  
4. Replacement report → TS review (loop)  
5. Admin submit to SDLG  
6. SDLG decision + Settlement flag → agreement / invoice / payment / close  

### Ownership & handoff rules
- Every claim must always answer: **Current Owner → Current Stage → What Happened → Why Blocked → Next Action → Evidence → Handoff**.
- Branch ↔ Technical Support handoffs (steps 2–6) are the highest-friction loops; UI must make “returned for revision” obvious.
- Rejection without reason/evidence is incomplete data.
- Settlement flag is **independent** from Approved/Rejected decision and must be trackable separately.

## SDLG Dealer Portal alignment (step 7)

When submitting to SDLG, the live Dynamics **Warranty Claim Form** field set is defined in:

**`docs/SDLG_DEALER_PORTAL_MAPPING.md`** (updated 2026-10 after SDLG system change).

Key portal additions operators must handle:
- **Date of repair report** (required)
- **Logistics Backfill Document** (No/Yes)
- **Service Method**: Onsite Repair | Workshop Repair | Remote Guidance
- **Service Node** timestamps (portal-side; do not invent in our DB)

Our SDLG Input Helper is copy/paste assist only — never auto-posts to the portal.

## Warranty workflow (legacy short form — still valid summary)
1. Technical Support / Branch prepares technical evidence and repair information.
2. Warranty Admin checks completeness and eligibility.
3. Claim is submitted to SDLG (**Dealer Claim No** is the submission reference).
4. SDLG audits the claim and can approve/reject.
5. Rejected claims require reason tracking, follow-up, and evidence/argument history.
6. Approved claims proceed to settlement/payment.
7. Finance processes billing/invoice flow as applicable.
8. Final rebalancing compares company repair cost from WO versus SDLG payout received.

## Monitoring requirements
The system must answer:
- Where is this claim now?
- Who owns the next action?
- What is the next action?
- How long has it been waiting?
- What milestone/history has already happened?
- Why is it blocked, rejected, or aging?
- What is the submission reference (Dealer Claim No)?

Current action/status and historical milestones must not be conflated.

## Financial convention
- CNY is the preferred SDLG settlement/payout currency.
- IDR may be stored/displayed where required for company-side cost comparison.
- USD is not the preferred business currency for SDLG payout reporting.

## Data sources
The operational source chain includes AX (WO/PFR/BN/PO/quotation/invoice), branch/technical evidence, SDLG principal claim/audit/settlement information, and the application's normalized Supabase records.

## Change rule
Any new feature or fix that changes one of these rules requires an explicit business-rule change, not an accidental behavior change caused by UI/build/database patches.
