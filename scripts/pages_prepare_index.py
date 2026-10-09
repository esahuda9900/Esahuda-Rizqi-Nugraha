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

def inline_module(path, marker):
    global data
    if marker in data:
        print("skip inline", marker)
        return
    if not path.is_file():
        print("missing module", path)
        return
    body = path.read_text(encoding="utf-8", errors="replace").replace("</script>", "<\\/script>")
    block = "\n<!-- " + marker + " -->\n<script>\n" + body + "\n</script>\n"
    if "</body>" in data:
        data = data.replace("</body>", block + "</body>", 1)
    else:
        data += block
    print("inlined", path.name)

mod = Path("_site/modules") if Path("_site/modules").is_dir() else Path("modules")
inline_module(mod / "sdlg-portal-finance-ux.js", "SDLG_PORTAL_FINANCE_UX_INLINE_V3")
inline_module(mod / "feedback-person-fix.js", "SDLG_FB_PERSON_INLINE_V13")
inline_module(mod / "sdlg-hash-router.js", "SDLG_HASH_ROUTER_INLINE_V1")

if 'esc(unitPrice || "—")' in data:
    data = data.replace(
        'esc(unitPrice || "—")',
        'esc((unitPrice === 0 || unitPrice === "0") ? "0.00" : (unitPrice || "0.00"))',
        1,
    )
    data = data.replace(
        'esc(amount || "—")',
        'esc((amount === 0 || amount === "0") ? "0.00" : (amount || "0.00"))',
        1,
    )
    print("parts money 0.00")

_no_copy = (
    'return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff">'
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">'
    '<label for="${id}" style="font-size:11px;font-weight:800;color:#334155">${esc(label)}${requiredMark}</label>'
    '</div>${control}</div>`;'
)
_with_copy = (
    'return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff">'
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">'
    '<label for="${id}" style="font-size:11px;font-weight:800;color:#334155">${esc(label)}${requiredMark}</label>'
    '<button type="button" data-sdlg-copy data-target="#${id}" style="border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer">Copy</button>'
    '</div>${control}</div>`;'
)
if _no_copy in data:
    data = data.replace(_no_copy, _with_copy, 1)
    print("restored per-field Copy")
elif 'data-sdlg-copy data-target="#${id}"' in data:
    print("per-field Copy present")

for a, b in [
    (
        'fieldHtml("labourAmount","Labour Amount",selectedClaim.labour_amount ?? "",false,false)',
        'fieldHtml("labourAmount","Labour Amount",(selectedClaim.labour_amount == null || selectedClaim.labour_amount === "") ? "0.00" : selectedClaim.labour_amount,false,false)',
    ),
    (
        'fieldHtml("mileageAmount","Mileage Amount",selectedClaim.mileage_amount ?? "",false,false)',
        'fieldHtml("mileageAmount","Mileage Amount",(selectedClaim.mileage_amount == null || selectedClaim.mileage_amount === "") ? "0.00" : selectedClaim.mileage_amount,false,false)',
    ),
    (
        'fieldHtml("otherAmount","Other Amount",selectedClaim.other_amount ?? "",false,false)',
        'fieldHtml("otherAmount","Other Amount",(selectedClaim.other_amount == null || selectedClaim.other_amount === "") ? "0.00" : selectedClaim.other_amount,false,false)',
    ),
    (
        'fieldHtml("totalAmount","Total Amount Claimed",selectedClaim.total_amount ?? "",false,false)',
        'fieldHtml("totalAmount","Total Amount Claimed",(selectedClaim.total_amount == null || selectedClaim.total_amount === "") ? "0.00" : selectedClaim.total_amount,false,false)',
    ),
]:
    if a in data:
        data = data.replace(a, b, 1)
        print("cost field patched")

old_report = (
    '<div style="font-family:monospace;font-size:11px;line-height:1.55;color:#334155;word-break:break-word;'
    'background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:10px">${esc(reportName)}</div>'
)
new_report = (
    '<div data-sdlg-report-body style="font-family:monospace;font-size:11px;line-height:1.55;color:#334155;word-break:break-word;'
    'background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:10px;max-height:3.4em;overflow:hidden">${esc(reportName)}</div>'
    '<button type="button" data-sdlg-report-toggle style="margin-top:6px;border:1px solid #cbd5e1;background:#fff;'
    'border-radius:7px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer">Show more</button>'
)
if old_report in data and "data-sdlg-report-body" not in data:
    data = data.replace(old_report, new_report, 1)
    print("report collapse")

