#!/usr/bin/env python3
"""Patch index.html for GitHub Project Pages deploy artifact. Idempotent safety net."""
from pathlib import Path
import re

INDEX = Path("_site/index.html")
data = INDEX.read_text(encoding="utf-8")
orig = data
mod = Path("modules")

def inline_module(src_path: Path, marker: str) -> None:
    global data
    if not src_path.is_file():
        return
    body = src_path.read_text(encoding="utf-8")
    # Strip outer IIFE comment noise is fine; keep full file
    block = f"<!-- {marker} -->\n<script>\n{body}\n</script>\n"
    # Replace existing marker block if present
    pat = re.compile(
        rf"<!-- {re.escape(marker)} -->\s*<script>[\s\S]*?</script>\s*",
        re.M,
    )
    if pat.search(data):
        data = pat.sub(block, data, count=1)
    else:
        # inject before </body>
        data = data.replace("</body>", block + "</body>", 1)

# Core modules inlined for GH Pages reliability (no extra round-trips / cache races)
inline_module(mod / "sdlg-hash-router.js", "SDLG_HASH_ROUTER_INLINE_V1")
inline_module(mod / "sdlg-route-finish.js", "SDLG_ROUTE_FINISH_INLINE_V1")
inline_module(mod / "sdlg-core.js", "SDLG_CORE_INLINE_V1")

# Ensure external script refs use cache-busted versions when present as tags
REPLACEMENTS = [
    ("./modules/sdlg-hash-router.js?v=20261009-v20",
     "./modules/sdlg-hash-router.js?v=20261009-v20"),
    ("./modules/sdlg-route-finish.js?v=20261009-v12",
     "./modules/sdlg-route-finish.js?v=20261010-v15"),
    ("./modules/sdlg-route-finish.js?v=20261009-v13",
     "./modules/sdlg-route-finish.js?v=20261010-v15"),
    ("./modules/sdlg-route-finish.js?v=20261009-v14",
     "./modules/sdlg-route-finish.js?v=20261010-v15"),
    ("./modules/sdlg-route-finish.js?v=20261010-v15",
     "./modules/sdlg-route-finish.js?v=20261010-v15"),
]

for old, new in REPLACEMENTS:
    if old in data:
        data = data.replace(old, new)

# Generic: any remaining route-finish without v15
data = re.sub(
    r"./modules/sdlg-route-finish\.js(\?v=[^\"']*)?",
    "./modules/sdlg-route-finish.js?v=20261010-v15",
    data,
)

if data != orig:
    INDEX.write_text(data, encoding="utf-8")
    print("pages_prepare_index.py: patched index.html")
else:
    print("pages_prepare_index.py: no changes")

print("pages_prepare_index.py done")
