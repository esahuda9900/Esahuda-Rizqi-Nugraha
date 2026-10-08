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

# 5) Inject scripts after supabase CDN
def inject_after(marker: str, script_src: str) -> None:
    global data
    leaf = script_src.rsplit("/", 1)[-1]
    if leaf in data:
        return
    idx = data.find(marker)
    if idx < 0:
        return
    end = data.find("</script>", idx)
    if end < 0:
        return
    inject = '</script>\n  <script src="' + script_src + '"></script>'
    data = data[:end] + inject + data[end + len("</script>") :]
    print("injected", script_src)

inject_after("supabase.min.js", "./modules/supabase-client.js")
inject_after("supabase-client.js", "./modules/data-pipeline-guard.js")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare_index.py done")
