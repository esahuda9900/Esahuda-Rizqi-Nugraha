#!/usr/bin/env python3
"""Bootstrap pages_prepare + claim hash sync + SDLG Input claim-id hardening."""
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

# --- FOUC / auth / loading / finance / hash sync (condensed from stable prepare) ---
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

if "LOAD_UX: single full fetch" not in data and "setClaims(firstPage)" in data:
    data = data.replace("setClaims(firstPage);", "/* LOAD_UX skip */;", 1)

OLD_NAV2 = '["list", `Claims \u00b7 ${claims.filter(c => !c.archived_at).length}`],'
# skip if already has loading ternary

if "#/claim/' + encodeURIComponent(c.claim_id)" in data:
    data = data.replace(
        "#/claim/' + encodeURIComponent(c.claim_id)",
        "#/claims/' + encodeURIComponent(c.claim_id)",
    )
    print("patched claim URL fallback")

# Expand hash regex: claim -> claims|claim
data = data.replace(
    "(?:sdlg-input|sdlginput|claim)\\/([^/?#]+)",
    "(?:sdlg-input|sdlginput|claims|claim)\\/([^/?#]+)",
    1,
)
data = data.replace(
    "(?:sdlg-input|sdlginput|claim)/([^/?#]+)",
    "(?:sdlg-input|sdlginput|claims|claim)/([^/?#]+)",
    1,
)

# Remove silent fallback to first claim (cross-claim contamination)
if " || (claims.find(c => !c.archived_at)?.claim_id || \"\")" in data:
    data = data.replace(" || (claims.find(c => !c.archived_at)?.claim_id || \"\")", "", 1)
    print("removed first-claim fallback")
elif " || (claims.find(c => !c.archived_at)?.claim_id || \"\")" in data:
    pass

# Also try without extra escapes
if "claims.find(c => !c.archived_at)?.claim_id || \"\"" in data:
    # only remove when used as selectedClaimId trailing fallback
    data = data.replace(
        " || (claims.find(c => !c.archived_at)?.claim_id || \"\")",
        "",
        1,
    )
if ' || (claims.find(c => !c.archived_at)?.claim_id || "")' in data:
    data = data.replace(
        ' || (claims.find(c => !c.archived_at)?.claim_id || "")',
        '',
        1,
    )
    print("removed first-claim fallback (plain)")

# Prefer last-sdlginput only (not last-claim) in prop chain when possible
data = data.replace(
    'localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1") || localStorage.getItem("sdlg-warranty:last-claim:v1")',
    'localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1")',
)

# Open from detail → hash #/sdlg-input/:id
if 'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false);' in data and 'navigate("sdlg-input"' not in data:
    data = data.replace(
        'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false);',
        'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false); try { if (window.SDLGHashRouter && window.SDLGHashRouter.navigate) window.SDLGHashRouter.navigate("sdlg-input", { claimId: detail.claim_id }, { replace: true }); else { history.replaceState(null,"", location.pathname + location.search + "#/sdlg-input/" + encodeURIComponent(detail.claim_id)); } } catch(_nav){}',
        1,
    )
    print("patched open SDLG Input → #/sdlg-input/:id")

data = re.sub(r'src="\./modules/sdlg-repository\.js(?:\?v=[^"]*)?"', 'src="./modules/sdlg-repository.js?v=20261010-v3"', data, count=1)
data = re.sub(r'sdlg-portal-finance-ux\.js(?:\?v=[^"\s]*)?', 'sdlg-portal-finance-ux.js?v=20261010-v4', data)

if "sdlg-input-claim-sync.js" not in data:
    data = data.replace(
        "</body>",
        '  <script src="./modules/sdlg-input-claim-sync.js?v=20261012-v1" data-sdlg-input-claim-sync="1"></script>\n</body>',
        1,
    )
    print("injected input-claim-sync")

if "sdlg-overview-ux.js" not in data:
    data = data.replace("</body>", '  <script src="./modules/sdlg-overview-ux.js?v=20261010-v11"></script>\n</body>', 1)

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare claim-id hardening done")
