#!/usr/bin/env bash
# SDLG regression contract — fail deploy if known-bad patterns return.
# Usage: bash scripts/regression_contract.sh _site/index.html
set -euo pipefail
HTML="${1:?path to index.html required}"
test -s "$HTML"

fail() { echo "CONTRACT FAIL: $*"; exit 1; }
ok() { echo "CONTRACT OK: $*"; }

# Required strings (must exist)
for needle in \
  'getSdlgSupabase' \
  'supabase-client.js' \
  'data-pipeline-guard.js' \
  'claim-fields.js' \
  'sdlg-repository.js' \
  'paste-parse-ux.js' \
  'wo-claim-policy.js' \
  'wo-collision-modal.js' \
  'selectedClaim.repair_method' \
  'window.SDLG_REPOSITORY ||'
do
  grep -q "$needle" "$HTML" || fail "missing required: $needle"
  ok "has $needle"
done

# repairDate either in portalValues or field label
grep -qE 'portalValues.repairDate|Date of repair report' "$HTML" || fail "missing repairDate mapping"
ok "has repairDate mapping"

# Forbidden absolute paths (GitHub Project Pages break)
if grep -qE 'src="/modules/|src="/canonical-|src="/styles/' "$HTML"; then
  fail "absolute root path src=/modules|/canonical|/styles found"
fi
ok "no absolute module paths"

# Forbidden old portal mapping
if grep -q 'serviceMethod: selectedClaim.service_method || ""' "$HTML"; then
  fail "old service_method-only portal mapping returned"
fi
ok "portal mapping not regressed"

# createClient only allowed outside raw index inline is hard to enforce fully;
# at least require singleton marker present
grep -q 'getSdlgSupabase' "$HTML" || fail "singleton marker missing"

echo "All regression contracts passed for $HTML"
