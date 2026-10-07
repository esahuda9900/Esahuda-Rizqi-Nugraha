# SDLG Warranty Claim Web App — Data Dictionary Baseline

## Identity fields

| Field | Meaning | Rule |
|---|---|---|
| `claim_id` | Canonical internal/SDLG claim identifier | Format `NNNN-YYYY-SDLG-PFR`; authoritative for claim identity and year attribution |
| `distributor_no` | Distributor-side claim number | Must equal `claim_id` exactly |
| `unit_no` / `serial_no` | Machine/unit identity | Must remain consistent with source AX/customer records |
| `customer` | Customer name | Operational claim/customer reference |
| `branch_id` | Owning branch | Used by Branch User RLS |

## Workflow fields

| Field | Meaning | Rule |
|---|---|---|
| `dealer_claim_no` | Claim number submitted to SDLG principal | Blank = not yet submitted |
| `claim_date` | Dealer claim submission/claim date | Do not use this to override Claim ID year |
| `repair_date` | Repair start/completion context from source process | Used with completion-date validation |
| `completion_date` | Mechanic finished repair | Must be after Repair Date and before Dealer Claim Date |
| `status` | Operational claim state | Must not replace detailed action owner/history model |

## Customer / unit reconciliation

These are separate contexts and must not be silently collapsed:

| Context | Canonical role |
|---|---|
| `claims.customer` | Customer explicitly stated by the warranty claim source |
| `machines.customer_id` | Customer attached to the unit master / AX identity chain |
| `claims.source_provenance.customer` | Evidence of the source customer plus resolution metadata |

A difference between claim customer and machine-master customer is a **reconciliation signal**, not an automatic parse error. Save is blocked only when documented evidence shows a true identity conflict. The application must preserve the source customer and machine-master relationship independently.
## Warranty-resolution fields

The canonical resolver/view may expose fields including:

- `product_family`
- `model_scope`
- `component_category`
- `component_category_source`
- `component_category_confidence`
- `component_identity`
- `component_identity_source`
- `component_identity_confidence`
- `warranty_tier_used`
- `contract_customer_effective`
- `contract_resolution_source`
- `commencement_basis`
- `commencement_date`
- `bill_of_lading_date`
- `machine_status`
- `machine_reason`
- `component_status`
- `component_reason`
- `overall_status`
- `overall_reason`
- `component_rule`
- `machine_policies`
- `evidence_summary`
- `resolution`

These fields are resolution outputs. The canonical resolver remains the authority for warranty decision logic.

## Financial fields

- Company repair/cost values originate from operational WO/AX data.
- SDLG settlement/payout is preferably represented in CNY.
- IDR may be used for company-side comparisons where required.
- USD is not the preferred SDLG payout currency.

## Data quality principles

- Preserve numeric zero as a valid value when the source explicitly contains zero.
- Distinguish blank/null from zero.
- Avoid silently converting unknown values into valid-looking defaults.
- Do not duplicate canonical identifiers into conflicting derived fields.
- Validate date ordering at input and before export/submission.

## Source hierarchy

When values conflict, the application should use the documented source of truth for that field rather than silently choosing whichever value is easiest to parse. Any reconciliation rule must be documented before implementation.


## SDLG Policy Part Master

sdlg_policy_part_master is the authoritative classification layer for the failed part used by the warranty resolver.

| Field | Meaning | Rule |
|---|---|---|
| part_no | Exact SDLG part number | Primary lookup key; normalized with trim/case-insensitive comparison |
| product_family | Applicable machine family | Must match the unit policy family where a family-specific row exists |
| machine_coverage_class | High-level policy classification | KEY_COMPONENT, OTHER_WARRANTABLE_PART, CONSUMABLE_NOT_COVERED, SPECIAL_POLICY, or UNKNOWN_REQUIRES_REVIEW |
| component_category | Policy rule category | Maps to the matching row in service_policy_warranty_rules; null for excluded/review-only items |
| policy_variant | Special policy branch | Used where the official policy has family-specific variants such as electric systems or special 12M/unlimited-hour options |
| manufacturer_scope | Manufacturer qualifier | Used when a policy depends on component manufacturer, e.g. Chinese-brand main pump/valve |
| classification_basis | Why the classification exists | Must identify the policy/source basis; not a free-form UI label |
| source_document_id | Source policy document | References the stored 2026 Service Policy |
| source_section | Policy section | Records the section supporting the classification |
| confidence | Classification confidence | HIGH, MEDIUM_HIGH, MEDIUM, or LOW |
| review_required | Human review gate | true means the classification cannot safely drive an automatic final route |
| review_reason | Explanation for review | Required when review_required=true |

### Component-resolution hierarchy

The resolver uses this order for component classification:

claims.policy_component_category -> machines.policy_component_category -> exact sdlg_policy_part_master -> UNKNOWN

Narrative fields such as fault_description, cause_analyze, repair_method, and comment are supporting context only. They must not independently determine Key/Other/Consumable classification.

## Warranty clock fields

