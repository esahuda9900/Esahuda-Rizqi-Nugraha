#!/usr/bin/env python3
"""Deploy prepare — claim safety: fresh Supabase hydrate + no LS auto-select."""
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
for frag in (
    ' || (typeof localStorage !== "undefined" && (localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1") || localStorage.getItem("sdlg-warranty:last-claim:v1")))',
    ' || (typeof localStorage !== "undefined" && (localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1")))',
    ' || (typeof localStorage !== "undefined" && localStorage.getItem("sdlg-warranty:last-sdlginput-claim:v1"))',
    ' || (claims.find(c => !c.archived_at)?.claim_id || "")',
):
    data = data.replace(frag, "")

OLD_SEL = "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n    const selectedClaim = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;"
NEW_SEL = (
    "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
    "    const fromList = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;\n"
    "    const [liveClaim, setLiveClaim] = useState(null);\n"
    "    useEffect(() => {\n"
    "        let alive = true;\n"
    "        setLiveClaim(null);\n"
    "        const id = String(selectedClaimId || \"\").trim();\n"
    "        if (!id || typeof sdlgSupabase === \"undefined\" || !sdlgSupabase) return undefined;\n"
    "        (async () => {\n"
    "            try {\n"
    "                const { data, error } = await sdlgSupabase.from(\"claims\").select(\"*\").eq(\"claim_id\", id).maybeSingle();\n"
    "                if (!alive) return;\n"
    "                if (error) { console.warn(\"[SDLG] live claim fetch\", error); return; }\n"
    "                if (data) setLiveClaim(data);\n"
    "            } catch (e) { console.warn(\"[SDLG] live claim fetch\", e); }\n"
    "        })();\n"
    "        return () => { alive = false; };\n"
    "    }, [selectedClaimId]);\n"
    "    const selectedClaim = liveClaim || fromList;"
)
if OLD_SEL in data and "const [liveClaim, setLiveClaim]" not in data:
    data = data.replace(OLD_SEL, NEW_SEL, 1)
    print("injected liveClaim Supabase fetch")
else:
    print("WARN liveClaim inject", OLD_SEL in data)

OLD_HTML = 'React.createElement("div", { dangerouslySetInnerHTML: { __html: html } })'
NEW_HTML = 'React.createElement("div", { key: "portal-html-" + String(selectedClaimId || (selectedClaim && selectedClaim.claim_id) || "none"), "data-sdlg-input-helper": "1", dangerouslySetInnerHTML: { __html: html } })'
if OLD_HTML in data and 'key: "portal-html-"' not in data:
    data = data.replace(OLD_HTML, NEW_HTML, 1)
    print("keyed portal html host")

old_sel = 'onSelectClaim: (id) => { setSdlgInputClaimId(id); try { localStorage.setItem("sdlg-warranty:last-sdlginput-claim:v1", String(id||""));'
if old_sel in data and "SDLGInputClaimLock" not in data[data.find("onSelectClaim: (id)"): data.find("onSelectClaim: (id)")+350]:
    data = data.replace(
        old_sel,
        'onSelectClaim: (id) => { setSdlgInputClaimId(id); try { if (window.SDLGInputClaimLock) window.SDLGInputClaimLock.hydrate(id); if (window.SDLGInputClaimSync && window.SDLGInputClaimSync.lockUrl) window.SDLGInputClaimSync.lockUrl(id); else if (window.SDLGHashRouter && window.SDLGHashRouter.navigate) window.SDLGHashRouter.navigate("sdlg-input", { claimId: id }, { replace: true }); localStorage.setItem("sdlg-warranty:last-sdlginput-claim:v1", String(id||""));',
        1,
    )
    print("onSelectClaim hydrates + locks URL")

for src, tag in [
    ("sdlg-input-claim-sync.js?v=20261012-v11", "data-sdlg-input-claim-sync"),
    ("sdlg-input-claim-lock.js?v=20261012-v1", "data-sdlg-input-claim-lock"),
]:
    base = src.split("?")[0]
    if base not in data:
        data = data.replace(
            "</body>",
            f'  <script src="./modules/{src}" {tag}="1"></script>\n</body>',
            1,
        )
        print("injected", src)
    else:
        data = re.sub(re.escape(base) + r"\?v=[^\"\s]+", src, data)

data = re.sub(
    r'src="\./modules/sdlg-repository\.js(?:\?v=[^"]*)?"',
    'src="./modules/sdlg-repository.js?v=20261010-v3"',
    data,
    count=1,
)

INDEX.write_text(data, encoding="utf-8")
print("SAFETY live-claim lock done")
print(" liveClaim:", "setLiveClaim" in data)
print(" portal-html key:", "portal-html-" in data)
print(" claim-lock script:", "sdlg-input-claim-lock.js" in data)
