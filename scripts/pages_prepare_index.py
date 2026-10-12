#!/usr/bin/env python3
"""SDLG pages_prepare — React-owned live claim, loading/error states, year-safe repairDate."""
from pathlib import Path
import re

INDEX = Path("_site/index.html")
if not INDEX.exists():
    raise SystemExit("missing _site/index.html")
data = INDEX.read_text(encoding="utf-8", errors="replace")

# 0) Fix broken reportComplaintRaw (real newline inside /[...]/)
GOOD = (
    "const reportComplaintRaw = String((_liveR && _liveR.fault_description) || "
    "selectedClaim.fault_description || \"\").trim()"
    ".replace(/[\\r\\n]+/g, \" \").replace(/\\s{2,}/g, \" \");"
)

def _fix_broken(s):
    pat = re.compile(
        r"const reportComplaintRaw = String\((?:.|\n)*?\)\.trim\(\)"
        r"\.replace\(/\[[\r\n \t]+\]\+/g,\s*\" \""
        r"(?:\.replace\(/\\s\{2,\}/g,\s*\" \")?;",
        re.MULTILINE,
    )
    s2, n = pat.subn(lambda m: GOOD, s, count=3)
    if n:
        print("broken complaint fixed:", n)
        return s2
    s2, n2 = re.subn(
        r"\.replace\(/\[[\r\n \t]+\]\+/g,\s*\" \"",
        lambda m: ".replace(/[\\r\\n]+/g, \" \"",
        s,
    )
    if n2:
        print("lone class fixes:", n2)
    return s2

data = _fix_broken(data)

