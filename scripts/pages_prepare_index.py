#!/usr/bin/env python3
"""Deploy prepare: safety claim-id lock for SDLG Input."""
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

# FOUC minimal
if "SDLG_CRITICAL_FOUC_V1" not in data and "</title>" in data:
    data = data.replace(
        "</title>",
        "</title>\n<link rel=\"stylesheet\" href=\"./modules/sdlg-ui-polish-v3.css?v=20261010-v33\" />",
        1,
    )

if "#/claim/' + encodeURIComponent(c.claim_id)" in data:
    data = data.replace(
        "#/claim/' + encodeURIComponent(c.claim_id)",
        "#/claims/' + encodeURIComponent(c.claim_id)",
    )

# Expand claim hash regex
data = data.replace(
    "(?:sdlg-input|sdlginput|claim)\\/([^/?#]+)",
    "(?:sdlg-input|sdlginput|claims|claim)\\/([^/?#]+)",
)
data = data.replace(
    "(?:sdlg-input|sdlginput|claim)/([^/?#]+)",
    "(?:sdlg-input|sdlginput|claims|claim)/([^/?#]+)",
)

if 'if (_hm) return decodeURIComponent(_hm[1]);' in data:
    data = data.replace(
        'if (_hm) return decodeURIComponent(_hm[1]);',
        'if (_hm) { var _seg = decodeURIComponent(_hm[1]); if (!/^\\d{4}$/.test(_seg)) return _seg; }',
        1,
    )
    print("year-skip on hash init")

OLD_LS = 'var _ls = localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1"); if (_ls) return String(_ls);'
if OLD_LS in data:
    data = data.replace(OLD_LS, '/* SAFETY: no localStorage cold-start claim id */', 1)
    print("disabled LS cold-start")

if ' || (claims.find(c => !c.archived_at)?.claim_id || "")' in data:
    data = data.replace(' || (claims.find(c => !c.archived_at)?.claim_id || "")', '', 1)
    print("removed first-claim fallback")

for frag in (
    ' || (typeof localStorage !== "undefined" && (localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1")))',
    ' || (typeof localStorage !== "undefined" && localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1"))',
):
    if frag in data:
        data = data.replace(frag, '', 1)
        print("removed LS from selectedClaimId prop")

if 'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false);' in data and 'navigate("sdlg-input"' not in data[data.find('setSdlgInputClaimId(detail.claim_id)'):data.find('setSdlgInputClaimId(detail.claim_id)')+350]:
    data = data.replace(
        'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false);',
        'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false); try { if (window.SDLGHashRouter && window.SDLGHashRouter.navigate) window.SDLGHashRouter.navigate("sdlg-input", { claimId: detail.claim_id }, { replace: true }); else { history.replaceState(null,"", location.pathname + location.search + "#/sdlg-input/" + encodeURIComponent(detail.claim_id)); } } catch(_nav){}',
        1,
    )

data = re.sub(r'sdlg-input-claim-sync\.js\?v=[^"\s]+', 'sdlg-input-claim-sync.js?v=20261012-v11', data)
if "sdlg-input-claim-sync.js" not in data:
    data = data.replace(
        "</body>",
        '  <script src="./modules/sdlg-input-claim-sync.js?v=20261012-v11" data-sdlg-input-claim-sync="1"></script>\n</body>',
        1,
    )

data = re.sub(r'src="\./modules/sdlg-repository\.js(?:\?v=[^"]*)?"', 'src="./modules/sdlg-repository.js?v=20261010-v3"', data, count=1)
data = re.sub(r'sdlg-portal-finance-ux\.js(?:\?v=[^"\s]*)?', 'sdlg-portal-finance-ux.js?v=20261010-v4', data)

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare SAFETY claim-id lock done")
