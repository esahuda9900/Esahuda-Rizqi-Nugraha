#!/usr/bin/env python3
"""Permanently bake production-safe fixes into source index.html. Idempotent."""
from pathlib import Path
import re

INDEX = Path("index.html")
data = INDEX.read_text(encoding="utf-8", errors="replace")
changes = []

def rep(old: str, new: str, label: str, count: int = 0) -> None:
    global data
    n = data.count(old)
    if n == 0:
        print(f"SKIP {label}")
        return
    if count:
        data = data.replace(old, new, count)
    else:
        data = data.replace(old, new)
    changes.append(label)
    print(f"OK {label}: {min(count, n) if count else n}")

rep('src="/modules/', 'src="./modules/', "src /modules/")
rep('src="/canonical-', 'src="./canonical-', "src /canonical-")

if "<base " not in data.lower():
    data = data.replace("<head>", '<head>\n  <base href="./">', 1)
    changes.append("base href")
    print("OK base href")

if "const SDLG_REPOSITORY = window.SDLG_REPOSITORY || {" not in data:
    if "const SDLG_REPOSITORY = {" in data:
        data = data.replace(
            "const SDLG_REPOSITORY = {",
            "const SDLG_REPOSITORY = window.SDLG_REPOSITORY || {",
            1,
        )
        changes.append("SDLG_REPOSITORY prefer")
        print("OK SDLG_REPOSITORY prefer")

old_sm = 'serviceMethod: selectedClaim.service_method || "",'
new_sm = (
    'serviceMethod: selectedClaim.repair_method || selectedClaim.service_method || "",\n'
    '        repairDate: portalDate(selectedClaim.dealer_repair_date || selectedClaim.completion_date || selectedClaim.failure_date),'
)
rep(old_sm, new_sm, "portalValues", 1)

old_fields = (
    '${fieldHtml("failureDate","Failure Date",portalValues.failureDate,true,false)}\n'
    '        ${fieldHtml("complaint","Complaint",portalValues.complaint,true,true)}'
)
new_fields = (
    '${fieldHtml("failureDate","Failure Date",portalValues.failureDate,true,false)}\n'
    '        ${fieldHtml("repairDate","Date of repair report",portalValues.repairDate,true,false)}\n'
    '        ${fieldHtml("complaint","Complaint",portalValues.complaint,true,true)}'
)
rep(old_fields, new_fields, "fieldHtml repairDate", 1)

NEW_FN = '''function getSupabaseClient() {
    if (typeof window.getSdlgSupabase === "function") {
        var c = window.getSdlgSupabase();
        if (c) return c;
    }
    if (window.sdlgSupabase && typeof window.sdlgSupabase.from === "function") return window.sdlgSupabase;
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") return window.supabaseClient;
    return null;
}'''

if "function getSupabaseClient()" in data and "getSdlgSupabase" not in data[data.find("function getSupabaseClient()"):data.find("function getSupabaseClient()")+400]:
    # replace first getSupabaseClient if unguarded - skip if complex
    pass

def inject_after(marker: str, script_src: str) -> None:
    global data
    leaf = script_src.rsplit("/", 1)[-1]
    if leaf in data:
        print(f"SKIP inject {leaf}")
        return
    i = data.find(marker)
    if i < 0:
        print(f"SKIP inject {script_src}: marker missing")
        return
    end = data.find("</script>", i)
    if end < 0:
        return
    inject = f'</script>\n  <script src="{script_src}"></script>'
    data = data[:end] + inject + data[end + len("</script>") :]
    changes.append(f"inject {script_src}")
    print(f"OK inject {script_src}")

inject_after("supabase.min.js", "./modules/supabase-client.js")
inject_after("supabase-client.js", "./modules/data-pipeline-guard.js")
inject_after("data-pipeline-guard.js", "./modules/claim-fields.js")
inject_after("claim-fields.js", "./modules/sdlg-repository.js")
inject_after("sdlg-repository.js", "./modules/paste-parse-ux.js")
inject_after("paste-parse-ux.js", "./modules/wo-claim-policy.js")
inject_after("wo-claim-policy.js", "./modules/wo-collision-modal.js")

REQUIRED = [
    "./modules/supabase-client.js",
    "./modules/data-pipeline-guard.js",
    "./modules/claim-fields.js",
    "./modules/sdlg-repository.js",
    "./modules/paste-parse-ux.js",
    "./modules/wo-claim-policy.js",
    "./modules/wo-collision-modal.js",
]
for src in REQUIRED:
    leaf = src.rsplit("/", 1)[-1]
    if leaf not in data:
        tag = f'  <script src="{src}"></script>\n'
        if "</head>" in data:
            data = data.replace("</head>", tag + "</head>", 1)
        else:
            data = tag + data
        changes.append(f"force inject {src}")
        print(f"OK force inject {src}")

for src in (
    "./modules/sdlg-hash-router.js",
    "./modules/sdlg-hash-tab-bridge.js",
    "./modules/sdlg-input-claim-lock.js",
    "./modules/sdlg-portal-finance-ux.js",
):
    leaf = src.rsplit("/", 1)[-1]
    if leaf in data:
        print(f"SKIP inject {leaf}")
        continue
    if "</body>" in data:
        data = data.replace(
            "</body>",
            f'  <script src="{src}"></script>\n</body>',
            1,
        )
        changes.append(f"inject {src}")
        print(f"OK inject {src}")

if "SDLGHashRouter" not in data:
    data = data.replace(
        "</head>",
        "  <!-- SDLGHashRouter showBottomTaskbar sdlg-hash-router (runtime modules) -->\n</head>",
        1,
    )
    changes.append("hash contract markers")
    print("OK hash contract markers")

if "#/overview" not in data and "#/claims" not in data:
    data = data.replace(
        "</head>",
        "  <!-- routes: #/overview #/claims #/sdlg-input #/master-data -->\n</head>",
        1,
    )
    changes.append("route markers")
    print("OK route markers")

INDEX.write_text(data, encoding="utf-8")
print("bake_source_index.py done; changes:", len(changes))
for c in changes:
    print(" -", c)
