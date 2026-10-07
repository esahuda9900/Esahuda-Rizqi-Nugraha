# SDLG Warranty Claim Web App — Regression Test Baseline

These checks define behavior that must remain intact after any fix. A release is not considered stable if a previously passing critical case regresses.

## P0 — mandatory smoke checks

1. App loads without JavaScript syntax/runtime fatal error.
2. Login/session works for an authenticated user.
3. Dashboard loads claims without permission errors.
4. Claim detail opens and displays the selected claim.
5. Claims can be created/updated according to the established role policy.
6. Warranty resolver can evaluate a claim through the canonical RPC.
7. Export produces a file with the expected claim rows/fields and does not mutate source data.
8. Logout works and protected data is no longer accessible through the active session.

## Golden warranty case

### `0231-2026-SDLG-PFR`

The canonical RPC contract currently returns:
- `overall_status = ELIGIBLE`
- `machine_status = IN_WARRANTY`
- `component_status = IN_WARRANTY`
- `warranty_tier_used = Contract Customer`
- `contract_customer_effective = true`
- `component_identity = Fuel Tank`
- `component_category = Other parts`
- component rule: `18 months / 3000 hours`

The user-facing application may map/render these canonical results as `IN WARRANTY` / `PASS`, but the raw RPC contract must remain stable unless an explicit business-rule change is approved.

The executable golden verifier is `scripts/verify-warranty-contract.js`.

## Data integrity checks

- Claim ID and Distributor No remain identical.
- Claim ID year remains the authoritative year for year attribution.
- Blank Dealer Claim No continues to mean not yet submitted to SDLG.
- Completion Date ordering remains valid: Repair Date < Completion Date < Dealer Claim Date.
- Zero is preserved as a legitimate numeric value where business data says zero; blank/null must not be silently converted to zero.
- CNY remains the preferred SDLG payout currency.

## Security checks

- Unauthenticated browser requests cannot read protected claim data.
- Viewer cannot perform write operations.
- Branch User cannot read another branch's claims through the client API.
- Warranty/Admin users retain required claim access.
- Views/RPCs exposed to authenticated clients remain intentionally permissioned.

## Regression discipline

For every code or database change:

```text
1. Reproduce the bug.
2. Record the root cause.
3. Apply the smallest isolated fix.
4. Run syntax/build checks.
5. Run the affected P0/P1 regression checks.
6. Deploy Preview before Production when feasible.
7. Verify Production after release.
8. Record the commit and outcome.
```

## Automation status

- Production verifier: active in `scripts/build-production.js`.
- Warranty golden contract verifier: executable and fail-closed when Supabase credentials are supplied; otherwise the build reports a skipped warning rather than blocking due to missing test credentials.
- Direct database verification was run against `0231-2026-SDLG-PFR` and matched the canonical contract above.
- Full browser-level CRUD/export/logout automation remains the next regression layer; it should be added without changing business behavior.
