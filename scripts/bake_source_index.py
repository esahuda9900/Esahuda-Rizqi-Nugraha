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
        changes.append(f"{label}:{min(count, n)}")
    else:
        data = data.replace(old, new)
        changes.append(f"{label}:{n}")
    print(f"OK {label}: {n if not count else min(count, n)}")

rep('src="/modules/', 'src="./modules/', "src /modules/")
rep("src='/modules/", "src='./modules/", "src '/modules/")
rep('href="/modules/', 'href="./modules/', "href /modules/")
rep('src="/canonical-', 'src="./canonical-', "src /canonical-")
rep('src="/styles/', 'src="./styles/', "src /styles/")
rep('href="/styles/', 'href="./styles/', "href /styles/")

if "<base " not in data.lower():
    data = data.replace("<head>", '<head>\n  <base href="./">', 1)
    changes.append("base href")
    print("OK base href")

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
m = re.search(r"function getSupabaseClient\(\) \{[\s\S]*?\n\}", data)
if m and "getSdlgSupabase" not in m.group(0):
    data = data[: m.start()] + NEW_FN + data[m.end() :]
    changes.append("getSupabaseClient")
    print("OK getSupabaseClient")
elif m:
    print("SKIP getSupabaseClient (already singleton)")
else:
    print("SKIP getSupabaseClient (not found)")

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
    changes.append("loadClaims")
    print("OK loadClaims")
else:
    print("SKIP loadClaims")

old_repair = 'React.createElement(Row, { label: "Repair Date", value: detail.dealer_repair_date })'
new_repair = 'React.createElement(Row, { label: "Repair Date", value: detail.dealer_repair_date || detail.completion_date || detail.failure_date || "—" })'
rep(old_repair, new_repair, "Assessment Repair Date", 1)

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

INDEX.write_text(data, encoding="utf-8")
print("bake_source_index.py done; changes:", len(changes))
for c in changes:
    print(" -", c)
