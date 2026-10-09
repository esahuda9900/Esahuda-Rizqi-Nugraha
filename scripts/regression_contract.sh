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

grep -qE 'portalValues.repairDate|Date of repair report' "$HTML" || fail "missing repairDate mapping"
ok "has repairDate mapping"

if grep -qE 'src="/modules/|src="/canonical-|src="/styles/' "$HTML"; then
  fail "absolute root path src=/modules|/canonical|/styles found"
fi
ok "no absolute module paths"

if grep -q 'serviceMethod: selectedClaim.service_method || ""' "$HTML"; then
  fail "old service_method-only portal mapping returned"
fi
ok "portal mapping not regressed"

# --- createClient discipline (index.html only; modules checked separately) ---
# Every createClient( must have getSdlgSupabase in the preceding ~1200 chars
# (i.e. only allowed as fallback inside getSupabaseClient after singleton check).
python3 - "$HTML" <<'PY'
import sys
from pathlib import Path
html = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
idx = 0
n = 0
bad = []
while True:
    i = html.find("createClient(", idx)
    if i < 0:
        break
    n += 1
    window = html[max(0, i - 1200) : i]
    if "getSdlgSupabase" not in window:
        # show a short snippet for the log
        snip = html[max(0, i - 40) : i + 40].replace("\n", " ")
        bad.append(snip)
    idx = i + 12
if n > 3:
    print(f"CONTRACT FAIL: too many createClient( in index.html: {n} (max 3)")
    sys.exit(1)
if bad:
    print("CONTRACT FAIL: createClient( without nearby getSdlgSupabase (dual-client risk):")
    for b in bad:
        print("  ...", b, "...")
    sys.exit(1)
print(f"CONTRACT OK: createClient( count={n}, all guarded by getSdlgSupabase")
PY

echo "All regression contracts passed for $HTML"
