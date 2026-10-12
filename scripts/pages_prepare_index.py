#!/usr/bin/env python3
"""Deploy prepare — claim integrity + finance single panel + autocomplete off."""
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

if "const selectedClaim = liveClaim || fromList;" in data:
    data = data.replace(
        "const selectedClaim = liveClaim || fromList;",
        'const selectedClaim = liveClaim;\n'
        '    useEffect(() => {\n'
        '        if (liveClaim && window.SDLGInputClaimLock && window.SDLGInputClaimLock.applyClaim) {\n'
        '            try { window.SDLGInputClaimLock.applyClaim(liveClaim); } catch (_e) {}\n'
        '        }\n'
        '    }, [liveClaim]);',
        1,
    )

if "const [liveClaim, setLiveClaim]" not in data:
    OLD_SEL = (
        "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
        "    const selectedClaim = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;"
    )
    NEW_SEL = (
        "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
        "    const [liveClaim, setLiveClaim] = useState(null);\n"
        "    const [liveErr, setLiveErr] = useState(\"\");\n"
        "    useEffect(() => {\n"
        "        let alive = true; setLiveClaim(null); setLiveErr(\"\");\n"
        "        const id = String(selectedClaimId || \"\").trim();\n"
        "        if (!id) return undefined;\n"
        "        const client = (typeof sdlgSupabase !== \"undefined\" && sdlgSupabase) || (window.getSdlgSupabase && window.getSdlgSupabase()) || null;\n"
        "        if (!client) { setLiveErr(\"Supabase client not ready\"); return undefined; }\n"
        "        (async () => {\n"
        "            try {\n"
        "                const { data: row, error } = await client.from(\"claims\").select(\"*\").eq(\"claim_id\", id).maybeSingle();\n"
        "                if (!alive) return;\n"
        "                if (error) { setLiveErr(String(error.message || error)); return; }\n"
        "                if (row) setLiveClaim(row); else setLiveErr(\"Claim not found: \" + id);\n"
        "            } catch (e) { if (alive) setLiveErr(String(e && e.message || e)); }\n"
        "        })();\n"
        "        return () => { alive = false; };\n"
        "    }, [selectedClaimId]);\n"
        "    useEffect(() => {\n"
        "        if (liveClaim && window.SDLGInputClaimLock && window.SDLGInputClaimLock.applyClaim) {\n"
        "            try { window.SDLGInputClaimLock.applyClaim(liveClaim); } catch (_e) {}\n"
        "        }\n"
        "    }, [liveClaim]);\n"
        "    const selectedClaim = liveClaim;"
    )
    if OLD_SEL in data:
        data = data.replace(OLD_SEL, NEW_SEL, 1)

OLD_EMPTY = "if (!selectedClaim) {\n        const activeClaims = (claims || []).filter(c => !c.archived_at);"
NEW_EMPTY = (
    "if (!selectedClaim) {\n"
    "        if (selectedClaimId) {\n"
    "            return React.createElement(\"div\", { className: \"page\", \"data-sdlg-input-helper\": \"1\", style: { padding: 24 } },\n"
    "                React.createElement(\"div\", { style: { fontWeight: 800, marginBottom: 8 } }, \"Memuat data klaim\u2026\"),\n"
    "                React.createElement(\"div\", { style: { color: \"#64748b\", fontSize: 13 } }, String(selectedClaimId)),\n"
    "                (typeof liveErr !== \"undefined\" && liveErr) ? React.createElement(\"div\", { style: { color: \"#b91c1c\", marginTop: 8 } }, liveErr) : null,\n"
    "                React.createElement(\"button\", { className: \"secondary-btn\", style: { marginTop: 12 }, onClick: onBack }, \"\u2190 Kembali\"));\n"
    "        }\n"
    "        const activeClaims = (claims || []).filter(c => !c.archived_at);"
)
if OLD_EMPTY in data and "Memuat data klaim" not in data:
    data = data.replace(OLD_EMPTY, NEW_EMPTY, 1)

# autocomplete off
data = data.replace(
    'type="text" value="${esc(value)}" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
    'type="text" value="${esc(value)}" autocomplete="off" data-lpignore="true" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
)

data = re.sub(r"sdlg-input-claim-lock\.js\?v=[^\"\s]+", "sdlg-input-claim-lock.js?v=20261012-v12", data)
data = re.sub(r"sdlg-portal-finance-ux\.js\?v=[^\"\s]+", "sdlg-portal-finance-ux.js?v=20261012-v5", data)
if "sdlg-input-claim-lock.js" not in data:
    data = data.replace(
        "</body>",
        '  <script src="./modules/sdlg-input-claim-lock.js?v=20261012-v12" data-sdlg-input-claim-lock="1"></script>\n</body>',
        1,
    )
if "sdlg-portal-finance-ux.js" not in data:
    data = data.replace(
        "</body>",
        '  <script src="./modules/sdlg-portal-finance-ux.js?v=20261012-v5" data-sdlg-finance="1"></script>\n</body>',
        1,
    )

INDEX.write_text(data, encoding="utf-8")
print("prepare done")