if "data-sdlg-report-toggle" in data and "data-wired" not in data:
    toggle = (
        "\n<script>\n(function(){function wire(){document.querySelectorAll('[data-sdlg-report-toggle]').forEach(function(btn){"
        "if(btn.getAttribute('data-wired'))return;btn.setAttribute('data-wired','1');"
        "btn.addEventListener('click',function(e){e.preventDefault();var body=btn.previousElementSibling;"
        "if(!body||!body.hasAttribute('data-sdlg-report-body'))body=document.querySelector('[data-sdlg-report-body]');"
        "if(!body)return;var open=body.style.maxHeight==='none';body.style.maxHeight=open?'3.4em':'none';"
        "btn.textContent=open?'Show more':'Show less';});});}"
        "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();"
        "setInterval(wire,1500);})();\n</script>\n"
    )
    if "</body>" in data:
        data = data.replace("</body>", toggle + "</body>", 1)
        print("report toggle script")

for _src in [
    "./modules/sdlg-hash-router.js?v=20261009-v1",
    "./modules/sdlg-input-helper-ux.js?v=20261009-v19",
    "./modules/sdlg-portal-ux-v2.js?v=20261009-v22",
    "./modules/sdlg-portal-finance-ux.js?v=20261009-v3",
]:
    leaf = _src.split("/")[-1].split("?")[0]
    tag = '<script src="' + _src + '"></script>\n'
    if leaf in data and _src in data:
        print("skip inject", leaf)
        continue
    if "</body>" in data and f'src="./modules/{leaf}' not in data:
        data = data.replace("</body>", tag + "</body>", 1)
        print("injected", _src)

# Hash routing: fix SDLG Input claim persistence + init
_old_init = 'const [sdlgInputClaimId, setSdlgInputClaimId] = useState("");'
_new_init = (
    'const [sdlgInputClaimId, setSdlgInputClaimId] = useState(() => {'
    ' try {'
    '  if (window.SDLGNavState && typeof window.SDLGNavState.restoreSdlgInputClaimId === "function") {'
    '    var _sid = window.SDLGNavState.restoreSdlgInputClaimId(); if (_sid) return _sid;'
    '  }'
    '  if (window.SDLGHashRouter && typeof window.SDLGHashRouter.claimId === "function") {'
    '    var _hid = window.SDLGHashRouter.claimId(); if (_hid) return _hid;'
    '  }'
    '  var _ls = localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1") || localStorage.getItem("sdlg-warranty:last-claim:v1");'
    '  if (_ls) return String(_ls);'
    ' } catch(_e) {}'
    ' return "";'
    '});'
)
if _old_init in data:
    data = data.replace(_old_init, _new_init, 1)
    print("hash: sdlgInputClaimId init from storage/hash")

_old_sel = 'onSelectClaim: (id) => setSdlgInputClaimId(id)'
_new_sel = (
    'onSelectClaim: (id) => { setSdlgInputClaimId(id);'
    ' try { localStorage.setItem("sdlg-warranty:last-sdlginput-claim:v1", String(id||"")); } catch(_e){}'
    ' try { localStorage.setItem("sdlg-warranty:last-claim:v1", String(id||"")); } catch(_e){}'
    ' try { if (window.SDLGHashRouter) window.SDLGHashRouter.set({ tab:"sdlginput", claimId:id, mode:"sdlginput", replace:true });'
    ' else { window.history.replaceState(null,"", location.pathname + location.search + "#/sdlginput/" + encodeURIComponent(String(id||""))); }'
    ' } catch(_e){} }'
)
if _old_sel in data:
    data = data.replace(_old_sel, _new_sel, 1)
    print("hash: onSelectClaim writes hash")

_old_open = 'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setDetailId(null); setEditing(false);'
_new_open = (
    'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false);'
    ' try { localStorage.setItem("sdlg-warranty:last-sdlginput-claim:v1", String(detail.claim_id||""));'
    ' localStorage.setItem("sdlg-warranty:last-claim:v1", String(detail.claim_id||"")); } catch(_e){}'
    ' try { if (window.SDLGHashRouter) window.SDLGHashRouter.set({ tab:"sdlginput", claimId:detail.claim_id, mode:"sdlginput", replace:true }); } catch(_e){}'
    ' setDetailId(null);'
)
if _old_open in data:
    data = data.replace(_old_open, _new_open, 1)
    print("hash: open SDLG Input keeps claim in storage+hash")

_old_fb = 'selectedClaimId: sdlgInputClaimId || (claims.find(c => !c.archived_at)?.claim_id || "")'
_new_fb = (
    'selectedClaimId: sdlgInputClaimId'
    ' || (typeof window !== "undefined" && window.SDLGHashRouter && window.SDLGHashRouter.claimId && window.SDLGHashRouter.claimId())'
    ' || (typeof localStorage !== "undefined" && (localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1") || localStorage.getItem("sdlg-warranty:last-claim:v1")))'
    ' || (claims.find(c => !c.archived_at)?.claim_id || "")'
)
if _old_fb in data:
    data = data.replace(_old_fb, _new_fb, 1)
    print("hash: selectedClaimId prefers stored/hash over first claim")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare_index.py done")
