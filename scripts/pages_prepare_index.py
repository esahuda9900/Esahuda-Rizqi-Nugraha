#!/usr/bin/env python3
"""Prepare Pages: route-bound live claim and SDLG Input writer guard."""
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
NEW_SEL = r'''
function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {
    const liveClaimRouteId = (() => {
        try {
            const router = window.SDLGHashRouter;
            const routed = router && typeof router.claimId === "function" ? String(router.claimId() || "").trim() : "";
            if (routed) return routed;
        } catch (_e) {}
        try {
            const hash = String((window.location && window.location.hash) || "");
            const match = hash.match(/(?:^|#?\/)(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i);
            return match ? decodeURIComponent(match[1]).trim() : "";
        } catch (_e) { return ""; }
    })();
    const routeIdIsClaim = /^\d{3,4}-\d{4}-SDLG-PFR$/i.test(liveClaimRouteId);
    const effectiveClaimId = (routeIdIsClaim ? liveClaimRouteId : String(selectedClaimId || "").trim()).toUpperCase();
    const [liveClaim, setLiveClaim] = useState(null);
    const [liveReady, setLiveReady] = useState(false);
    const [liveError, setLiveError] = useState("");
    const [liveErrorClaimId, setLiveErrorClaimId] = useState("");

    useEffect(() => {
        let alive = true;
        const id = String(effectiveClaimId || "").trim().toUpperCase();
        setLiveReady(false);
        setLiveClaim(null);
        setLiveError("");
        setLiveErrorClaimId("");
        try {
            window.__SDLG_LIVE_CLAIM__ = null;
            window.__SDLG_LIVE_CLAIM_ERROR__ = null;
        } catch (_e) {}

        if (!/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(id)) {
            setLiveError("Claim ID tidak valid. Pilih claim yang benar lalu buka ulang halaman Input.");
            setLiveErrorClaimId(id);
            setLiveReady(true);
            return () => { alive = false; };
        }

        const client = (typeof window !== "undefined" && window.getSdlgSupabase && window.getSdlgSupabase()) || null;
        if (!client || typeof client.from !== "function") {
            const message = "Koneksi Supabase belum tersedia. Muat ulang halaman setelah login.";
            setLiveError(message);
            setLiveErrorClaimId(id);
            try { window.__SDLG_LIVE_CLAIM_ERROR__ = { claimId: id, message: message }; } catch (_e) {}
            setLiveReady(true);
            return () => { alive = false; };
        }

        (async () => {
            try {
                const { data: row, error } = await client.from("claims").select("*").eq("claim_id", id).maybeSingle();
                if (!alive) return;
                if (error) {
                    const message = String(error.message || error).slice(0, 240);
                    console.warn("[SDLG portal] live claim fetch failed", id, error);
                    setLiveError("Gagal memuat claim " + id + ": " + message);
                    setLiveErrorClaimId(id);
                    try { window.__SDLG_LIVE_CLAIM_ERROR__ = { claimId: id, message: message }; } catch (_e) {}
                    return;
                }
                if (!row || String(row.claim_id || "").trim().toUpperCase() !== id) {
                    const message = "Claim " + id + " tidak ditemukan di database. Data list lama tidak digunakan.";
                    setLiveError(message);
                    setLiveErrorClaimId(id);
                    try { window.__SDLG_LIVE_CLAIM_ERROR__ = { claimId: id, message: message }; } catch (_e) {}
                    return;
                }

                setLiveClaim(row);
                try {
                    window.__SDLG_LIVE_CLAIM__ = row;
                    window.__SDLG_LIVE_CLAIM_ERROR__ = null;
                    window.dispatchEvent(new CustomEvent("sdlg-live-claim-ready", { detail: { claimId: id, claim: row } }));
                } catch (_e) {}
            } catch (e) {
                if (!alive) return;
                const message = String((e && e.message) || e || "Unknown error").slice(0, 240);
                console.warn("[SDLG portal] live claim fetch failed", id, e);
                setLiveError("Gagal memuat claim " + id + ": " + message);
                setLiveErrorClaimId(id);
                try { window.__SDLG_LIVE_CLAIM_ERROR__ = { claimId: id, message: message }; } catch (_e) {}
            } finally {
                if (alive) setLiveReady(true);
            }
        })();

        return () => { alive = false; };
    }, [effectiveClaimId]);

    const selectedClaim = liveReady && liveClaim &&
        String(liveClaim.claim_id || "").trim().toUpperCase() === effectiveClaimId
        ? liveClaim : null;

    // Loading and error states render directly from React below.

'''
if OLD_SEL in data:
    data = data.replace(OLD_SEL, NEW_SEL, 1)
    print("liveClaim: route-bound fetch injected")
