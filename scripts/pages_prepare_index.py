#!/usr/bin/env python3
"""Bake: liveClaim fetch + year-safe repair + fix broken regex + enforcer."""
from pathlib import Path
import re

INDEX = Path("_site/index.html")
if not INDEX.exists():
    raise SystemExit("missing _site/index.html")

data = INDEX.read_text(encoding="utf-8", errors="replace")

# ============================================================================
# 0) FIX BROKEN reportComplaintRaw regex (literal newline inside /[...]/ )
#     Was: .replace(/[\n]+/g  spanning two lines → SyntaxError: missing /
# ============================================================================
# Match any broken multi-line character-class form of [\\r\\n] or real CR/LF inside []
data = re.sub(
    r"\.replace\(/\[[\r\n\\r\\n]+\]\+?/g,\s*\" \"\)",
    r'.replace(/[\r\n]+/g, " ")',
    data,
)
# Broader fix: reportComplaintRaw line that got split
data = re.sub(
    r"(const reportComplaintRaw = String\([^;]*?)\.replace\(/\[[^\]]*\r?\n[^\]]*\]\+?/g,\s*\" \"\)",
    r'\1.replace(/[\r\n]+/g, " ")',
    data,
    count=1,
)
# Ultimate safety: if still broken pattern with newline inside replace(/[
GOOD_COMPLAINT = (
    'const reportComplaintRaw = String((_liveR && _liveR.fault_description) || '
    'selectedClaim.fault_description || "").trim()'
    '.replace(/[\\r\\n]+/g, " ").replace(/\\s{2,}/g, " ");'
)
# Detect broken form (has newline between replace(/[ and ]+/g)
if re.search(r"reportComplaintRaw[\s\S]{0,120}?replace\(/\[[\s\S]*?\n[\s\S]*?\]\+/g", data):
    data = re.sub(
        r"const reportComplaintRaw = String\([\s\S]*?\)\.trim\(\)\.replace\(/\[[\s\S]*?\]\+?/g,\s*\" \"\)\.replace\(/\\s\{2,\}/g,\s*\" \"\);",
        GOOD_COMPLAINT,
        data,
        count=1,
    )
    print("fixed broken reportComplaintRaw regex")

# ============================================================================
# 1) selectedClaim from live Supabase row
# ============================================================================
OLD_SEL = (
    "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
    "    const selectedClaim = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;"
)
NEW_SEL = (
    "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
    "    const fromList = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;\n"
    "    const [liveClaim, setLiveClaim] = useState(null);\n"
    "    const [liveReady, setLiveReady] = useState(false);\n"
    "    useEffect(() => {\n"
    "        let alive = true;\n"
    "        setLiveReady(false);\n"
    "        setLiveClaim(null);\n"
    "        const id = String(selectedClaimId || '').trim();\n"
    "        if (!id) { setLiveReady(true); return undefined; }\n"
    "        const client = (typeof window !== 'undefined' && window.getSdlgSupabase && window.getSdlgSupabase()) || null;\n"
    "        if (!client) { setLiveClaim(fromList); setLiveReady(true); return undefined; }\n"
    "        (async () => {\n"
    "            try {\n"
    "                const { data: row, error } = await client.from('claims').select('*').eq('claim_id', id).maybeSingle();\n"
    "                if (!alive) return;\n"
    "                if (error) { console.warn('[SDLG portal] live fetch', error); setLiveClaim(fromList); }\n"
    "                else if (row) {\n"
    "                    setLiveClaim(row);\n"
    "                    try { window.__SDLG_LIVE_CLAIM__ = row; } catch (_e) {}\n"
    "                    try { if (window.SDLGInputHydrate && window.SDLGInputHydrate.apply) window.SDLGInputHydrate.apply(row); } catch (_e) {}\n"
    "                } else { setLiveClaim(fromList); }\n"
    "            } catch (e) { if (alive) { console.warn('[SDLG portal] live fetch', e); setLiveClaim(fromList); } }\n"
    "            finally { if (alive) setLiveReady(true); }\n"
    "        })();\n"
    "        return () => { alive = false; };\n"
    "    }, [selectedClaimId]);\n"
    "    const selectedClaim = liveClaim || (liveReady ? fromList : null);"
)
if OLD_SEL in data:
    data = data.replace(OLD_SEL, NEW_SEL, 1)
    print("injected liveClaim fetch")
elif "setLiveClaim" in data:
    print("liveClaim already present")
else:
    print("WARN: OLD_SEL not found")

# ============================================================================
# 2) Year-safe repairDate
# ============================================================================
OLD_RD = (
    "repairDate: portalDate(selectedClaim.dealer_repair_date || selectedClaim.completion_date || selectedClaim.failure_date),"
)
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
    print("year-safe repairDate")
elif "ok=function" in data:
    print("year-safe already present")
else:
    print("WARN: repairDate pattern not found")

