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

# SDLG Input DOM writers are disabled; React render owns the form fields.
if grep -qE "loadScript\\(['\"]\\./modules/sdlg-input-hydrate|loadScript\\(['\"]\\./modules/sdlg-inline-enforcer" "$ROOT/modules/claim-fields.js"; then
  fail "claim-fields.js must not load legacy DOM-writer modules"
fi
if grep -Eq 'setInterval\(|querySelectorAll\(|function forceSet|\.value[[:space:]]*=' "$ROOT/modules/sdlg-input-hydrate.js"; then
  fail "sdlg-input-hydrate.js still mutates form DOM or runs a timer"
fi
if grep -Eq 'setInterval\(|querySelectorAll\(|function forceFromLive|\.value[[:space:]]*=' "$ROOT/modules/sdlg-inline-enforcer.js"; then
  fail "sdlg-inline-enforcer.js still mutates form DOM or runs a timer"
fi
ok "legacy SDLG Input DOM writers are disabled"
