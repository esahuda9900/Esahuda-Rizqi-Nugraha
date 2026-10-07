#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-.}"
FAIL=0
echo "=== F2 Secrets Scan ==="
PATTERNS=('service_role' 'supabase_service' 'SUPABASE_SERVICE_ROLE' 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}' 'AIza[0-9A-Za-z_-]{30,}' 'sk-[A-Za-z0-9]{20,}' 'BEGIN RSA PRIVATE KEY')
SCAN_PATHS=("$ROOT/index.html" "$ROOT/modules" "$ROOT/scripts" "$ROOT/canonical-warranty-helper.js" "$ROOT/.github")
for pat in "${PATTERNS[@]}"; do
  for path in "${SCAN_PATHS[@]}"; do
    if [[ -e "$path" ]]; then
      if grep -RInE --exclude-dir=node_modules --exclude-dir=.git --exclude='scan-secrets.sh' -e "$pat" "$path" 2>/dev/null; then
        echo "FAIL: $pat in $path"
        FAIL=1
      fi
    fi
  done
done
if [[ $FAIL -eq 1 ]]; then echo "=== FAILED ==="; exit 1; fi
echo "=== PASSED ==="
exit 0
