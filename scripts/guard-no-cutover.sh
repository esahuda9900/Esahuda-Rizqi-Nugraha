#!/usr/bin/env bash
# Fail if Pages artifact (or proposed site root) looks like SPA cutover of production.
# Usage: bash scripts/guard-no-cutover.sh [_site]
set -euo pipefail

ROOT="${1:-_site}"

if [ ! -d "$ROOT" ]; then
  echo "guard-no-cutover: missing dir $ROOT"
  exit 1
fi

if [ ! -f "$ROOT/index.html" ]; then
  echo "FORBIDDEN: $ROOT/index.html missing — production root must remain legacy index.html"
  exit 1
fi

# SPA-only shell typically has #root and only vite asset tags, no legacy modules.
if grep -q 'id="root"' "$ROOT/index.html" \
  && ! grep -qE 'modules/|canonical-warranty|SDLG' "$ROOT/index.html"; then
  echo "FORBIDDEN CUTOVER: $ROOT/index.html looks like Vite SPA shell, not legacy web"
  exit 1
fi

# Production root must not be a copy of preview dist as the only app
if [ -f "$ROOT/preview/index.html" ]; then
  if cmp -s "$ROOT/index.html" "$ROOT/preview/index.html" 2>/dev/null; then
    echo "FORBIDDEN CUTOVER: root index.html is identical to preview SPA index.html"
    exit 1
  fi
fi

# Must still ship legacy modules next to production index
for f in \
  modules/supabase-client.js \
  modules/paste-parse-ux.js \
  modules/wo-claim-policy.js \
  canonical-warranty-helper.js
do
  if [ ! -s "$ROOT/$f" ]; then
    echo "FORBIDDEN: missing legacy production file $ROOT/$f"
    exit 1
  fi
done

# Optional: env override only for future authorized cutover (still requires script change)
if [ "${OWNER_CUTOVER:-}" = "1" ]; then
  echo "WARNING: OWNER_CUTOVER=1 is set — guard soft-pass only if workflow was intentionally updated."
fi

echo "guard-no-cutover: OK — production root remains legacy web (no cutover)."