else:
    # Upgrade a previously baked liveClaim block instead of preserving its list fallback.
    old_live_pattern = re.compile(
        r"function SDLGPortalInputPage\(\{ claims, selectedClaimId, onSelectClaim, onBack \}\) \{"
        r"[\s\S]*?const selectedClaim = liveClaim \|\| \(liveReady \? fromList : null\);",
        re.MULTILINE,
    )
    data, upgraded = old_live_pattern.subn(lambda _m: NEW_SEL, data, count=1)
    if upgraded:
        print("liveClaim: old fallback replaced")
    elif "const effectiveClaimId =" in data and "sdlg-live-claim-ready" in data:
        print("liveClaim: route-bound fetch already present")
    else:
        raise SystemExit("FATAL: cannot secure SDLG Input claim selection; refusing unsafe deploy")


# 1b) Render a real skeleton while the route-bound claim fetch is pending.
OLD_EMPTY_CLAIM = (
    "if (!selectedClaim) {\n"
    "        const activeClaims = (claims || []).filter(c => !c.archived_at);"
)
NEW_EMPTY_CLAIM = r'''
if (!selectedClaim) {
        if (/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(effectiveClaimId) && (!liveReady || (!selectedClaim && liveErrorClaimId !== effectiveClaimId))) {
            const skeleton = (height, width) => React.createElement("div", {
                style: { height, width, maxWidth: "100%", borderRadius: 8, background: "#e9edf2", margin: "10px 0" }
            });
            return React.createElement("div", {
                className: "page",
                role: "status",
                "aria-live": "polite",
                style: { maxWidth: 960, margin: "0 auto", padding: "24px 16px" }
            }, React.createElement("div", { className: "card card-pad", style: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 22 } },
                React.createElement("div", { className: "eyebrow" }, "SDLG Dealer Portal"),
                React.createElement("div", { className: "page-title" }, "SDLG Input Helper"),
                React.createElement("p", { style: { fontSize: 13, color: "#64748b", margin: "8px 0 20px" } },
                    "Memuat data terbaru untuk " + effectiveClaimId + "…"),
                skeleton(16, "42%"),
                skeleton(42, "100%"),
                skeleton(42, "100%"),
                skeleton(80, "100%"),
                React.createElement("p", { style: { fontSize: 12, color: "#64748b" } }, "Form belum ditampilkan sampai claim terverifikasi dari Supabase.")
            ));
        }
        if (/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(effectiveClaimId) && liveReady && liveErrorClaimId === effectiveClaimId && liveError) {
            return React.createElement("div", {
                className: "page",
                style: { maxWidth: 760, margin: "0 auto", padding: "24px 16px" }
            }, React.createElement("div", {
                className: "card card-pad",
                role: "alert",
                style: { border: "1px solid #fecaca", borderRadius: 14, padding: 22, background: "#fff" }
            },
                React.createElement("div", { className: "eyebrow", style: { color: "#b91c1c" } }, "SDLG Dealer Portal"),
                React.createElement("div", { className: "page-title" }, "Data claim gagal dimuat"),
                React.createElement("p", { style: { fontSize: 13, lineHeight: 1.6, color: "#475569" } },
                    "Claim " + effectiveClaimId + " belum dapat diverifikasi. Jangan salin data dari halaman ini."),
                React.createElement("p", { style: { fontSize: 12, lineHeight: 1.6, color: "#991b1b", overflowWrap: "anywhere" } }, liveError),
                React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 } },
                    React.createElement("button", { className: "primary-btn", onClick: () => window.location.reload() }, "Coba lagi"),
                    React.createElement("button", { className: "secondary-btn", onClick: () => onSelectClaim("") }, "Pilih claim lain")
                )
            ));
        }
        const activeClaims = (claims || []).filter(c => !c.archived_at);'''

