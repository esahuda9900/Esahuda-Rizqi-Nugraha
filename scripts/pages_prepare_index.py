#!/usr/bin/env python3
"""Patch index.html for GitHub Project Pages deploy artifact."""
from pathlib import Path
import re

INDEX = Path("_site/index.html")
data = INDEX.read_text(encoding="utf-8", errors="replace")

# 1) Root-absolute paths -> relative
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

# 2) Rewrite getSupabaseClient to use singleton
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
if m:
    data = data[: m.start()] + NEW_FN + data[m.end() :]
    print("getSupabaseClient rewritten")
else:
    print("WARNING: getSupabaseClient not found")

# 3) loadClaims session recovery
OLD_GATE = """const loadClaims = useCallback(async () => {
        if (!user) {
            setClaims([]);
            setActionCenterRows([]);
            setLoading(false);
            return;
        }"""

NEW_GATE = """const loadClaims = useCallback(async () => {
        let effectiveUser = user;
        if (!effectiveUser) {
            try {
                const _c = (typeof window.getSdlgSupabase === "function" && window.getSdlgSupabase()) || window.sdlgSupabase || sdlgSupabase;
                if (_c && _c.auth) {
                    const _s = await _c.auth.getSession();
                    effectiveUser = _s?.data?.session?.user || null;
                    if (effectiveUser) {
                        setUser(effectiveUser);
                        console.info("[SDLG] loadClaims recovered user from session", effectiveUser.email || effectiveUser.id);
                    }
                }
            } catch (e) {
                console.warn("[SDLG] loadClaims session recover failed", e);
            }
        }
        if (!effectiveUser) {
            setClaims([]);
            setActionCenterRows([]);
            setLoading(false);
            return;
        }"""

if OLD_GATE in data:
    data = data.replace(OLD_GATE, NEW_GATE, 1)
    print("loadClaims gate patched")
else:
    print("WARNING: loadClaims gate not found")

data, n = re.subn(
    r"sdlgSupabase\.auth\.getSession\(\)",
    '((typeof window.getSdlgSupabase==="function"&&window.getSdlgSupabase())||sdlgSupabase).auth.getSession()',
    data,
)
print("getSession redirects:", n)

# 5) Evidence: no source metadata
idx = data.find("Evidence / Photo Context")
if idx >= 0:
    window = data[idx : idx + 1800]
    old_ev = 'e?.value || ""'
    new_ev = '(function(){var v=e&&e.value!=null&&String(e.value).trim()!==""?String(e.value):(e&&e.caption)||(e&&e.text)||(e&&e.description)||null;if(v&&String(v).trim())return String(v);if(e&&e.label)return String(e.label);return "—";})()'
    if old_ev in window:
        data = data[:idx] + window.replace(old_ev, new_ev, 1) + data[idx + 1800 :]
        print("evidence cleaned")
    else:
        # already patched variant with source
        import re as _re
        m2 = _re.search(r'\(e\?\.value[^\)]{20,400}e\.source[^\)]{0,80}\)', window)
        if m2:
            data = data[:idx] + window.replace(m2.group(0), new_ev, 1) + data[idx + 1800 :]
            print("evidence cleaned (regex)")

# 6) Assessment Repair Date fallback
old_repair = 'React.createElement(Row, { label: "Repair Date", value: detail.dealer_repair_date })'
new_repair = 'React.createElement(Row, { label: "Repair Date", value: detail.dealer_repair_date || detail.completion_date || detail.failure_date || "—" })'
if old_repair in data:
    data = data.replace(old_repair, new_repair, 1)
    print("Assessment Repair Date fallback")

# 7) Row empty -> em dash
old_row_full = '''const Row = ({ label, value, mono }) => {
    if (value == null || value === "" || value === "null")
        return null;
    return (React.createElement("div", { style: { display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #f1f5f9", alignItems: "flex-start" } },
        React.createElement("div", { style: { width: 180, flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#94a3b8", paddingTop: 1 } }, label),
        React.createElement("div", { style: { flex: 1, fontSize: 13, color: "#1e293b", fontFamily: mono ? "monospace" : "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, String(value))));
};'''
new_row_full = '''const Row = ({ label, value, mono }) => {
    const empty = value == null || value === "" || value === "null" || value === "undefined";
    const display = empty ? "—" : value;
    return (React.createElement("div", { style: { display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #f1f5f9", alignItems: "flex-start" } },
        React.createElement("div", { style: { width: 180, flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#6b7280", paddingTop: 1 } }, label),
        React.createElement("div", { style: { flex: 1, fontSize: 13, color: empty ? "#9ca3af" : "#1e293b", fontStyle: empty ? "italic" : "normal", fontFamily: mono && !empty ? "monospace" : "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, String(display))));
};'''
if old_row_full in data:
    data = data.replace(old_row_full, new_row_full, 1)
    print("Row empty fallback")

# 8) Portal Home: REAL fix for empty Service Method + Date of repair report
old_sm = 'serviceMethod: selectedClaim.service_method || "",'
new_sm = (
    'serviceMethod: selectedClaim.repair_method || selectedClaim.service_method || "",\n'
    '        repairDate: portalDate(selectedClaim.dealer_repair_date || selectedClaim.completion_date || selectedClaim.failure_date),'
)
if old_sm in data:
    data = data.replace(old_sm, new_sm, 1)
    print("portalValues serviceMethod + repairDate")
else:
    print("WARNING: portalValues serviceMethod not found")

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
else:
    print("WARNING: fieldHtml pair not found")

# 9) Inject scripts
def inject_after(marker: str, script_src: str) -> None:
    global data
    leaf = script_src.rsplit("/", 1)[-1]
    if leaf in data:
        return
    i = data.find(marker)
    if i < 0:
        return
    end = data.find("</script>", i)
    if end < 0:
        return
    inject = '</script>\n  <script src="' + script_src + '"></script>'
    data = data[:end] + inject + data[end + len("</script>") :]
    print("injected", script_src)

inject_after("supabase.min.js", "./modules/supabase-client.js")
inject_after("supabase-client.js", "./modules/data-pipeline-guard.js")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare_index.py done")
