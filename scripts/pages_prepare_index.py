#!/usr/bin/env python3
"""NUCLEAR: repairDate year-safe; inline DOM enforcer; labour hrs*25."""
from pathlib import Path
import re

INDEX = Path("_site/index.html")
if not INDEX.exists():
    raise SystemExit("missing _site/index.html — run after copy of index.html")

data = INDEX.read_text(encoding="utf-8", errors="replace")

# --- LIVE-CLAIM LOCATION + REPORT GUARD ---
_old_loc = 'const machineLocation = [wo, branch, customer].map(v => String(v || "").trim()).filter(Boolean).join(" ");'
_new_loc = (
    'const _liveForLoc = (typeof window !== "undefined" && window.__SDLG_LIVE_CLAIM__ && selectedClaim '
    '&& window.__SDLG_LIVE_CLAIM__.claim_id === selectedClaim.claim_id) ? window.__SDLG_LIVE_CLAIM__ : selectedClaim;\n'
    '    const _woL = String((_liveForLoc && (_liveForLoc.dealer_wo_so || _liveForLoc.wo_so)) || wo || "").trim();\n'
    '    const _brL = String((_liveForLoc && _liveForLoc.branch) || branch || "").trim();\n'
    '    const _cuL = String((_liveForLoc && _liveForLoc.customer) || customer || "").trim();\n'
    '    const machineLocation = [_woL, _brL, _cuL].filter(Boolean).join(" ");'
)
if _old_loc in data:
    data = data.replace(_old_loc, _new_loc, 1)

_old_rm = 'const reportModel = String(selectedClaim.model || "").trim();'
_new_rm = (
    'const _liveR = (typeof window !== "undefined" && window.__SDLG_LIVE_CLAIM__ && selectedClaim '
    '&& window.__SDLG_LIVE_CLAIM__.claim_id === selectedClaim.claim_id) ? window.__SDLG_LIVE_CLAIM__ : selectedClaim;\n'
    '    const reportModel = String((_liveR && _liveR.model) || selectedClaim.model || "").trim();'
)
if _old_rm in data:
    data = data.replace(_old_rm, _new_rm, 1)

_old_rw = 'const reportWo = String(selectedClaim.dealer_wo_so || selectedClaim.wo_so || "").trim();'
if _old_rw in data:
    data = data.replace(_old_rw, 'const reportWo = String((_liveR && (_liveR.dealer_wo_so || _liveR.wo_so)) || selectedClaim.dealer_wo_so || selectedClaim.wo_so || "").trim();', 1)

_old_rh = 'const reportHm = numberText(selectedClaim.hm_failure) || "";'
if _old_rh in data:
    data = data.replace(_old_rh, 'const reportHm = numberText((_liveR && _liveR.hm_failure) != null ? _liveR.hm_failure : selectedClaim.hm_failure) || "";', 1)

if "const selectedClaim = liveClaim || fromList;" in data:
    data = data.replace(
        "const selectedClaim = liveClaim || fromList;",
        "const selectedClaim = liveClaim;\n"
        "    useEffect(() => {\n"
        "        if (liveClaim && window.SDLGInputHydrate && window.SDLGInputHydrate.apply) {\n"
        "            try { window.SDLGInputHydrate.apply(liveClaim); } catch (_e) {}\n"
        "        }\n"
        "    }, [liveClaim]);",
        1,
    )

OLD_REPAIR = re.compile(
    r"repairDate:\s*portalDate\(selectedClaim\.dealer_repair_date\s*\|\|\s*selectedClaim\.completion_date\s*\|\|\s*selectedClaim\.repair_date\s*\|\|\s*selectedClaim\.failure_date\)",
    re.M,
)
NEW_REPAIR = (
    "repairDate: (function(){"
    "var ok=function(v){if(v==null||String(v).trim()==='')return null;"
    "var fmt=portalDate(v);if(!fmt)return null;"
    "if(/19[\\/\\-]0?7[\\/\\-]2024/.test(fmt)&&String(selectedClaim.claim_id||'')!=='0429-2024-SDLG-PFR')return null;"
    "var cy=(String(selectedClaim.claim_id||'').match(/-(\\d{4})-SDLG-PFR/i)||[])[1];"
    "var dy=(fmt.match(/(\\d{4})$/)||[])[1];"
    "if(cy&&dy&&Math.abs(Number(cy)-Number(dy))>1)return null;return fmt;};"
    "return ok(selectedClaim.dealer_repair_date)||ok(selectedClaim.completion_date)||ok(selectedClaim.repair_date)||ok(selectedClaim.failure_date)||'';"
    "})()"
)
if OLD_REPAIR.search(data):
    data = OLD_REPAIR.sub(NEW_REPAIR, data, count=1)

data = data.replace(
    'type="text" value="${esc(value)}" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
    'type="text" value="${esc(value)}" autocomplete="off" data-lpignore="true" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
)

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
      if(el && /19[\/\-]0?7[\/\-]2024/.test(String(el.value||'')) && String(c.claim_id)!=='0429-2024-SDLG-PFR'){
        var fmt=portalDate(c.dealer_repair_date)||portalDate(c.failure_date)||'';
        if(fmt){setVal(el,fmt);try{console.info('[SDLG inline] repair forced',fmt);}catch(e){}}
      }
      var locEl=document.getElementById('sdlg_machineLocation');
      var want=[c.dealer_wo_so||'',c.branch||'',c.customer||''].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' ');
      if(locEl && want && /PAPUA|INDOTRUCK/i.test(String(locEl.value||'')) && !/PAPUA|INDOTRUCK/i.test(want)){
        setVal(locEl,want);
      }
      var hrs=Number((document.getElementById('sdlg_repairLabor')||{}).value)||Number(c.labour_hrs)||0;
      if(hrs>0){var la=document.getElementById('sdlg_labourAmount');if(la)setVal(la,(hrs*25).toFixed(2));}
    }catch(e){}
  }
  setInterval(tick,700);
  [400,1200,2500].forEach(function(ms){setTimeout(tick,ms);});
})();
</script>
'''

if "data-sdlg-inline-enforcer-legacy" not in data and "__SDLG_INLINE_LEGACY__" not in data:
    if "</body>" in data:
        data = data.replace("</body>", INLINE + "\n</body>", 1)
    else:
        data += INLINE

INDEX.write_text(data, encoding="utf-8")
print("pages_prepare_index.py done")
print("liveForLoc:", "_liveForLoc" in data)
print("inline legacy:", "__SDLG_INLINE_LEGACY__" in data)
