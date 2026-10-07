# SDLG Dealer Portal — Field Mapping (post 2026-10 update)

Source of truth for aligning **our SDLG Input Helper** with Microsoft Dynamics 365 Dealer Portal **Warranty Claim Form** + **Replacement Record Details**.

Examples observed: claim `FW2610010002`, replacement `HJ2610010002`.

## Portal navigation

- Service Forms → **Warranty Claim Form**
- From claim → **New Replacement Record Details** / related replacement lines

## Warranty Claim Form — Home fields

| Portal field | Required | Our source | Helper |
|--------------|----------|------------|--------|
| Service Type | * | fixed | `Repair` |
| Service Method | * | | Onsite Repair · Workshop Repair · Remote Guidance |
| Serial number | * | serial | |
| Hour meter | * | `hm_failure` | |
| Whole Machine Warranty | | engine | In Warranty / Out of Warranty |
| Failure Date | * | `failure_date` | DD/MM/YYYY |
| Date of repair report | * | `dealer_repair_date` \|\| `completion_date` | DD/MM/YYYY |
| Feedback Person | * | technician | |
| Feedback Contact Information | * | contact | |
| Complaint | * | `fault_description` | |
| Fault Details | | cause + comment | |
| Machine Location | * | WO + branch + customer | |
| Repair Labor | | `labour_hrs` | |
| Service Mileage | | `mileage_km` | |
| Logistics Backfill Document | | | default No |

## Replacement Record Details (full)

### Part identity

| Portal field | Required | Our source / suggestion | Notes |
|--------------|----------|-------------------------|-------|
| Old Part Material Number | * | failure part **without** `SLG-` | Portal catalog number |
| Old Part Quantity | | part qty | usually 1 |
| Manufacturer | | — | often empty |
| Audit Labor | * | — | **portal-side only** |
| Old Part Material Name | | description; portal catalog may say **Silencer** while claim says Muffler | Prefer portal catalog name when known |
| Is it the Primary Cause Part | * | **Yes** for primary failure line | |
| Is it a claim | * | suggest **Yes** | operator confirms |
| Old Part SN | | from comment/evidence if any | often empty |
| Is Claimed for Compensation | * | **Yes** when warranty claim | |

### Fault Information

| Portal field | Required | Our source / suggestion | Observed example |
|--------------|----------|-------------------------|------------------|
| Fault Description | | `fault_description` | The Engine Sound is Abnormal |
| Fault Cause | * | `cause_analyze` + detail | Muffler broken / welding quality… |
| Fault Handling | * | short handling / repair method | same or shorter than cause |
| **System** | * | Faulty System dropdown (label, not only Z-code) | **Engine System** |
| **Assembly** | * | portal dropdown — helper **suggests** | **Engine Peripherals** (muffler/engine periphery) |
| **Component** | * | portal dropdown — helper suggests part name | **Muffler** |
| **Mode** | * | portal dropdown — helper suggests from text | **Cracking** (broken/crack) |
| **Repair Action** | * | portal dropdown | **Replace** when replace-with-new |
| Standard Man-Hours | | `labour_hrs` as hint | e.g. 1,00 |
| Fault Detail Remarks | | `comment` | optional |

### New part line

| Portal field | Required | Our source |
|--------------|----------|------------|
| New Part Material Number | * | replace part without `SLG-` |
| New Part Material Name | | replace description / catalog |
| New Part SN | | if known |
| Quantity | * | qty |

### New Part Price Information (often portal-calculated)

| Portal field | Notes |
|--------------|-------|
| Original Currency Sales Price | e.g. **CNY** |
| Original Currency Sales Price for Parts | e.g. 446,49 |
| Claim Currency | e.g. **USD** |
| New Part Unit Price | e.g. 66,21 |
| Exchange Rate | e.g. 0,148300 |
| New Part Total Price | qty × unit |

Helper may copy claim unit price / amount when present; exchange rate is portal/finance.

### Faulty System list (dropdown labels)

Engine System · Working Equipment · Chassis and Accessories · Cover System · Cab · Seat · Operation Console · Air Conditioning System · Electrical System · Transmission System · Transmission Control System · Clutch · Drive Axle System · Working Hydraulic System (Mounting, Road) · Steering System · Braking System · Torque Converter System · Quick-change device · Inspection

(Internal codes Z0101–Z0190 may appear in other UIs; form shows **labels**.)

### Suggested heuristics (helper only — operator confirms)

| Signal in claim text / part | System | Assembly (hint) | Component | Mode | Repair Action |
|----------------------------|--------|-----------------|-----------|------|---------------|
| muffler, silencer, engine sound | Engine System | Engine Peripherals | Muffler / Silencer | Cracking / Broken | Replace |
| brake, pneumatic cylinder | Braking System | (portal) | part name | Leakage | Replace |
| hydraulic cylinder (work) | Working Hydraulic… | (portal) | part name | Leakage | Replace |

## Helper product rules

1. Copy/paste assist only — never auto-submit.
2. Do **not** invent Audit Labor, Manufacturer, SN, or exchange rate.
3. Suggest Assembly / Component / Mode / Repair Action only when keyword confidence is high; label as **saran**.
4. Strip `SLG-` from part numbers for portal material numbers.
5. Prefer CNY/USD as stored on claim for currency hints.
6. Align with `BUSINESS_RULES.md` step 7 (Admin → SDLG).

## Change log

- 2026-10-01 — Home + repair report date + logistics + service method.
- 2026-10-01 — Replacement Record + Z-codes.
- 2026-10-01 — Full replacement form: Assembly, Component, Mode, Repair Action, new part name/qty, pricing block; System uses portal **labels**.
