#!/usr/bin/env python3
"""Bootstrap pages_prepare + FOUC + auth + Overview priority loading."""
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
else:
    data = re.sub(r'./modules/sdlg-ui-polish-v3\.css\?v=[^"]+', "./modules/sdlg-ui-polish-v3.css?v=20261010-v33", data)

AUTH_SRC = "./modules/sdlg-auth-route-guard.js?v=20261010-v13"
if "sdlg-auth-route-guard.js" not in data:
    needle = 'src="./modules/claim-fields.js"'
    if needle in data:
        data = data.replace(needle, needle + '></script>\n  <script src="' + AUTH_SRC + '"', 1)
    else:
        data = data.replace("</body>", '<script src="' + AUTH_SRC + '"></script>\n</body>', 1)
else:
    data = re.sub(r'./modules/sdlg-auth-route-guard\.js\?v=[^"]+', AUTH_SRC, data)

# LOAD_UX
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
        '/* LOAD_UX: single full fetch */\n'
        '            const [all, actionRows] = await Promise.all([\n'
        '                SDLG_REPOSITORY.listClaims(),'
    )
    data, n = pat.subn(repl, data, count=1)
    if n:
        print("patched loadClaims")
    elif "setClaims(firstPage)" in data:
        data = data.replace("setClaims(firstPage);", "/* LOAD_UX skip */;", 1)

# Nav
OLD_NAV = '["list", `Claims \u00b7 ${claims.filter(c => !c.archived_at).length}`],'
NEW_NAV = '["list", loading ? "Claims \u00b7 \u2026" : `Claims \u00b7 ${claims.filter(c => !c.archived_at).length}`],'
if OLD_NAV in data:
    data = data.replace(OLD_NAV, NEW_NAV, 1)
else:
    OLD_NAV2 = '["list", `Claims · ${claims.filter(c => !c.archived_at).length}`],'
    NEW_NAV2 = '["list", loading ? "Claims · \u2026" : `Claims · ${claims.filter(c => !c.archived_at).length}`],'
    if OLD_NAV2 in data:
        data = data.replace(OLD_NAV2, NEW_NAV2, 1)

# ALL 5 KPIs gated on loading (including rates)
if '["Total Claims", loading' not in data and '["Total Claims", totalClaims]' in data:
    data = data.replace('["Total Claims", totalClaims]', '["Total Claims", loading ? "\\u2026" : totalClaims]', 1)
    data = data.replace('["Total Claim Amount", totalAmountDisplay]', '["Total Claim Amount", loading ? "\\u2026" : totalAmountDisplay]', 1)
    data = data.replace('["On Hold", onHold]', '["On Hold", loading ? "\\u2026" : onHold]', 1)

# Rates: always apply loading gate (covers both raw and em-dash forms)
if 'loading ? "\\u2026" : ((approvedRate' not in data:
    if '["Approval Rate", (approvedRate === "0.0" || approved === 0) ? "\\u2014" : (approvedRate + "%")]' in data:
        data = data.replace(
            '["Approval Rate", (approvedRate === "0.0" || approved === 0) ? "\\u2014" : (approvedRate + "%")]',
            '["Approval Rate", loading ? "\\u2026" : ((approvedRate === "0.0" || approved === 0) ? "\\u2014" : (approvedRate + "%"))]',
            1,
        )
        print("gated Approval Rate")
    elif '["Approval Rate", approvedRate + "%"]' in data:
        data = data.replace(
            '["Approval Rate", approvedRate + "%"]',
            '["Approval Rate", loading ? "\\u2026" : ((approvedRate === "0.0" || approved === 0) ? "\\u2014" : (approvedRate + "%"))]',
            1,
        )
        print("gated Approval Rate raw")

