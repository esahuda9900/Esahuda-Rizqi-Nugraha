#!/usr/bin/env python3
"""Deploy prepare — claim data safety lock (no wrong-claim paste)."""
from pathlib import Path
import re
import urllib.request

GOOD_SHA = "0216d7784cb00fe0436b403df7c97e7692f11f5b"
URL = (
    "https://raw.githubusercontent.com/esahuda9900/Esahuda-Rizqi-Nugraha/"
    + GOOD_SHA
    + "/scripts/pages_prepare_index.py"
)
print("pages_prepare bootstrap:", GOOD_SHA)
code = urllib.request.urlopen(URL, timeout=45).read().decode("utf-8", "replace")
for old in ("20261009-v12", "20261009-v13", "20261009-v14"):
    code = code.replace("sdlg-route-finish.js?v=" + old, "sdlg-route-finish.js?v=20261010-v15")
ns = {"__name__": "__main__", "__file__": str(Path(__file__).resolve())}
exec(compile(code, "pages_prepare_index.py(good)", "exec"), ns, ns)

INDEX = Path("_site/index.html")
data = INDEX.read_text(encoding="utf-8", errors="replace")

if "#/claim/' + encodeURIComponent(c.claim_id)" in data:
    data = data.replace(
        "#/claim/' + encodeURIComponent(c.claim_id)",
        "#/claims/' + encodeURIComponent(c.claim_id)",
    )

data = data.replace(
    "(?:sdlg-input|sdlginput|claim)\\/([^/?#]+)",
    "(?:sdlg-input|sdlginput|claims|claim)\\/([^/?#]+)",
)
data = data.replace(
    "(?:sdlg-input|sdlginput|claim)/([^/?#]+)",
    "(?:sdlg-input|sdlginput|claims|claim)/([^/?#]+)",
)

if "if (_hm) return decodeURIComponent(_hm[1]);" in data:
    data = data.replace(
        "if (_hm) return decodeURIComponent(_hm[1]);",
        'if (_hm) { var _seg = decodeURIComponent(_hm[1]); if (!/^\\d{4}$/.test(_seg)) return _seg; }',
        1,
    )

data = re.sub(
    r'var _ls = localStorage\.getItem\("sdlg-warranty:last-sdlginput-claim:v1"\)(?:\s*\|\|\s*localStorage\.getItem\("sdlg-warranty:last-claim:v1"\))?;\s*if \(_ls\) return String\(_ls\);?',
    "/* SAFETY: no LS cold-start claim id */",
    data,
)
data = data.replace(
    'var _ls = localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1") || localStorage.getItem("sdlg-warranty:last-claim:v1");  if (_ls) return String(_ls);',
    "/* SAFETY: no LS cold-start claim id */",
)
data = data.replace(
    'var _ls = localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1"); if (_ls) return String(_ls);',
    "/* SAFETY: no LS cold-start claim id */",
)

for frag in (
    ' || (typeof localStorage !== "undefined" && (localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1") || localStorage.getItem("sdlg-warranty:last-claim:v1")))',
    ' || (typeof localStorage !== "undefined" && (localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1")))',
    ' || (typeof localStorage !== "undefined" && localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1"))',
):
    if frag in data:
        data = data.replace(frag, "")
        print("stripped LS prop fragment")

data = data.replace(' || (claims.find(c => !c.archived_at)?.claim_id || "")', "")

needle = 'setSdlgInputClaimId(detail.claim_id); setTab("sdlginput"); setEditing(false);'
if needle in data:
    pos = data.find(needle)
    window = data[pos : pos + 450]
    if 'navigate("sdlg-input"' not in window and "navigate('sdlg-input'" not in window:
        data = data.replace(
            needle,
            needle
            + ' try { if (window.SDLGHashRouter && window.SDLGHashRouter.navigate) window.SDLGHashRouter.navigate("sdlg-input", { claimId: detail.claim_id }, { replace: true }); else { history.replaceState(null,"", location.pathname + location.search + "#/sdlg-input/" + encodeURIComponent(detail.claim_id)); } } catch(_nav){}',
            1,
        )
        print("detail open locks URL")

if "SDLGPortalInputPage, { claims, selectedClaimId:" in data and "key: String(sdlgInputClaimId" not in data:
    data = data.replace(
        "SDLGPortalInputPage, { claims, selectedClaimId:",
        'SDLGPortalInputPage, { key: String(sdlgInputClaimId || (typeof window !== "undefined" && window.SDLGHashRouter && window.SDLGHashRouter.claimId && window.SDLGHashRouter.claimId()) || "none"), claims, selectedClaimId:',
        1,
    )
    print("React key on portal page")

old_sel = 'onSelectClaim: (id) => { setSdlgInputClaimId(id); try { localStorage.setItem("sdlg-warranty:last-sdlginput-claim:v1", String(id||""));'
if old_sel in data:
    data = data.replace(
        old_sel,
        'onSelectClaim: (id) => { setSdlgInputClaimId(id); try { if (window.SDLGInputClaimSync && window.SDLGInputClaimSync.lockUrl) window.SDLGInputClaimSync.lockUrl(id); else if (window.SDLGHashRouter && window.SDLGHashRouter.navigate) window.SDLGHashRouter.navigate("sdlg-input", { claimId: id }, { replace: true }); localStorage.setItem("sdlg-warranty:last-sdlginput-claim:v1", String(id||""));',
        1,
    )
    print("onSelectClaim locks URL")

data = re.sub(r"sdlg-input-claim-sync\.js\?v=[^\"\s]+", "sdlg-input-claim-sync.js?v=20261012-v11", data)
if "sdlg-input-claim-sync.js" not in data:
    data = data.replace(
        "</body>",
        '  <script src="./modules/sdlg-input-claim-sync.js?v=20261012-v11" data-sdlg-input-claim-sync="1"></script>\n</body>',
        1,
    )

data = re.sub(
    r'src="\./modules/sdlg-repository\.js(?:\?v=[^"]*)?"',
    'src="./modules/sdlg-repository.js?v=20261010-v3"',
    data,
    count=1,
)
data = re.sub(
    r"sdlg-portal-finance-ux\.js(?:\?v=[^\"\s]*)?",
    "sdlg-portal-finance-ux.js?v=20261010-v4",
    data,
)

INDEX.write_text(data, encoding="utf-8")
print("SAFETY lock done")
print("  LS cold-start stripped:", "SAFETY: no LS cold-start" in data)
print("  first-claim gone:", "claims.find(c => !c.archived_at)?.claim_id" not in data)
print("  sync v11:", "sdlg-input-claim-sync.js?v=20261012-v11" in data)
print("  react key:", "key: String(sdlgInputClaimId" in data)