# ============================================================================
# 3) _liveR before reportWo (TDZ-safe) — do NOT touch reportComplaintRaw regex here
# ============================================================================
data = data.replace(
    'const reportWo = String((_liveR && (_liveR.dealer_wo_so || _liveR.wo_so)) || selectedClaim.dealer_wo_so || selectedClaim.wo_so || "").trim();\n'
    '    const _liveR = (typeof window !== "undefined" && window.__SDLG_LIVE_CLAIM__ && selectedClaim && window.__SDLG_LIVE_CLAIM__.claim_id === selectedClaim.claim_id) ? window.__SDLG_LIVE_CLAIM__ : selectedClaim;\n'
    '    const reportModel = String((_liveR && _liveR.model) || selectedClaim.model || "").trim();',
    'const _liveR = (typeof window !== "undefined" && window.__SDLG_LIVE_CLAIM__ && selectedClaim && window.__SDLG_LIVE_CLAIM__.claim_id === selectedClaim.claim_id) ? window.__SDLG_LIVE_CLAIM__ : selectedClaim;\n'
    '    const reportWo = String((_liveR && (_liveR.dealer_wo_so || _liveR.wo_so)) || selectedClaim.dealer_wo_so || selectedClaim.wo_so || "").trim();\n'
    '    const reportModel = String((_liveR && _liveR.model) || selectedClaim.model || "").trim();',
    1,
)
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
    _old_rm = 'const reportModel = String(selectedClaim.model || "").trim();'
    if _old_rm in data:
        data = data.replace(
            _old_rm,
            'const reportModel = String((_liveR && _liveR.model) || selectedClaim.model || "").trim();',
            1,
        )
    _old_rh = 'const reportHm = numberText(selectedClaim.hm_failure) || "";'
    if _old_rh in data:
        data = data.replace(
            _old_rh,
            'const reportHm = numberText((_liveR && _liveR.hm_failure) != null ? _liveR.hm_failure : selectedClaim.hm_failure) || "";',
            1,
        )
    # Safe complaint patch: use String.fromCharCode style OR explicit \\r\\n in output
    _old_rc = (
        'const reportComplaintRaw = String(selectedClaim.fault_description || "").trim()'
        '.replace(/[\\r\\n]+/g, " ").replace(/\\s{2,}/g, " ");'
    )
    # Match original source form with backslash-r backslash-n as two-char sequences in file
    if 'const reportComplaintRaw = String(selectedClaim.fault_description' in data and '_liveR && _liveR.fault_description' not in data:
        data = re.sub(
            r'const reportComplaintRaw = String\(selectedClaim\.fault_description \|\| ""\)\.trim\(\)'
            r'\.replace\(/\[\\r\\n\]\+/g, " "\)\.replace\(/\\s\{2,\}/g, " "\);',
            'const reportComplaintRaw = String((_liveR && _liveR.fault_description) || selectedClaim.fault_description || "").trim()'
            '.replace(/[\\r\\n]+/g, " ").replace(/\\s{2,}/g, " ");',
            data,
            count=1,
        )
        print("patched reportComplaintRaw safely")

# ============================================================================
# 4) machineLocation from live
# ============================================================================
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

# ============================================================================
# 5) autocomplete off
# ============================================================================
data = data.replace(
    'type="text" value="${esc(value)}" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
    'type="text" value="${esc(value)}" autocomplete="off" data-lpignore="true" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
)

# ============================================================================
# 6) Final regex safety pass — never leave a newline inside /[...]/n# ============================================================================
data = re.sub(
    r"\.replace\(/\[\s*[\r\n]+\s*\]\+?/g,\s*[\"'] [\"']\)",
    ".replace(/[\\r\\n]+/g, \" \")",
    data,
)
# Also collapse the specific broken two-line form seen in production
data = data.replace(
    ".replace(/[\n]+/g, \" \")",
    ".replace(/[\\r\\n]+/g, \" \")",
)
data = data.replace(
    ".replace(/[\r\n]+/g, \" \")",
    ".replace(/[\\r\\n]+/g, \" \")",
)

# ============================================================================
# 7) Legacy inline enforcer
# ============================================================================
INLINE = r'''
<script data-sdlg-inline-enforcer-legacy="1">
(function(){
  if (window.__SDLG_INLINE_LEGACY__) return;
  window.__SDLG_INLINE_LEGACY__ = true;
  window.__SDLG_INLINE_ENFORCER__ = true;
  function setVal(el,v){if(!el)return;v=v==null?'':String(v);try{var p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;var d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set)d.set.call(el,v);else el.value=v;}catch(e){el.value=v;}try{el.setAttribute('value',v);}catch(e){}}
  function portalDate(v){var s=String(v||'').trim();if(!s)return'';var m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?(m[3]+'/'+m[2]+'/'+m[1]):s;}
  function tick(){
    try{
      if(!document.querySelector('[data-sdlg-input-helper]'))return;
      var c=window.__SDLG_LIVE_CLAIM__;if(!c||!c.claim_id)return;
      var el=document.getElementById('sdlg_repairDate');
      var want=portalDate(c.dealer_repair_date)||portalDate(c.failure_date)||'';
      if(el && want && String(el.value||'')!==want){
        if(/19[\/\-]0?7[\/\-]2024/.test(String(el.value||'')) || !el.value) setVal(el,want);
      }
      var locEl=document.getElementById('sdlg_machineLocation');
      var locWant=[c.dealer_wo_so||'',c.branch||'',c.customer||''].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' ');
      if(locEl && locWant && String(locEl.value||'')!==locWant){
        if(/PAPUA|INDOTRUCK|G9138F/i.test(String(locEl.value||'')) || !locEl.value) setVal(locEl,locWant);
      }
      var hrs=Number((document.getElementById('sdlg_repairLabor')||{}).value)||Number(c.labour_hrs)||0;
      if(hrs>0){var la=document.getElementById('sdlg_labourAmount');if(la && Number(la.value)!==hrs*25)setVal(la,(hrs*25).toFixed(2));}
    }catch(e){}
  }
  setInterval(tick,1000);
  [500,1500,3000].forEach(function(ms){setTimeout(tick,ms);});
})();
</script>
'''
if "__SDLG_INLINE_LEGACY__" not in data:
    if "</body>" in data:
        data = data.replace("</body>", INLINE + "\n</body>", 1)
    else:
        data += INLINE

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare done")
print("liveClaim:", "setLiveClaim" in data)
print("_liveR:", "const _liveR" in data)
# sanity: no newline inside replace(/[  ... ]+/g
bad = re.search(r"replace\(/\[[^\]]*\n[^\]]*\]", data)
print("broken regex remaining:", bool(bad))