if 'loading ? "\\u2026" : ((rejectedRate' not in data:
    if '["Rejection Rate", (rejectedRate === "0.0" || rejected === 0) ? "\\u2014" : (rejectedRate + "%")]' in data:
        data = data.replace(
            '["Rejection Rate", (rejectedRate === "0.0" || rejected === 0) ? "\\u2014" : (rejectedRate + "%")]',
            '["Rejection Rate", loading ? "\\u2026" : ((rejectedRate === "0.0" || rejected === 0) ? "\\u2014" : (rejectedRate + "%"))]',
            1,
        )
        print("gated Rejection Rate")
    elif '["Rejection Rate", rejectedRate + "%"]' in data:
        data = data.replace(
            '["Rejection Rate", rejectedRate + "%"]',
            '["Rejection Rate", loading ? "\\u2026" : ((rejectedRate === "0.0" || rejected === 0) ? "\\u2014" : (rejectedRate + "%"))]',
            1,
        )
        print("gated Rejection Rate raw")

# My Action
for pri in ("P0", "P1", "P2"):
    old_v = "value: counts.%s || 0" % pri
    new_v = 'value: loading ? "\\u2026" : (counts.%s || 0)' % pri
    if old_v in data:
        data = data.replace(old_v, new_v, 1)
if 'value: actionRequired.length' in data and 'loading ? "\\u2026" : actionRequired.length' not in data:
    data = data.replace('value: actionRequired.length', 'value: loading ? "\\u2026" : actionRequired.length', 1)

# Status Flow
if 'React.createElement("b", { style: { fontSize: 12 } }, n));' in data:
    data = data.replace(
        'React.createElement("b", { style: { fontSize: 12 } }, n));',
        'React.createElement("b", { style: { fontSize: 12 } }, loading ? "\\u2026" : n));',
        1,
    )

# Charts empty
for msg in (
    "Belum ada tanggal yang bisa dianalisis.",
    "Belum ada data model.",
    "Belum ada data branch.",
    "Belum ada data parts.",
    "Belum ada claim rejected.",
):
    old_e = 'React.createElement("div", { style: { fontSize: 13, color: "#94a3b8" } }, "%s")' % msg
    new_e = 'React.createElement("div", { style: { fontSize: 13, color: "#94a3b8" } }, loading ? "\\u2026" : "%s")' % msg
    if old_e in data:
        data = data.replace(old_e, new_e, 1)

# Rupiah
_old_rp = '"Rp ",\n                            new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(idrEquivalent || 0)'
_new_rp = 'loading ? "\\u2026" : ("Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(idrEquivalent || 0))'
if _old_rp in data:
    data = data.replace(_old_rp, _new_rp, 1)

# Pass loading to boss analytics
old_pf = "window.SDLGBossAnalytics.periodFilterBar({ React, claims, year: analyticsYear, setYear: setAnalyticsYear, month: analyticsMonth, setMonth: setAnalyticsMonth })"
new_pf = "window.SDLGBossAnalytics.periodFilterBar({ React, claims, year: analyticsYear, setYear: setAnalyticsYear, month: analyticsMonth, setMonth: setAnalyticsMonth, loading: loading })"
if old_pf in data:
    data = data.replace(old_pf, new_pf, 1)

if "renderExtraPanels({" in data and "loading: loading" not in data.split("renderExtraPanels({")[1][:300]:
    data = data.replace(
        "window.SDLGBossAnalytics.renderExtraPanels({",
        "window.SDLGBossAnalytics.renderExtraPanels({ loading: loading,",
        1,
    )

# Cache-bust
data = re.sub(r'src="\./modules/sdlg-repository\.js(?:\?v=[^"]*)?"', 'src="./modules/sdlg-repository.js?v=20261010-v3"', data, count=1)
data = re.sub(r'sdlg-overview-loading\.js\?v=[^"\s]+', 'sdlg-overview-loading.js?v=20261010-v22', data)
data = re.sub(r'boss-analytics-dashboard\.js(?:\?v=[^"]*)?', 'boss-analytics-dashboard.js?v=20261010-v42', data)

if "sdlg-overview-ux.js" not in data:
    data = data.replace("</body>", '  <script src="./modules/sdlg-overview-ux.js?v=20261010-v11" data-sdlg-overview-ux="1"></script>\n</body>', 1)
if "sdlg-overview-loading.js" not in data:
    data = data.replace("</body>", '  <script src="./modules/sdlg-overview-loading.js?v=20261010-v22" data-sdlg-overview-loading="1"></script>\n</body>', 1)
    print("injected overview-loading v22")
else:
    print("overview-loading ref present")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare priority-loading done")
