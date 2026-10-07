#!/usr/bin/env bash
# Default DRY-RUN. Only deletes with --execute
set -euo pipefail
OWNER="esahuda9900"
REPO="sdlg-warranty-backup"
KEEP_REGEX='^(main|fix/expert-hardening-20261005|production-verify/latest)$'
EXECUTE=0
[[ "${1:-}" == "--execute" ]] && EXECUTE=1
echo "MODE: $([ $EXECUTE -eq 1 ] && echo EXECUTE || echo DRY-RUN)"
gh api "repos/${OWNER}/${REPO}/branches?per_page=100" --paginate -q '.[].name' > /tmp/sdlg-branches.txt || { echo "gh required"; exit 1; }
while IFS= read -r b; do
  [[ "$b" =~ $KEEP_REGEX ]] && { echo "KEEP $b"; continue; }
  ST=$(gh api "repos/${OWNER}/${REPO}/compare/main...${b}" -q '.status' 2>/dev/null || echo unknown)
  if [[ "$ST" == "identical" || "$ST" == "behind" ]]; then
    echo "CANDIDATE $b ($ST)"
    if [[ $EXECUTE -eq 1 ]]; then
      gh api -X DELETE "repos/${OWNER}/${REPO}/git/refs/heads/${b}" && echo " deleted $b"
    fi
  else
    echo "SKIP $b ($ST)"
  fi
done < /tmp/sdlg-branches.txt
