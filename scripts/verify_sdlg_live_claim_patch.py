#!/usr/bin/env python3
"""Regression-test the generated GitHub Pages SDLG Input patch, including inline JS syntax."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "index.html"
patcher = ROOT / "scripts" / "pages_prepare_index.py"

def fail(message):
    raise SystemExit("SDLG LIVE CLAIM PATCH FAIL: " + message)

with tempfile.TemporaryDirectory(prefix="sdlg-live-claim-") as tmp:
    work = Path(tmp)
    site = work / "_site"
    site.mkdir()
    generated = site / "index.html"
    shutil.copyfile(source, generated)

    result = subprocess.run(
        [sys.executable, str(patcher)],
        cwd=work,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    print(result.stdout, end="")
    if result.returncode:
        fail("pages_prepare_index.py returned non-zero")

    html = generated.read_text(encoding="utf-8", errors="replace")
    required = [
        "function useLiveClaim(claimId, retryToken)",
        "const selectedClaim = live.claim;",
        "data-sdlg-live-loading",
        "data-sdlg-live-error",
        "claim-fields.js?v=20261012-live-only",
        "}, [selectedClaimId, warrantyMatrix, selectedClaim]);",
    ]
    for needle in required:
        if needle not in html:
            fail("generated index is missing " + needle)

    forbidden = [
        "const selectedClaim = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;",
        "selectedClaim = liveClaim || (liveReady ? fromList : null)",
        "setLiveClaim(fromList)",
        "window.SDLGInputHydrate.apply(row)",
    ]
    for needle in forbidden:
        if needle in html:
            fail("forbidden live-claim fallback/writer found: " + needle)

    node_check = r"""
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(process.argv[1], 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
let checked = 0;
while ((match = re.exec(html))) {
  const attrs = match[1] || '';
  const src = /\bsrc\s*=/i.test(attrs);
  const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
  if (src || (type && !/javascript|text\/javascript/i.test(type))) continue;
  const body = match[2] || '';
  if (!body.trim()) continue;
  new vm.Script(body, { filename: 'generated-index:inline-' + (++checked) });
}
console.log('INLINE JS SYNTAX PASS: ' + checked + ' blocks');
"""
    checked = subprocess.run(
        ["node", "-e", node_check, str(generated)],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    print(checked.stdout, end="")
    if checked.returncode:
        fail("generated inline JS failed syntax check")

print("SDLG LIVE CLAIM PATCH PASS")
