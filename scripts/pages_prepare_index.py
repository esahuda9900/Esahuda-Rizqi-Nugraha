#!/usr/bin/env python3
"""Bootstrap pages_prepare + FOUC + auth + Overview boss session wait + Overview UX."""
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

for old in ("20261009-v12", "20261009-v13", "20261009-v14"):
    code = code.replace("sdlg-route-finish.js?v=" + old, "sdlg-route-finish.js?v=20261010-v15")

ns = {"__name__": "__main__", "__file__": str(Path(__file__).resolve())}
exec(compile(code, "pages_prepare_index.py(good)", "exec"), ns, ns)

INDEX = Path("_site/index.html")
data = INDEX.read_text(encoding="utf-8", errors="replace")

FOUC = """<!-- SDLG_CRITICAL_FOUC_V1 -->
<style id="sdlg-critical-fouc">
html, body { background: #eef1f6; }
.login-screen { background: #eef1f6 !important; background-image: none !important; }
.login-intro h1 { font-size: 28px !important; line-height: 1.2 !important; font-weight: 700 !important; color: #0f172a !important; }
.login-card input, #login-email, #login-password {
  background: #ffffff !important; background-color: #ffffff !important;
  border: 1px solid #e2e8f0 !important; color: #0f172a !important;
}
.login-card input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 40px #ffffff inset !important;
  -webkit-text-fill-color: #0f172a !important;
}
.login-trust-list { display: none !important; }
#sdlg-data-pipeline-banner { display: none !important; }
</style>
<link rel="stylesheet" href="./modules/sdlg-ui-polish-v3.css?v=20261010-v33" id="sdlg-ui-polish-v3-static" />
"""

if "SDLG_CRITICAL_FOUC_V1" not in data:
    if '<base href="./"' in data:
        data = data.replace('<base href="./">', '<base href="./">\n' + FOUC, 1)
    elif "</title>" in data:
        data = data.replace("</title>", "</title>\n" + FOUC, 1)
    else:
        data = data.replace("<head>", "<head>\n" + FOUC, 1)
    print("injected FOUC critical CSS + static polish link")
else:
    data = re.sub(
        r"./modules/sdlg-ui-polish-v3\.css\?v=[^"]+",
        "./modules/sdlg-ui-polish-v3.css?v=20261010-v33",
        data,
    )
    data = data.replace("font-size: 32px !important", "font-size: 28px !important")
    print("FOUC already present; version refreshed")

AUTH_SRC = "./modules/sdlg-auth-route-guard.js?v=20261010-v13"
if "sdlg-auth-route-guard.js" not in data:
    needle = 'src="./modules/claim-fields.js"'
    if needle in data:
        data = data.replace(
            needle,
            needle + '></script>\n  <script src="' + AUTH_SRC + '"',
            1,
        )
        print("injected auth-route-guard after claim-fields")
    else:
        data = data.replace("</body>", '<script src="' + AUTH_SRC + '"></script>\n</body>', 1)
        print("injected auth-route-guard before body end")
else:
    data = re.sub(
        r"./modules/sdlg-auth-route-guard\.js\?v=[^"]+",
        AUTH_SRC,
        data,
    )

# Boss analytics session-wait patch
MARKER = 'client.from("claim_ops_boss_v").select("*")'
if "loadBossAnalytics" in data:
    print("boss analytics session-wait already present")
