#!/usr/bin/env bash
# Ensure modules/supabase-client.js is the only module that calls createClient(
set -euo pipefail
ROOT="${1:-.}"
fail() { echo "MODULE CONTRACT FAIL: $*"; exit 1; }
ok() { echo "MODULE CONTRACT OK: $*"; }

test -f "$ROOT/modules/supabase-client.js" || fail "missing supabase-client.js"

# Any other modules/*.js with createClient is forbidden
while IFS= read -r -d '' f; do
  base=$(basename "$f")
  if [[ "$base" == "supabase-client.js" ]]; then
    continue
  fi
  if grep -q 'createClient(' "$f"; then
    fail "createClient( found in $f — only supabase-client.js may create clients"
  fi
done < <(find "$ROOT/modules" -name '*.js' -print0 2>/dev/null)

ok "no createClient outside supabase-client.js"
echo "Module createClient contract passed"
