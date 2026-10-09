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
    // SINGLETON ONLY - never call createClient here (fixes Multiple GoTrueClient + empty claims).
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

# 3) loadClaims: recover user from singleton session when React user is null
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
    print("loadClaims gate patched for session recovery")
else:
    print("WARNING: loadClaims gate not found")

# 4) Prefer singleton for getSession
data, n = re.subn(
    r"sdlgSupabase\.auth\.getSession\(\)",
    '((typeof window.getSdlgSupabase==="function"&&window.getSdlgSupabase())||sdlgSupabase).auth.getSession()',
    data,
)
print("getSession redirects:", n)

# 5) Evidence / Photo Context: clean display (NO source/variant-form)
idx = data.find("Evidence / Photo Context")
if idx >= 0:
    window = data[idx : idx + 1800]
    patterns = [
        (
            r'\(e\?\.value != null && String\(e\.value\)\.trim\(\) !== "" \? String\(e\.value\) : \(e\?\.caption \|\| e\?\.text \|\| e\?\.description \|\| \(e\?\.label \? String\(e\.label\) \+ \(e\?\.source \? " · " \+ e\.source : ""\) : "—"\)\)\)',
            '(function(){var v=e&&e.value!=null&&String(e.value).trim()!==""?String(e.value):(e&&e.caption)||(e&&e.text)||(e&&e.description)||(e&&e.url)||(e&&e.image_url)||null;if(v&&String(v).trim())return String(v);if(e&&e.label)return String(e.label);return "—";})()',
        ),
        (
            'e?.value || ""',
            '(function(){var v=e&&e.value!=null&&String(e.value).trim()!==""?String(e.value):(e&&e.caption)||(e&&e.text)||(e&&e.description)||null;if(v&&String(v).trim())return String(v);if(e&&e.label)return String(e.label);return "—";})()',
        ),
    ]
    patched = False
    for old, new in patterns:
        if old in window or re.search(old, window):
            if old in window:
                new_window = window.replace(old, new, 1)
            else:
                new_window = re.sub(old, new, window, count=1)
            data = data[:idx] + new_window + data[idx + 1800 :]
            print("evidence display cleaned (no source)")
            patched = True
            break
    if not patched:
        print("WARNING: evidence value pattern not found for clean patch")
else:
    print("WARNING: Photo Context not found")

# 6) Repair Date: fallback chain dealer_repair_date -> completion_date -> failure_date
old_repair = 'React.createElement(Row, { label: "Repair Date", value: detail.dealer_repair_date })'
new_repair = 'React.createElement(Row, { label: "Repair Date", value: detail.dealer_repair_date || detail.completion_date || detail.failure_date || "—" })'
if old_repair in data:
    data = data.replace(old_repair, new_repair, 1)
    print("Repair Date fallback patched")
else:
    print("WARNING: Repair Date Row not found")

# 7) Row component: show em-dash for empty instead of hiding the row
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
    print("Row empty fallback patched (full)")
else:
    if "const display = empty" in data and "String(value))));" in data:
        data = data.replace(
            'React.createElement("div", { style: { flex: 1, fontSize: 13, color: "#1e293b", fontFamily: mono ? "monospace" : "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, String(value))));',
            'React.createElement("div", { style: { flex: 1, fontSize: 13, color: empty ? "#9ca3af" : "#1e293b", fontStyle: empty ? "italic" : "normal", fontFamily: mono && !empty ? "monospace" : "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, String(display))));',
            1,
        )
        print("Row value cell fixed to display")
    else:
        print("WARNING: Row component not found for empty fallback")

# 8) Inject scripts after supabase CDN
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
