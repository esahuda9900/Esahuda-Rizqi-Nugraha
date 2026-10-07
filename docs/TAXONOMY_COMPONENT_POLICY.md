# Component taxonomy ↔ 2026 Service Policy

Source of truth for Key vs Other classification used by `sdlg_warranty_resolve_claim`.

## Resolution order (RPC)
1. `claims.policy_component_category`
2. `machines.policy_component_category`
3. Historical claims (same part no, single category)
4. Parts master identity
5. `sdlg_policy_component_taxonomy` (substring match, `priority ASC`, first category wins)

## Loader Key components (§2.1.1)
Engine, torque converter, transmission, axle, front frame, rear frame, boom, swing arm, structural components.

**Excluded from critical (Note 3 → Other parts):**
engine starter, alternator, air compressor, water pump, muffler, fan, fuel injection pump, unit pump, injector.

## Loader Other (explicit)
- Brake / pneumatic cylinder / brake system (incl. part `SLG-4120009227`)
- Common wearables: hose, seal, filter, sensor, switch, relay, harness
- Generic `Cylinder` (loader hydraulic actuators are not on the Key list)

## B/L cap (agreed system rule)
`bill_of_lading_cap_months = warranty_months + 6`  
`effective_expiry = min(commencement + months, B/L + cap)`

Matches policy Note 4 for loaders: critical max 30 months from B/L; other max 24 months from B/L when standard terms are 24 / 18 months.

## Example: VLGL953HCS0620640 / claim 0242-2026-SDLG-PFR
- Category: **Other parts** (manual part override + brake/pneumatic terms)
- Tier: Contract Customer via B/L continuity (B/L < 2026-01-01)
- SDLG OOW: **2027-10-20** (18 months / 2000 HM, whichever first)
- Route: SDLG / ELIGIBLE (failure still inside window)