if OLD_EMPTY_CLAIM in data:
    data = data.replace(OLD_EMPTY_CLAIM, NEW_EMPTY_CLAIM, 1)
    print("liveClaim: real skeleton/error rendering injected")
elif 'Memuat data terbaru untuk " + effectiveClaimId' in data and 'Data claim gagal dimuat' in data:
    print("liveClaim: skeleton/error rendering already present")
else:
    raise SystemExit("FATAL: cannot insert fail-closed React loading/error states")

# The form mount is delayed until the live row arrives. Rebind copy controls on
# verified row arrival/claim switch, otherwise the original effect can run too early.
OLD_HANDLER_DEP = "    }, [selectedClaimId, warrantyMatrix]);"
NEW_HANDLER_DEP = "    }, [effectiveClaimId, selectedClaim?.claim_id, warrantyMatrix]);"
if OLD_HANDLER_DEP in data:
    data = data.replace(OLD_HANDLER_DEP, NEW_HANDLER_DEP, 1)
    print("copy handlers: depend on live claim identity")
elif NEW_HANDLER_DEP in data:
    print("copy handlers: dependency already patched")
else:
    raise SystemExit("FATAL: cannot secure SDLG Input copy handlers for delayed live row")

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


# 5) Remove any previously baked enforcer script. React owns the report/date/location UI.
data, removed_legacy = re.subn(
    r"<script\b(?=[^>]*data-sdlg-inline-enforcer-legacy)[^>]*>[\s\S]*?</script\s*>",
    "",
    data,
    flags=re.IGNORECASE,
)
data, removed_direct_inline = re.subn(
    r"<script\b(?=[^>]*\bsrc=[\"'][^\"']*modules/sdlg-inline-enforcer\.js)[^>]*>[\s\S]*?</script\s*>",
    "",
    data,
    flags=re.IGNORECASE,
)
data, removed_direct_hydrate = re.subn(
    r"<script\b(?=[^>]*\bsrc=[\"'][^\"']*modules/sdlg-input-hydrate\.js)[^>]*>[\s\S]*?</script\s*>",
    "",
    data,
    flags=re.IGNORECASE,
)
if "data-sdlg-inline-enforcer-legacy" in data:
    raise SystemExit("FATAL: duplicate inline enforcer still present")
if "setLiveClaim(fromList)" in data or "liveReady ? fromList : null" in data:
    raise SystemExit("FATAL: stale list fallback remains in SDLG Input")

# Cache-bust the module loader so browsers do not reuse an older claim-fields.js
# that still loads duplicate DOM writers.
data = re.sub(
    r'''((?:\./|/)?modules/claim-fields\.js)(?:\?[^"'\s>]*)?''',
    r'\1?v=20261012-single-writer-v1',
    data,
)
if "modules/claim-fields.js?v=20261012-single-writer-v1" not in data:
    raise SystemExit("FATAL: claim-fields cache-bust marker missing")


# Sanity
if re.search(r"replace\(/\[[\r\n]", data):
    raise SystemExit("FATAL: newline still inside regex character class")
if "const effectiveClaimId =" not in data or "sdlg-live-claim-ready" not in data:
    raise SystemExit("FATAL: route-bound live claim guard missing")
if 'Memuat data terbaru untuk " + effectiveClaimId' not in data:
    raise SystemExit("FATAL: actual React loading skeleton missing")
if 'Data claim gagal dimuat' not in data:
    raise SystemExit("FATAL: fail-closed React error state missing")
if "effectiveClaimId, selectedClaim?.claim_id, warrantyMatrix" not in data:
    raise SystemExit("FATAL: copy handler lifecycle is not bound to the live claim")
print("sanity: OK")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare done", len(data))
print("setLiveClaim", "setLiveClaim" in data)
print("ok=function", "ok=function" in data)
print("_liveR", "const _liveR" in data)
