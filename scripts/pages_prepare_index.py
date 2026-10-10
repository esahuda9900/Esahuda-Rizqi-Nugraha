#!/usr/bin/env python3
"""Bootstrap pages_prepare + FOUC + auth + Overview + loading UX architecture."""
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
        r'./modules/sdlg-ui-polish-v3\.css\?v=[^"]+',
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
        r'./modules/sdlg-auth-route-guard\.js\?v=[^"]+',
        AUTH_SRC,
        data,
    )

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

data = data.replace(
    'sdlg-overview-ux.js?v=20261010-v1',
    'sdlg-overview-ux.js?v=20261010-v11',
)
if "sdlg-overview-ux.js" not in data:
    data = data.replace(
        "</body>",
        '  <script src="./modules/sdlg-overview-ux.js?v=20261010-v11" data-sdlg-overview-ux="1"></script>\n</body>',
        1,
    )
    print("injected overview-ux script before </body>")

# Cache-bust repository to v3 (countClaimsCached)
data = re.sub(
    r'src="\./modules/sdlg-repository\.js(?:\?v=[^"]*)?"',
    'src="./modules/sdlg-repository.js?v=20261010-v3"',
    data,
    count=1,
)
print("cache-bust sdlg-repository v3")

# === Loading Architecture: no 0 → 100 → 538 flash ===
if "LOAD_UX: single full fetch" not in data:
    pat = re.compile(
        r'const firstPage\s*=\s*typeof SDLG_REPOSITORY\.listClaimsPage\s*===\s*"function"\s*'
        r'\?\s*await SDLG_REPOSITORY\.listClaimsPage\(0\)\s*'
        r':\s*null;\s*'
        r'if\s*\(\s*firstPage\s*&&\s*firstPage\.length\s*\)\s*\{\s*'
        r'setClaims\(firstPage\);\s*'
        r'setLoading\(false\);\s*'
        r'\}\s*'
        r'const\s*\[all,\s*actionRows\]\s*=\s*await\s*Promise\.all\(\[\s*'
        r'SDLG_REPOSITORY\.listClaims\(\),',
        re.MULTILINE,
    )
    repl = (
        '/* LOAD_UX: single full fetch — no intermediate 100-row flash */\n'
        '            const [all, actionRows] = await Promise.all([\n'
        '                SDLG_REPOSITORY.listClaims(),'
    )
    new_data, n = pat.subn(repl, data, count=1)
    if n:
        data = new_data
        print("patched loadClaims: single full fetch (no 100-flash) via regex")
    else:
        if "listClaimsPage(0)" in data and "setClaims(firstPage)" in data:
            data = data.replace("setClaims(firstPage);", "/* LOAD_UX skip intermediate */;", 1)
            data = data.replace("setLoading(false);\n            }\n            const [all, actionRows]",
                                "/* keep loading until full */\n            }\n            const [all, actionRows]", 1)
            print("patched loadClaims: soft skip setClaims(firstPage)")
        else:
            print("WARNING: firstPage block not matched")

OLD_NAV = '["list", `Claims · ${claims.filter(c => !c.archived_at).length}`],'
NEW_NAV = '["list", loading ? "Claims · …" : `Claims · ${claims.filter(c => !c.archived_at).length}`],'
if OLD_NAV in data:
    data = data.replace(OLD_NAV, NEW_NAV, 1)
    print("patched nav Claims count: … while loading")
elif "Claims · …" in data:
    print("nav Claims … already present")
else:
    data2, n2 = re.subn(
        r'\["list",\s*`Claims · \$\{claims\.filter\(c => !c\.archived_at\)\.length\}`\],',
        NEW_NAV,
        data,
        count=1,
    )
    if n2:
        data = data2
        print("patched nav Claims via regex")
    else:
        print("WARNING: nav Claims pattern not matched")

if '["Total Claims", loading' not in data and '["Total Claims", totalClaims]' in data:
    data = data.replace(
        '["Total Claims", totalClaims]',
        '["Total Claims", loading ? "\\u2026" : totalClaims]',
        1,
    )
    data = data.replace(
        '["Total Claim Amount", totalAmountDisplay]',
        '["Total Claim Amount", loading ? "\\u2026" : totalAmountDisplay]',
        1,
    )
    data = data.replace(
        '["On Hold", onHold]',
        '["On Hold", loading ? "\\u2026" : onHold]',
        1,
    )
    print("patched KPI cards: … while loading")

if "sdlg-overview-loading.js" not in data:
    data = data.replace(
        "</body>",
        '  <script src="./modules/sdlg-overview-loading.js?v=20261010-v1" data-sdlg-overview-loading="1"></script>\n</body>',
        1,
    )
    print("injected overview-loading script")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare post-FOUC + loading architecture done")