# 1) liveClaim
OLD_SEL = (
    "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
    "    const selectedClaim = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;"
)
NEW_SEL = (
    "function useLiveClaim(claimId, retryToken) {\n"
    "    const [routeHash, setRouteHash] = useState(() => String((typeof window !== \"undefined\" && window.location && window.location.hash) || \"\"));\n"
    "    useEffect(() => {\n"
    "        const onHashChange = () => setRouteHash(String((window.location && window.location.hash) || \"\"));\n"
    "        window.addEventListener(\"hashchange\", onHashChange);\n"
    "        return () => window.removeEventListener(\"hashchange\", onHashChange);\n"
    "    }, []);\n"
    "    const routeClaimId = (() => {\n"
    "        try {\n"
    "            const match = String(routeHash || \"\").match(/^#?\\/?(?:sdlg-input|sdlginput)\\/([^/?#]+)/i);\n"
    "            const value = match ? decodeURIComponent(match[1]).trim() : \"\";\n"
    "            return /^\\d{3,4}-\\d{4}-SDLG-PFR$/i.test(value) ? value : \"\";\n"
    "        } catch (_e) { return \"\"; }\n"
    "    })();\n"
    "    const requestedId = String(routeClaimId || claimId || \"\").trim().toUpperCase();\n"
    "    const [state, setState] = useState({ claimId: \"\", status: \"idle\", row: null, error: \"\" });\n"
    "    useEffect(() => {\n"
    "        let alive = true;\n"
    "        const id = requestedId;\n"
    "        if (!id) {\n"
    "            setState({ claimId: \"\", status: \"idle\", row: null, error: \"\" });\n"
    "            try { window.__SDLG_LIVE_CLAIM__ = null; window.__SDLG_LIVE_CLAIM_ERROR__ = null; } catch (_e) {}\n"
    "            return () => { alive = false; };\n"
    "        }\n"
    "        setState({ claimId: id, status: \"loading\", row: null, error: \"\" });\n"
    "        try { window.__SDLG_LIVE_CLAIM__ = null; window.__SDLG_LIVE_CLAIM_ERROR__ = null; } catch (_e) {}\n"
    "        if (!/^\\d{3,4}-\\d{4}-SDLG-PFR$/i.test(id)) {\n"
    "            const message = \"Claim ID tidak valid. Pilih claim yang benar lalu buka ulang halaman Input.\";\n"
    "            setState({ claimId: id, status: \"error\", row: null, error: message });\n"
    "            try { window.__SDLG_LIVE_CLAIM_ERROR__ = { claimId: id, message: message }; } catch (_e) {}\n"
    "            return () => { alive = false; };\n"
    "        }\n"
    "        let client = null;\n"
    "        try { client = (typeof window.getSdlgSupabase === \"function\") ? window.getSdlgSupabase() : null; } catch (_e) {}\n"
    "        if (!client || typeof client.from !== \"function\") {\n"
    "            const message = \"Koneksi Supabase belum tersedia. Muat ulang halaman setelah login.\";\n"
    "            setState({ claimId: id, status: \"error\", row: null, error: message });\n"
    "            try { window.__SDLG_LIVE_CLAIM_ERROR__ = { claimId: id, message: message }; } catch (_e) {}\n"
    "            return () => { alive = false; };\n"
    "        }\n"
    "        (async () => {\n"
    "            try {\n"
    "                const { data: row, error } = await client.from(\"claims\").select(\"*\").eq(\"claim_id\", id).maybeSingle();\n"
    "                if (error) throw error;\n"
    "                if (!row || String(row.claim_id || \"\").trim().toUpperCase() !== id) {\n"
    "                    throw new Error(\"Claim tidak ditemukan atau Claim ID hasil query tidak cocok.\");\n"
    "                }\n"
    "                if (!alive) return;\n"
    "                window.__SDLG_LIVE_CLAIM__ = row;\n"
    "                window.__SDLG_LIVE_CLAIM_ERROR__ = null;\n"
    "                setState({ claimId: id, status: \"ready\", row: row, error: \"\" });\n"
    "            } catch (error) {\n"
    "                if (!alive) return;\n"
    "                const detail = String((error && error.message) || error || \"Unknown error\").slice(0, 180);\n"
    "                const message = \"Data klaim live gagal dimuat. Periksa koneksi, sesi login, dan izin akses.\";\n"
    "                console.warn(\"[SDLG portal] live claim fetch failed\", id, detail);\n"
    "                window.__SDLG_LIVE_CLAIM__ = null;\n"
    "                window.__SDLG_LIVE_CLAIM_ERROR__ = { claimId: id, message: detail };\n"
    "                setState({ claimId: id, status: \"error\", row: null, error: message });\n"
    "            }\n"
    "        })();\n"
    "        return () => { alive = false; };\n"
    "    }, [requestedId, retryToken]);\n"
    "    const isCurrent = !!requestedId && String(state.claimId || \"\").toUpperCase() === requestedId;\n"
    "    const row = isCurrent && state.status === \"ready\" && state.row &&\n"
    "        String(state.row.claim_id || \"\").trim().toUpperCase() === requestedId ? state.row : null;\n"
    "    return {\n"
    "        claim: row,\n"
    "        status: requestedId ? (isCurrent ? state.status : \"loading\") : \"idle\",\n"
    "        error: isCurrent ? state.error : \"\",\n"
    "        claimId: requestedId\n"
    "    };\n"
    "}\n"
    "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
    "    const [liveRetry, setLiveRetry] = useState(0);\n"
    "    const live = useLiveClaim(selectedClaimId, liveRetry);\n"
    "    const currentClaimId = live.claimId;\n"
    "    const selectedClaim = live.claim;\n"
)
if OLD_SEL in data:
    data = data.replace(OLD_SEL, NEW_SEL, 1)
    print("liveClaim: injected")
elif "function useLiveClaim(claimId, retryToken)" in data:
    print("liveClaim: already present")
else:
    raise SystemExit("FATAL: cannot secure SDLG Input live claim source; refusing unsafe deploy")


