#!/usr/bin/env bash
# Ensure modules/supabase-client.js is the only module that calls createClient(
set -euo pipefail
ROOT="${1:-.}"
fail() { echo "MODULE CONTRACT FAIL: $*"; exit 1; }
ok() { echo "MODULE CONTRACT OK: $*"; }

test -f "$ROOT/modules/supabase-client.js" || fail "missing supabase-client.js"

shopt -s nullglob
for f in "$ROOT"/modules/*.js; do
  base=$(basename "$f")
  if [[ "$base" == "supabase-client.js" ]]; then
    continue
  fi
  if grep -q 'createClient(' "$f"; then
    fail "createClient( found in $f — only supabase-client.js may create clients"
  fi
done

ok "no createClient outside supabase-client.js"
echo "Module createClient contract passed"
