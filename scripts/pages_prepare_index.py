#!/usr/bin/env python3
"""Bootstrap pages_prepare from known-good commit, then force-refresh route-finish v15."""
from pathlib import Path
import re
import urllib.request

GOOD_SHA = "0216d7784cb00fe0436b403df7c97e7692f11f5b"
URL = (
    "https://raw.githubusercontent.com/esahuda9900/Esahuda-Rizqi-Nugraha/"
    + GOOD_SHA
    + "/scripts/pages_prepare_index.py"
)

print("pages_prepare bootstrap: fetching known-good from", GOOD_SHA)
code = urllib.request.urlopen(URL, timeout=45).read().decode("utf-8", "replace")

# Cache-bust route-finish refs to v15
for old in ("20261009-v12", "20261009-v13", "20261009-v14"):
    code = code.replace("sdlg-route-finish.js?v=" + old, "sdlg-route-finish.js?v=20261010-v15")

# Force re-inline of route-finish even if marker already present
old_inline = '''def inline_module(path, marker):
    global data
    if marker in data:
        print("skip inline", marker)
        return'''
new_inline = '''def inline_module(path, marker):
    global data
    force = marker in ("SDLG_ROUTE_FINISH_INLINE_V1",)
    if marker in data and not force:
        print("skip inline", marker)
        return
    if force and marker in data:
        if not path.is_file():
            print("missing module", path)
            return
        body = path.read_text(encoding="utf-8", errors="replace").replace("</script>", "<\\/script>")
        block = "\\n<!-- " + marker + " -->\\n<script>\\n" + body + "\\n</script>\\n"
        data = re.sub(
            r"<!-- " + re.escape(marker) + r" -->\\s*<script>[\\s\\S]*?</script>\\s*",
            block,
            data,
            count=1,
        )
        print("refreshed inline", path.name)
        return'''
if old_inline in code:
    code = code.replace(old_inline, new_inline, 1)
    print("bootstrap: enabled force-refresh for route-finish inline")
else:
    print("bootstrap: WARN could not patch inline_module skip logic")

# Execute the restored prepare script in-process
ns = {"__name__": "__main__", "__file__": str(Path(__file__).resolve())}
exec(compile(code, "pages_prepare_index.py(good)", "exec"), ns, ns)
print("pages_prepare bootstrap done")