# 1b) Loading/error states: a selected claim must never fall back to list cache.
OLD_EMPTY = "    if (!selectedClaim) {\n"
NEW_EMPTY = (
    "    if (currentClaimId && live.status === \"loading\") {\n"
    "        return React.createElement(\"div\", { className: \"page\", \"data-sdlg-live-loading\": \"true\", role: \"status\", \"aria-busy\": \"true\" },\n"
    "            React.createElement(\"div\", { className: \"card card-pad\", style: { maxWidth: 640, margin: \"30px auto\", padding: 22 } },\n"
    "                React.createElement(\"div\", { className: \"eyebrow\" }, \"SDLG Dealer Portal\"),\n"
    "                React.createElement(\"div\", { className: \"page-title\", style: { fontSize: 20 } }, \"Memuat data klaim…\"),\n"
    "                React.createElement(\"p\", { style: { marginTop: 10, fontSize: 13, color: \"#64748b\", lineHeight: 1.5 } }, \"Sedang mengambil data terbaru dari Supabase untuk \" + currentClaimId + \". Data dari list tidak ditampilkan sebagai pengganti.\"),\n"
    "                React.createElement(\"div\", { \"aria-hidden\": \"true\", style: { height: 8, marginTop: 18, borderRadius: 8, background: \"#e2e8f0\", overflow: \"hidden\" } },\n"
    "                    React.createElement(\"div\", { style: { height: \"100%\", width: \"42%\", borderRadius: 8, background: \"#2563eb\" } })\n"
    "                )\n"
    "            )\n"
    "        );\n"
    "    }\n"
    "    if (currentClaimId && live.status === \"error\") {\n"
    "        return React.createElement(\"div\", { className: \"page\", \"data-sdlg-live-error\": \"true\", role: \"alert\" },\n"
    "            React.createElement(\"div\", { className: \"card card-pad\", style: { maxWidth: 640, margin: \"30px auto\", padding: 22, borderColor: \"#fecaca\" } },\n"
    "                React.createElement(\"div\", { className: \"eyebrow\", style: { color: \"#b91c1c\" } }, \"SDLG Dealer Portal\"),\n"
    "                React.createElement(\"div\", { className: \"page-title\", style: { fontSize: 20 } }, \"Data klaim belum tersedia\"),\n"
    "                React.createElement(\"p\", { style: { marginTop: 10, fontSize: 13, color: \"#475569\", lineHeight: 1.5 } }, live.error || \"Data dari Supabase belum terverifikasi. Data cache tidak digunakan.\"),\n"
    "                React.createElement(\"div\", { style: { display: \"flex\", gap: 8, flexWrap: \"wrap\", marginTop: 18 } },\n"
    "                    React.createElement(\"button\", { type: \"button\", className: \"primary-btn\", onClick: () => setLiveRetry(n => n + 1) }, \"Coba Lagi\"),\n"
    "                    React.createElement(\"button\", { type: \"button\", className: \"secondary-btn\", onClick: onBack }, \"Kembali\")\n"
    "                )\n"
    "            )\n"
    "        );\n"
    "    }\n"
    "    if (!selectedClaim) {\n"
    "        const activeClaims = (claims || []).filter(c => !c.archived_at);\n"
)
if "data-sdlg-live-loading" in data and "data-sdlg-live-error" in data:
    print("live-only loading/error states: already present")
elif OLD_EMPTY in data:
    data = data.replace(OLD_EMPTY, NEW_EMPTY, 1)
    print("live-only loading/error states: injected")
else:
    raise SystemExit("FATAL: live-only loading/error states not injected")

# Rebind DOM copy handlers after the live row replaces the loading skeleton.
OLD_COPY_EFFECT = "    }, [selectedClaimId, warrantyMatrix]);"
NEW_COPY_EFFECT = "    }, [selectedClaimId, warrantyMatrix, selectedClaim]);"
if OLD_COPY_EFFECT in data:
    data = data.replace(OLD_COPY_EFFECT, NEW_COPY_EFFECT, 1)
    print("copy handlers: track live selectedClaim")
elif NEW_COPY_EFFECT in data:
    print("copy handlers: already track live selectedClaim")
else:
    raise SystemExit("FATAL: could not update SDLG Input copy-effect dependencies")

# 2) year-safe repairDate
OLD_RD = "repairDate: portalDate(selectedClaim.dealer_repair_date || selectedClaim.completion_date || selectedClaim.failure_date),"
NEW_RD = (
    "repairDate: (function(){"
    "var id=String(selectedClaim.claim_id||'');"
    "var ok=function(v){if(v==null||String(v).trim()==='')return null;"
    "var fmt=portalDate(v);if(!fmt)return null;"
    "if(/19[\\/\\-]0?7[\\/\\-]2024/.test(fmt)&&id!=='0429-2024-SDLG-PFR')return null;"
    "var cy=(id.match(/-(\\d{4})-SDLG-PFR/i)||[])[1];"
    "var dy=(fmt.match(/(\\d{4})$/)||[])[1];"
    "if(cy&&dy&&Math.abs(Number(cy)-Number(dy))>1)return null;"
    "return fmt;};"
    "return ok(selectedClaim.dealer_repair_date)||ok(selectedClaim.completion_date)||ok(selectedClaim.repair_date)||ok(selectedClaim.failure_date)||'';"
    "})(),"
)
if OLD_RD in data:
    data = data.replace(OLD_RD, NEW_RD, 1)
    print("year-safe: applied")
