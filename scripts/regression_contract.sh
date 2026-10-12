#!/usr/bin/env bash
# SDLG regression contract — fail deploy if known-bad patterns return.
# Usage: bash scripts/regression_contract.sh index.html
set -euo pipefail
HTML="${1:?path to index.html required}"
test -s "$HTML"
ROOT="$(cd "$(dirname "$HTML")" && pwd)"
if [[ "$(basename "$ROOT")" == "_site" ]]; then
  REPO_ROOT="$(dirname "$ROOT")"
else
  REPO_ROOT="$ROOT"
fi

fail() { echo "CONTRACT FAIL: $*"; exit 1; }
ok() { echo "CONTRACT OK: $*"; }
warn() { echo "CONTRACT WARN: $*"; }

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

# Hash routing: string in HTML OR module file present (loaded via claim-fields)
if grep -qE 'SDLGHashRouter|sdlg-hash-router' "$HTML"; then
  ok "has hash router marker in HTML"
elif test -f "$REPO_ROOT/modules/sdlg-hash-router.js"; then
  ok "has modules/sdlg-hash-router.js (loaded at runtime)"
else
  fail "missing hash router (no SDLGHashRouter/sdlg-hash-router in HTML and no modules/sdlg-hash-router.js)"
fi

if grep -q 'showBottomTaskbar' "$HTML"; then
  ok "has showBottomTaskbar"
elif test -f "$REPO_ROOT/modules/sdlg-hash-router.js" && grep -q 'showBottomTaskbar' "$REPO_ROOT/modules/sdlg-hash-router.js"; then
  ok "showBottomTaskbar in sdlg-hash-router.js"
else
  warn "showBottomTaskbar not found (non-fatal if taskbar gated elsewhere)"
fi

grep -qE 'portalValues.repairDate|Date of repair report' "$HTML" || fail "missing repairDate mapping"
ok "has repairDate mapping"

if grep -qE '#/overview|#/claims|#/sdlg-input|#/master-data' "$HTML"; then
  ok "has hierarchical route markers"
elif test -f "$REPO_ROOT/modules/sdlg-hash-router.js"; then
  ok "hierarchical routes via modules/sdlg-hash-router.js (runtime)"
else
  fail "missing hierarchical route markers"
fi

if grep -q 'SDLGRouteFinish\|sdlg-route-finish\|sdlg-route-breadcrumb' "$HTML"; then
  ok "has route-finish enhancements"
else
  warn "route-finish module not baked yet (non-fatal)"
fi

if grep -qE 'src="/modules/|src="/canonical-|src="/styles/' "$HTML"; then
  fail "absolute root path src=/modules|/canonical|/styles found"
fi
ok "no absolute module paths"

if grep -q 'serviceMethod: selectedClaim.service_method || ""' "$HTML"; then
  fail "old service_method-only portal mapping returned"
fi
ok "portal mapping not regressed"

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

if [[ "$(basename "$ROOT")" == "_site" ]]; then
# SDLG Input must use the URL-bound live claim; list rows are never a fallback.
grep -q 'const effectiveClaimId =' "$HTML" || fail "missing URL-bound SDLG claim identity"
grep -q 'sdlg-live-claim-ready' "$HTML" || fail "missing live-claim handoff to field hydration"
grep -q 'modules/claim-fields.js?v=20261012-single-writer-v1' "$HTML" || fail "claim-fields cache-bust marker missing"
if grep -q 'setLiveClaim(fromList)\|liveReady ? fromList : null' "$HTML"; then
  fail "stale list fallback returned in SDLG Input"
fi
if grep -q 'data-sdlg-inline-enforcer-legacy' "$HTML"; then
  fail "legacy inline enforcer still baked into Pages output"
fi
test -f "$REPO_ROOT/modules/claim-fields.js" || fail "missing claim-fields.js"
if grep -q 'sdlg-inline-enforcer\.js' "$REPO_ROOT/modules/claim-fields.js"; then
  fail "duplicate inline enforcer loader returned"
fi
if grep -q 'setInterval' "$REPO_ROOT/modules/sdlg-input-hydrate.js"; then
  fail "polling loop returned to SDLG input hydrator"
fi
if grep -Eq "setVal\\('sdlg_repairDate'|setVal\\('sdlg_machineLocation'|data-sdlg-report-body.*textContent" "$REPO_ROOT/modules/sdlg-input-hydrate.js"; then
  fail "hydrator writes fields owned by React"
fi
ok "URL-bound live claim and single-writer contracts"
else
  warn "baked-output-only SDLG Input checks skipped for source index.html; Pages build runs them on _site/index.html"
fi
echo "All regression contracts passed for $HTML"
