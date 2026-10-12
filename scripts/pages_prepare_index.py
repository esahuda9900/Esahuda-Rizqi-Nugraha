#!/usr/bin/env python3
"""SDLG pages_prepare — liveClaim is the only portal field writer.

Do not add modules/sdlg-input-hydrate.js or sdlg-inline-enforcer.js.
Both force DOM fields on a timer and fight the React liveClaim state.
"""
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

# React owns portal fields. A second DOM writer is how the flicker started.
DEAD_HYDRATE = (
    "try { if (window.SDLGInputHydrate && window.SDLGInputHydrate.apply) "
    "window.SDLGInputHydrate.apply(row); } catch (_e) {}"
)
if DEAD_HYDRATE in data:
    data = data.replace(DEAD_HYDRATE, "")
    print("removed dead SDLGInputHydrate.apply")

# 1) liveClaim
OLD_SEL = (
    "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
    "    const selectedClaim = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;"
)
NEW_SEL = (
    "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
    "    const [liveClaim, setLiveClaim] = useState(null);\n"
    "    const [liveReady, setLiveReady] = useState(false);\n"
    "    const [liveError, setLiveError] = useState('');\n"
    "    useEffect(() => {\n"
    "        let alive = true;\n"
    "        const id = String(selectedClaimId || '').trim();\n"
    "        setLiveReady(false);\n"
    "        setLiveClaim(null);\n"
    "        setLiveError('');\n"
    "        // Clear shared consumers immediately; never let the previous claim leak into this selection.\n"
    "        try { window.__SDLG_LIVE_CLAIM__ = null; } catch (_e) {}\n"
    "        if (!id) { setLiveReady(true); return () => { alive = false; }; }\n"
    "        const client = (typeof window !== 'undefined' && window.getSdlgSupabase && window.getSdlgSupabase()) || null;\n"
    "        if (!client) { setLiveError('Database connection is unavailable. Do not copy or submit this claim.'); setLiveReady(true); return () => { alive = false; }; }\n"
    "        (async () => {\n"
    "            try {\n"
    "                const { data: row, error } = await client.from('claims').select('*').eq('claim_id', id).maybeSingle();\n"
    "                if (!alive) return;\n"
    "                if (error) { console.error('[SDLG portal] claim fetch failed', error); setLiveError('Could not load this claim from the database. Do not copy or submit; retry after checking the connection.'); return; }\n"
    "                if (!row || String(row.claim_id || '').trim() !== id) { setLiveError('Claim ID verification failed. Do not copy or submit this claim.'); return; }\n"
    "                setLiveClaim(row);\n"
    "                try { window.__SDLG_LIVE_CLAIM__ = row; } catch (_e) {}\n"
    "            } catch (e) { if (alive) { console.error('[SDLG portal] claim fetch failed', e); setLiveError('Could not load this claim from the database. Do not copy or submit; retry after checking the connection.'); } }\n"
    "            finally { if (alive) setLiveReady(true); }\n"
    "        })();\n"
    "        return () => { alive = false; };\n"
    "    }, [selectedClaimId]);\n"
    "    const requestedClaimId = String(selectedClaimId || '').trim();\n"
    "    const selectedClaim = liveClaim && String(liveClaim.claim_id || '').trim() === requestedClaimId ? liveClaim : null;\n"
    "    if (requestedClaimId && !selectedClaim) {\n"
    "        if (!liveReady || liveClaim) return React.createElement('div', { role: 'status', style: { margin: '16px', padding: '16px', border: '1px solid #94a3b8', borderRadius: '10px' } }, 'Loading and verifying claim data...');\n"
    "        return React.createElement('div', { role: 'alert', style: { margin: '16px', padding: '16px', border: '2px solid #b91c1c', borderRadius: '10px', background: '#fef2f2', color: '#7f1d1d', fontWeight: 700 } }, liveError || 'Claim data is not verified. Do not copy or submit.');\n"
    "    }\n"
)
OLD_LIVE_RE = re.compile(
    r"function SDLGPortalInputPage\(\{ claims, selectedClaimId, onSelectClaim, onBack \}\) \{\n"
    r".*?"
    r"const selectedClaim = liveClaim \|\| \(liveReady \? fromList : null\);",
    re.DOTALL,
)
if OLD_SEL in data:
    data = data.replace(OLD_SEL, NEW_SEL, 1)
    print("liveClaim: injected")
elif "requestedClaimId" in data and "Claim ID verification failed" in data:
    print("liveClaim: safety guard already present")
elif "setLiveClaim" in data:
    data, n = OLD_LIVE_RE.subn(lambda _m: NEW_SEL, data, count=1)
    if n != 1:
        raise SystemExit("FATAL: old liveClaim block detected but could not be upgraded safely")
    print("liveClaim: unsafe block upgraded")
else:
    raise SystemExit("FATAL: could not locate SDLGPortalInputPage claim selector; refusing an unverified build")

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

# Regression guard: these legacy timer scripts must not be dynamically loaded by claim-fields.
# The generated HTML check below cannot catch runtime script injection from another module.
CLAIM_FIELDS = Path("modules/claim-fields.js")
if CLAIM_FIELDS.exists():
    claim_fields_source = CLAIM_FIELDS.read_text(encoding="utf-8", errors="replace")
    if re.search(
        r"loadScript\(\s*['\"]\.\/modules\/sdlg-(?:input-hydrate|inline-enforcer)\.js",
        claim_fields_source,
    ):
        raise SystemExit("FATAL: claim-fields must not load timer-based SDLG DOM writers")