elif "ok=function" in data:
    print("year-safe: already present")
else:
    print("year-safe: WARN not found")

# 3) machineLocation
_old_loc = 'const machineLocation = [wo, branch, customer].map(v => String(v || "").trim()).filter(Boolean).join(" ");'
if _old_loc in data:
    data = data.replace(
        _old_loc,
        'const _liveForLoc = (typeof window !== "undefined" && window.__SDLG_LIVE_CLAIM__ && selectedClaim '
        '&& window.__SDLG_LIVE_CLAIM__.claim_id === selectedClaim.claim_id) ? window.__SDLG_LIVE_CLAIM__ : selectedClaim;\n'
        '    const _woL = String((_liveForLoc && (_liveForLoc.dealer_wo_so || _liveForLoc.wo_so)) || wo || "").trim();\n'
        '    const _brL = String((_liveForLoc && _liveForLoc.branch) || branch || "").trim();\n'
        '    const _cuL = String((_liveForLoc && _liveForLoc.customer) || customer || "").trim();\n'
        '    const machineLocation = [_woL, _brL, _cuL].filter(Boolean).join(" ");',
        1,
    )
    print("machineLocation: patched")

# 4) _liveR for report
if "const _liveR =" not in data:
    _anchor = 'const reportWo = String(selectedClaim.dealer_wo_so || selectedClaim.wo_so || "").trim();'
    if _anchor in data:
        data = data.replace(
            _anchor,
            'const _liveR = (typeof window !== "undefined" && window.__SDLG_LIVE_CLAIM__ && selectedClaim '
            '&& window.__SDLG_LIVE_CLAIM__.claim_id === selectedClaim.claim_id) ? window.__SDLG_LIVE_CLAIM__ : selectedClaim;\n'
            '    const reportWo = String((_liveR && (_liveR.dealer_wo_so || _liveR.wo_so)) || selectedClaim.dealer_wo_so || selectedClaim.wo_so || "").trim();',
            1,
        )
        print("_liveR: injected")
    if 'const reportModel = String(selectedClaim.model || "").trim();' in data:
        data = data.replace(
            'const reportModel = String(selectedClaim.model || "").trim();',
            'const reportModel = String((_liveR && _liveR.model) || selectedClaim.model || "").trim();',
            1,
        )
    if 'const reportHm = numberText(selectedClaim.hm_failure) || "";' in data:
        data = data.replace(
            'const reportHm = numberText(selectedClaim.hm_failure) || "";',
            'const reportHm = numberText((_liveR && _liveR.hm_failure) != null ? _liveR.hm_failure : selectedClaim.hm_failure) || "";',
            1,
        )


# 5) cache-bust the loader whose old version injected competing DOM writers
OLD_CLAIM_FIELDS_TAG = '<script src="./modules/claim-fields.js"></script>'
NEW_CLAIM_FIELDS_TAG = '<script src="./modules/claim-fields.js?v=20261012-live-only"></script>'
if OLD_CLAIM_FIELDS_TAG in data:
    data = data.replace(OLD_CLAIM_FIELDS_TAG, NEW_CLAIM_FIELDS_TAG, 1)
    print("claim-fields loader: cache-busted")
elif NEW_CLAIM_FIELDS_TAG in data:
    print("claim-fields loader: already cache-busted")
else:
    raise SystemExit("FATAL: could not locate claim-fields.js script tag")

# Sanity
if re.search(r"replace\(/\[[\r\n]", data):
    raise SystemExit("FATAL: newline still inside regex character class")
print("sanity: OK")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare done", len(data))
print("setLiveClaim", "setLiveClaim" in data)
print("ok=function", "ok=function" in data)
print("_liveR", "const _liveR" in data)
