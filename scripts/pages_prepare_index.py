#!/usr/bin/env python3
"""Patch index.html for GitHub Project Pages deploy artifact. Idempotent safety net."""
from pathlib import Path
import re

INDEX = Path("_site/index.html")
data = INDEX.read_text(encoding="utf-8", errors="replace")

for a, b in [
    ('src="/modules/', 'src="./modules/'),
    ("src='/modules/", "src='./modules/"),
    ('src="/canonical-', 'src="./canonical-'),
    ("src='/canonical-", "src='./canonical-"),
    ('src="/styles/', 'src="./styles/'),
    ("src='/styles/", "src='./styles/"),
    ('href="/modules/', 'href="./modules/'),
    ('href="/styles/', 'href="./styles/'),
]:
    data = data.replace(a, b)

if "<base " not in data.lower():
    data = data.replace("<head>", '<head>\n  <base href="./">', 1)

NEW_FN = r'''function getSupabaseClient() {
    if (typeof window.getSdlgSupabase === "function") {
        var c = window.getSdlgSupabase();
        if (c) return c;
    }
    if (window.sdlgSupabase && typeof window.sdlgSupabase.from === "function") return window.sdlgSupabase;
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") return window.supabaseClient;
    if (!window.supabase || typeof window.supabase.createClient !== "function")
        throw new Error("Supabase JS gagal dimuat.");
    var created = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
        db: { retry: false },
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "sb-frqvelcreczmnofldrga-auth-token" },
        global: { headers: { "X-Client-Info": "sdlg-warranty-public-v2.30.7-singleton" } }
    });
    window.sdlgSupabase = created;
    window.supabaseClient = created;
    return created;
}'''

pattern = r"function getSupabaseClient\(\) \{[\s\S]*?\n\}"
m = re.search(pattern, data)
if m and "getSdlgSupabase" not in m.group(0):
    data = data[: m.start()] + NEW_FN + data[m.end() :]
    print("getSupabaseClient rewritten")
else:
    print("getSupabaseClient OK")

if "const SDLG_REPOSITORY = window.SDLG_REPOSITORY" not in data:
    if "const SDLG_REPOSITORY = {" in data:
        data = data.replace(
            "const SDLG_REPOSITORY = {",
            "const SDLG_REPOSITORY = window.SDLG_REPOSITORY || {",
            1,
        )
        print("SDLG_REPOSITORY prefers window module")

old_sm = 'serviceMethod: selectedClaim.service_method || "",'
new_sm = (
    'serviceMethod: selectedClaim.repair_method || selectedClaim.service_method || "",\n'
    '        repairDate: portalDate(selectedClaim.dealer_repair_date || selectedClaim.completion_date || selectedClaim.failure_date),'
)
if old_sm in data:
    data = data.replace(old_sm, new_sm, 1)
    print("portalValues serviceMethod + repairDate")

old_fields = (
    '${fieldHtml("failureDate","Failure Date",portalValues.failureDate,true,false)}\n'
    '        ${fieldHtml("complaint","Complaint",portalValues.complaint,true,true)}'
)
new_fields = (
    '${fieldHtml("failureDate","Failure Date",portalValues.failureDate,true,false)}\n'
    '        ${fieldHtml("repairDate","Date of repair report",portalValues.repairDate,true,false)}\n'
    '        ${fieldHtml("complaint","Complaint",portalValues.complaint,true,true)}'
)
if old_fields in data:
    data = data.replace(old_fields, new_fields, 1)
    print("fieldHtml Date of repair report")

def inject_after(marker: str, script_src: str) -> None:
    global data
    leaf = script_src.rsplit("/", 1)[-1]
    if leaf in data:
        print("skip inject", leaf)
        return
    i = data.find(marker)
    if i < 0:
        print("marker missing for", script_src)
        return
    end = data.find("</script>", i)
    if end < 0:
        return
    inject = '</script>\n  <script src="' + script_src + '"></script>'
    data = data[:end] + inject + data[end + len("</script>") :]
    print("injected", script_src)

inject_after("supabase.min.js", "./modules/supabase-client.js")
inject_after("supabase-client.js", "./modules/data-pipeline-guard.js")
inject_after("data-pipeline-guard.js", "./modules/claim-fields.js")
inject_after("claim-fields.js", "./modules/sdlg-repository.js")
inject_after("sdlg-repository.js", "./modules/paste-parse-ux.js")
inject_after("paste-parse-ux.js", "./modules/wo-claim-policy.js")
inject_after("wo-claim-policy.js", "./modules/wo-collision-modal.js")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare_index.py done")