elif MARKER in data and "setBossOpsRows" in data:
    pat = re.compile(
        r"useEffect\(\(\)\s*=>\s*\{\s*let cancelled = false;\s*"
        r"\(async \(\)\s*=>\s*\{\s*try\s*\{\s*"
        r"const client = \(typeof sdlgSupabase[^;]+;\s*"
        r"if \(!client\?\.from\) return;\s*"
        r"const \[ops, stages, dwell\] = await Promise\.all\(\[\s*"
        r"client\.from\(\"claim_ops_boss_v\"\)\.select\(\"\*\"\),\s*"
        r"client\.from\(\"claim_stage_aging_summary_v\"\)\.select\(\"\*\"\),\s*"
        r"client\.from\(\"claim_status_dwell_v\"\)\.select\(\"\*\"\)\s*"
        r"\]\);\s*"
        r"if \(cancelled\) return;\s*"
        r"setBossOpsRows\([^;]+;\s*"
        r"setStageAgingRows\([^;]+;\s*"
        r"setStatusDwellRows\([^;]+;\s*"
        r"\}\s*catch\s*\(_\)\s*\{[^}]*\}\s*"
        r"\}\)\(\);\s*"
        r"return \(\)\s*=>\s*\{\s*cancelled = true;\s*\};\s*"
        r"\}, \[\]\);",
        re.DOTALL,
    )
    NEW = """useEffect(() => {
        let cancelled = false;
        const loadBossAnalytics = async () => {
            try {
                let client = null;
                try {
                    if (typeof window.waitForSupabaseReady === "function") {
                        client = await window.waitForSupabaseReady(12000);
                    }
                } catch (_) {}
                if (!client) {
                    client = (typeof window.getSdlgSupabase === "function")
                        ? window.getSdlgSupabase()
                        : ((typeof sdlgSupabase !== "undefined") ? sdlgSupabase : null);
                }
                if (!client || !client.from || !client.auth) return;
                let session = null;
                try {
                    const sr = await client.auth.getSession();
                    session = sr && sr.data ? sr.data.session : null;
                    if (!session && typeof window.sdlgRecheckSession === "function") {
                        session = await window.sdlgRecheckSession();
                    }
                } catch (_) {}
                if (!session || !session.access_token) return;
                const [ops, stages, dwell] = await Promise.all([
                    client.from("claim_ops_boss_v").select("*"),
                    client.from("claim_stage_aging_summary_v").select("*"),
                    client.from("claim_status_dwell_v").select("*")
                ]);
                if (cancelled) return;
                setBossOpsRows(Array.isArray(ops && ops.data) ? ops.data : []);
                setStageAgingRows(Array.isArray(stages && stages.data) ? stages.data : []);
                setStatusDwellRows(Array.isArray(dwell && dwell.data) ? dwell.data : []);
            } catch (_) {}
        };
        loadBossAnalytics();
        const onReady = function () { if (!cancelled) loadBossAnalytics(); };
        try { window.addEventListener("sdlg-session-ready", onReady); } catch (_) {}
        return function () {
            cancelled = true;
            try { window.removeEventListener("sdlg-session-ready", onReady); } catch (_) {}
        };
    }, []);"""
    data2, n = pat.subn(NEW, data, count=1)
    if n:
        data = data2
        print("patched boss analytics useEffect via regex:", n)
    else:
        print("WARNING: regex did not match boss useEffect")
else:
    print("WARNING: boss marker not found")

# Overview UX: KPI zero rates → em dash
if '["Approval Rate", approvedRate + "%"]' in data:
    data = data.replace(
        '["Approval Rate", approvedRate + "%"]',
        '["Approval Rate", (approvedRate === "0.0" || approved === 0) ? "\\u2014" : (approvedRate + "%")]',
        1,
    )
    data = data.replace(
        '["Rejection Rate", rejectedRate + "%"]',
        '["Rejection Rate", (rejectedRate === "0.0" || rejected === 0) ? "\\u2014" : (rejectedRate + "%")]',
        1,
    )
    print("patched KPI rate zero → em dash")

if 'x.value ? "ACTION" : "CLEAR"' in data:
    data = data.replace(
        'x.value ? "ACTION" : "CLEAR"',
        'x.priority === "P2" ? (x.value ? "MONITOR" : "CLEAR") : (x.value ? "ACTION" : "CLEAR")',
        1,
    )
    print("patched P2 badge to MONITOR")

_old_st = 'style: { textAlign: "left", padding: "12px 13px", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 10, cursor: "pointer" }'
if _old_st in data and 'P0: "#fecaca"' not in data:
    _new_st = (
        'style: (function(){ var border=({P0:"#fecaca",P1:"#fde68a",P2:"#e2e8f0",ACTION:"#bfdbfe"})[x.priority]||"#e2e8f0";'
        ' var bg=({P0:"#fef2f2",P1:"#fffbeb",P2:"#f9fafb",ACTION:"#eff6ff"})[x.priority]||"#fff";'
        ' return { textAlign:"left", padding:"12px 13px", border:"1px solid "+border, background:bg, borderRadius:10, cursor:"pointer" }; })()'
    )
    data = data.replace(_old_st, _new_st, 1)
    print("patched My Action Today semantic colors")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare post-FOUC + boss analytics + overview UX done")