| Field | Meaning | Rule |
|---|---|---|
| warranty_phase | Claim timing phase | PRE_SALE_YARD, SOLD_COMMERCIAL, or DATE_ANOMALY_PRE_BILL_OF_LADING |
| date_anomaly | Failure occurred before B/L | true requires unit-history review before routing |
| sales_date | Commercial sale date used by warranty clock | Prefer unit master sale date, then claim sale date |
| bill_of_lading_date | Factory shipment reference | Used for the policy maximum/stock clock |
| expiry_basis | Which clock expires first | SALES_DATE_FIRST, B_L_FIRST, SALES_AND_B_L_SAME, SALES_DATE_ONLY, or B_L_STOCK_FALLBACK |
| effective_expiry_date | Earliest applicable calendar expiry | Minimum of the applicable Sales and B/L expiry dates |

A unit with no Sales Date but with B/L remains assessable as PRE_SALE_YARD once the failed part has a conclusive policy class. A failure before the B/L date is an anomaly, not an automatic warranty approval.

## Warranty rule metadata

service_policy_warranty_rules now contains explicit B/L metadata:

- bl_cap_mode: FIXED_MONTHS or WARRANTY_MONTHS_PLUS_EXTENSION
- bl_cap_months: explicit B/L maximum where the policy states a fixed ceiling
- bl_extension_months: extension used only for rules explicitly modeled that way
- special_warranty_options: machine-readable special options such as 12 months with unlimited operating hours and a service-file requirement

Do not hardcode a universal warranty_months + 6 formula. The 2026 Service Policy has family/component-specific B/L ceilings and special exceptions.

## Machine warranty vs claim eligibility

machine_status describes the unit across its applicable policy categories and may be MIXED_POLICY.

component_status describes the actual failed component after exact-part classification.

overall_status and final_route are claim-level outputs. They must not be inferred from the machine-level status alone.

## Replacement-part warranty boundary

The replacement-part warranty rules in Service Policy §2.1.11 are a separate policy domain from original-machine warranty eligibility. Do not use replacement-part classes A/B/C/D as a substitute for the machine warranty component_coverage_class without an explicit policy mapping.


## SDLG part policy classification

The authoritative machine-warranty classification is stored in public.sdlg_policy_part_master and is resolved from the exact failed part number (claims.causing_part_no). Narrative fields such as fault description, cause analysis, repair method, and comments are supporting context only and must not decide the warranty category.

| Field | Meaning |
|---|---|
| machine_coverage_class | KEY_COMPONENT, OTHER_WARRANTABLE_PART, CONSUMABLE_NOT_COVERED, SPECIAL_POLICY, or UNKNOWN_REQUIRES_REVIEW |
| component_category | Policy rule category used by the warranty matrix, when applicable |
| policy_variant | Special policy discriminator such as breaker, wear-review, electric component, or rubber/sealing consumable |
| manufacturer_scope | Manufacturer restriction where the policy has a manufacturer-specific rule |
| classification_basis | Evidence basis for the part classification |
| source_section | Source section in the stored 2026 Service Policy |
| confidence | Classification confidence |
| review_required | Whether the part needs human policy verification before final routing |
| review_reason | Explanation for a required review |

The part-policy master is authoritative for machine-warranty classification. Generic entries in sdlg_policy_component_taxonomy are helper vocabulary and are not a decision source for active claim classification.

## Warranty clocks and phase

Warranty resolution keeps the commercial Sales Date clock and the B/L stock ceiling as separate clocks.

| Output | Meaning |
|---|---|
| warranty_phase | PRE_SALE_YARD, SOLD_COMMERCIAL, or DATE_ANOMALY_PRE_BILL_OF_LADING |
| sales_date | Sales Date used for the commercial warranty clock |
| after_sales_expiry_date | Expiry derived from Sales Date and the applicable policy duration |
| bill_of_lading_date | B/L date used for the stock/B/L ceiling |
| after_departure_expiry_date | Expiry derived from the B/L ceiling rule |
| effective_expiry_date | Earlier applicable Sales/B/L expiry |
| expiry_basis | Identifies which clock expires first: SALES_DATE_FIRST, B_L_FIRST, SALES_AND_B_L_SAME, SALES_DATE_ONLY, or B_L_STOCK_FALLBACK |
| date_anomaly | True when Failure Date is before B/L Date; routing remains review-required |
| machine_status | Unit-level policy status, which can be MIXED_POLICY |
| component_status | Status of the actual failed component under its resolved policy class |
| final_route | Claim routing result after component classification, clocks, HM, and anomaly/review checks |

When Sales Date is missing but B/L exists, the claim can be assessed as PRE_SALE_YARD using the B/L stock clock. A failure before the B/L date is not treated as a normal yard failure and requires unit-history verification.

## Contract compatibility rule

For the current application policy, a unit with B/L before 2026-01-01 is treated as effective Contract Customer coverage unless an explicit machine-level contract flag already establishes the same outcome. This is an application compatibility/continuity rule and is recorded separately from the source document wording.

## Special warranty policy

Some 2026 Service Policy categories do not use the normal machine Key/Other formula. Examples include Chinese-brand excavator main pump/valve rules, Electric Loader components, Qingzhou Loader, special 12-month/unlimited-hour options, and breaker warranty. These are represented as policy data rather than inferred from free-text notes. Replacement-part warranty under §2.1.11 is a separate policy domain from complete-machine warranty.