# Sanity
if re.search(r"replace\(/\[[\r\n]", data):
    raise SystemExit("FATAL: newline still inside regex character class")
if "sdlg-input-hydrate.js" in data or "sdlg-inline-enforcer.js" in data:
    raise SystemExit("FATAL: timer DOM writer must not be loaded")
# Fail the build if the generated SDLG form loses its claim-identity safety gates.
for needle in (
    "const requestedClaimId = String(selectedClaimId || '').trim();",
    "String(liveClaim.claim_id || '').trim() === requestedClaimId",
    "if (!alive) return;",
    "Claim ID verification failed",
):
    if needle not in data:
        raise SystemExit("FATAL: generated SDLG claim safety guard missing: " + needle)

FINANCE = Path("modules/sdlg-portal-finance-ux.js")
if FINANCE.exists():
    finance_source = FINANCE.read_text(encoding="utf-8", errors="replace")
    if "function verifiedLiveClaim()" not in finance_source or "var claim = verifiedLiveClaim();" not in finance_source:
        raise SystemExit("FATAL: SDLG finance calculations must verify the active claim ID")

ENRICH = Path("modules/sdlg-portal-enrich.js")
if ENRICH.exists():
    enrich_source = ENRICH.read_text(encoding="utf-8", errors="replace")
    if "getSelectedClaimId() !== expectedClaimId" not in enrich_source or "getSelectedClaimId() !== claimId" not in enrich_source:
        raise SystemExit("FATAL: async SDLG enrichment must verify the active claim before writing")

POLICY_REPAIR = Path("modules/sdlg-policy-repair-hardfix.js")
if POLICY_REPAIR.exists():
    policy_source = POLICY_REPAIR.read_text(encoding="utf-8", errors="replace")
    if "claimIdFromPage() !== id" not in policy_source:
        raise SystemExit("FATAL: async SDLG policy/repair data must verify the active claim before writing")

CANONICAL_MODULE = Path("modules/canonical-warranty-helper.js")
if CANONICAL_MODULE.exists():
    canonical_source = CANONICAL_MODULE.read_text(encoding="utf-8", errors="replace")
    if "if (scheduled || isPortalInputPage()) return;" not in canonical_source or "findClaimId() !== claimId" not in canonical_source:
        raise SystemExit("FATAL: legacy canonical helper must not write portal fields or stale claim data")

CLAIM_LOCK = Path("modules/sdlg-input-claim-lock.js")
if CLAIM_LOCK.exists():
    lock_source = CLAIM_LOCK.read_text(encoding="utf-8", errors="replace")
    if "root.SDLGInputHydrate.apply(c)" in lock_source or "root.SDLGInputHydrate.hydrate(" in lock_source:
        raise SystemExit("FATAL: claim-lock must not delegate portal writes to legacy hydration")

print("sanity: OK")

# Bust browser caches for modules whose claim-safety behavior changed.
CACHE_BUSTS = {
    "modules/claim-fields.js": "20261013-claim-integrity-v4",
    "modules/sdlg-input-claim-lock.js": "20261013-claim-integrity-v2",
    "modules/sdlg-portal-enrich.js": "20261013-claim-integrity-v2",
    "modules/sdlg-policy-repair-hardfix.js": "20261013-claim-integrity-v2",
    "modules/canonical-warranty-helper.js": "20261013-claim-integrity-v2",
}
for script_path, version in CACHE_BUSTS.items():
    src_pattern = re.compile(
        r'(<script\b[^>]*\bsrc=["\'][^"\']*?'
        + re.escape(script_path)
        + r')(?:\?[^"\']*)?(["\'])',
        re.IGNORECASE,
    )
    data, count = src_pattern.subn(lambda m: m.group(1) + "?v=" + version + m.group(2), data)
    if count:
        print("cache-busted", script_path, count)

# Normalize the root canonical helper tag in the actual Pages artifact.
# The source build script also enforces this, but GitHub Pages deploys _site directly.
data = re.sub(
    r'<script>\s*/\* SDLG_WARRANTY_HELPER_CANONICAL_V\d+ \*/\s*[\s\S]*?</script>\s*',
    '',
    data,
    flags=re.IGNORECASE,
)
canonical_tag_pattern = re.compile(
    r'<script\b[^>]*\bsrc=["\']/?canonical-warranty-helper\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>',
    re.IGNORECASE,
)
data = canonical_tag_pattern.sub('', data)
if "</body>" not in data:
    raise SystemExit("FATAL: cannot insert canonical helper tag; </body> missing")
data = data.replace(
    "</body>",
    '<script src="canonical-warranty-helper.js?v=20261013-v2"></script>\n</body>',
    1,
)
if len(canonical_tag_pattern.findall(data)) != 1:
    raise SystemExit("FATAL: canonical helper tag must appear exactly once in Pages artifact")

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare done", len(data))
print("setLiveClaim", "setLiveClaim" in data)
print("ok=function", "ok=function" in data)
print("_liveR", "const _liveR" in data)
