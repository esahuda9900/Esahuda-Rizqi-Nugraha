#!/usr/bin/env python3
"""NUCLEAR: repairDate year-safe; inline DOM enforcer; labour hrs*25."""
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
        "const selectedClaim = liveClaim;\n"
        "    useEffect(() => {\n"
        "        if (liveClaim && window.SDLGInputHydrate && window.SDLGInputHydrate.apply) {\n"
        "            try { window.SDLGInputHydrate.apply(liveClaim); } catch (_e) {}\n"
        "        }\n"
        "    }, [liveClaim]);",
        1,
    )

if "const [liveClaim, setLiveClaim]" not in data:
    OLD_SEL = (
        "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
        "    const selectedClaim = (claims || []).find(c => String(c.claim_id) === String(selectedClaimId)) || null;"
    )
    NEW_SEL = (
        "function SDLGPortalInputPage({ claims, selectedClaimId, onSelectClaim, onBack }) {\n"
        '    const [liveClaim, setLiveClaim] = useState(null);\n'
        '    const [liveErr, setLiveErr] = useState("");\n'
        "    useEffect(() => {\n"
        '        let alive = true; setLiveClaim(null); setLiveErr("");\n'
        '        const id = String(selectedClaimId || "").trim();\n'
        "        if (!id) return undefined;\n"
        '        const client = (typeof sdlgSupabase !== "undefined" && sdlgSupabase) || (window.getSdlgSupabase && window.getSdlgSupabase()) || null;\n'
        '        if (!client) { setLiveErr("Supabase client not ready"); return undefined; }\n'
        "        (async () => {\n"
        "            try {\n"
        '                const { data: row, error } = await client.from("claims").select("*").eq("claim_id", id).maybeSingle();\n'
        "                if (!alive) return;\n"
        "                if (error) { setLiveErr(String(error.message || error)); return; }\n"
        '                if (row) setLiveClaim(row); else setLiveErr("Claim not found: " + id);\n'
        "            } catch (e) { if (alive) setLiveErr(String(e && e.message || e)); }\n"
        "        })();\n"
        "        return () => { alive = false; };\n"
        "    }, [selectedClaimId]);\n"
        "    useEffect(() => {\n"
        "        if (liveClaim && window.SDLGInputHydrate && window.SDLGInputHydrate.apply) {\n"
        "            try { window.SDLGInputHydrate.apply(liveClaim); } catch (_e) {}\n"
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
    '            return React.createElement("div", { className: "page", "data-sdlg-input-helper": "1", style: { padding: 24 } },\n'
    '                React.createElement("div", { style: { fontWeight: 800, marginBottom: 8 } }, "Memuat data klaim…"),\n'
    '                React.createElement("div", { style: { color: "#64748b", fontSize: 13 } }, String(selectedClaimId)),\n'
    '                (typeof liveErr !== "undefined" && liveErr) ? React.createElement("div", { style: { color: "#b91c1c", marginTop: 8 } }, liveErr) : null,\n'
    '                React.createElement("button", { className: "secondary-btn", style: { marginTop: 12 }, onClick: onBack }, "← Kembali"));\n'
    "        }\n"
    "        const activeClaims = (claims || []).filter(c => !c.archived_at);"
)
if OLD_EMPTY in data and "Memuat data klaim" not in data:
    data = data.replace(OLD_EMPTY, NEW_EMPTY, 1)

data = re.sub(
    r"size:\s*Math\.min\(Math\.max\(filteredClaims\.length,\s*1\),\s*12\),\s*",
    "",
    data,
)

data = data.replace(
    'React.createElement("div", { dangerouslySetInnerHTML: { __html: html } })',
    'React.createElement("div", { key: String(selectedClaimId || selectedClaim && selectedClaim.claim_id || "none"), "data-sdlg-input-helper": "1", "data-claim-id": String(selectedClaimId || (selectedClaim && selectedClaim.claim_id) || ""), dangerouslySetInnerHTML: { __html: html } })',
    1,
)

data = data.replace(
    'const portalDate = (value) => {\n'
    '        const s = String(value || "").trim();\n'
    '        const m = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);\n'
    '        return m ? `${m[3]}/${m[2]}/${m[1]}` : s;\n'
    '    };',
    'const portalDate = (value) => {\n'
    '        const s = String(value || "").trim();\n'
    '        if (!s) return "";\n'
    '        const m = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);\n'
    '        if (m) return `${m[3]}/${m[2]}/${m[1]}`;\n'
    '        return s;\n'
    '    };',
)

data = data.replace(
    'const feedbackContact = selectedClaim.feedback_contact || selectedClaim.technician_contact || selectedClaim.technical_personnel_phone || "xxx";',
    'const feedbackContact = (selectedClaim.feedback_contact || selectedClaim.technician_contact || selectedClaim.technical_personnel_phone || "").replace(/^kosong$/i, "").replace(/^xxx+$/i, "");',
)

NEW_REPAIR = (
    "repairDate: (function(){\n"
    "          const id = String(selectedClaim.claim_id || \"\");\n"
    "          const cy = (id.match(/-(\\d{4})-SDLG-PFR/i) || [])[1];\n"
    "          const ok = (raw) => {\n"
    "            if (raw == null || String(raw).trim() === \"\") return null;\n"
    "            const fmt = portalDate(raw);\n"
    "            if (/19[\\/\\-]0?7[\\/\\-]2024/.test(fmt) && id !== \"0429-2024-SDLG-PFR\") return null;\n"
    "            const dy = (fmt.match(/(\\d{4})$/) || [])[1];\n"
    "            if (cy && dy && Math.abs(Number(cy) - Number(dy)) > 1) return null;\n"
    "            return fmt;\n"
    "          };\n"
    "          return ok(selectedClaim.dealer_repair_date)\n"
    "              || ok(selectedClaim.completion_date)\n"
    "              || ok(selectedClaim.repair_date)\n"
    "              || ok(selectedClaim.failure_date)\n"
    "              || portalDate(selectedClaim.failure_date || \"\")\n"
    "              || \"\";\n"
    "        })(),"
)

# IMPORTANT: use lambda so \\d in NEW_REPAIR is not treated as re replacement escape
data = re.sub(
    r"repairDate:\s*\(function\(\)\{[\s\S]*?\}\)\(\),",
    lambda _m: NEW_REPAIR,
    data,
    count=1,
)
data = data.replace(
    "repairDate: portalDate(selectedClaim.dealer_repair_date || selectedClaim.completion_date || selectedClaim.failure_date),",
    NEW_REPAIR,
)

data = data.replace(
    'fieldHtml("labourAmount","Labour Amount",(function(){ const db=selectedClaim.labour_amount; if(db!=null&&db!==""&&Number(db)!==0) return db; const hrs=Number(selectedClaim.labour_hrs||0); return (hrs*25).toFixed(2); })(),false,false)',
    'fieldHtml("labourAmount","Labour Amount",(Number(selectedClaim.labour_hrs||0)*25).toFixed(2),false,false)',
)

data = data.replace(
    'fieldHtml("mileageAmount","Mileage Amount",(function(){ const db=selectedClaim.mileage_amount; if(db!=null&&db!==""&&Number(db)!==0) return db; const km=Number(selectedClaim.mileage_km||0); return (km*0.5).toFixed(2); })(),false,false)',
    'fieldHtml("mileageAmount","Mileage Amount",(Number(selectedClaim.mileage_amount)||(Number(selectedClaim.mileage_km||0)*0.5)).toFixed(2),false,false)',
)

data = data.replace(
    'const unitPrice = p.unit_price ?? p.unitPrice ?? "";\n        const amount = p.amount ?? "";',
    'const unitPrice = p.unit_price ?? p.unitPrice ?? 0;\n        const amount = p.amount ?? ((Number(p.quantity ?? p.qty ?? 1) || 1) * (Number(unitPrice) || 0));',
)

old_nav = '["list", `Claims · ${claims.filter(c => !c.archived_at).length}`]'
new_nav = '["list", `Claims · ${typeof window.__SDLG_CLAIMS_COUNT__ === "number" ? window.__SDLG_CLAIMS_COUNT__ : claims.filter(c => !c.archived_at).length}`]'
if old_nav in data:
    data = data.replace(old_nav, new_nav, 1)

INLINE = r"""
<script data-sdlg-inline-enforcer="1">
(function(){
  if (window.__SDLG_INLINE_ENFORCER__) return;
  window.__SDLG_INLINE_ENFORCER__ = true;
  function setVal(el, v){
    if(!el) return;
    try{
      var proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      var d=Object.getOwnPropertyDescriptor(proto,'value');
      if(d&&d.set) d.set.call(el,v); else el.value=v;
    }catch(e){ el.value=v; }
    try{ el.setAttribute('value',v); }catch(e){}
  }
  function tick(){
    try{
      if(!document.querySelector('[data-sdlg-input-helper]')) return;
      var repair=document.getElementById('sdlg_repairDate');
      var fail=document.getElementById('sdlg_failureDate');
      var hrs=document.getElementById('sdlg_repairLabor');
      var labour=document.getElementById('sdlg_labourAmount');
      var mile=document.getElementById('sdlg_mileageAmount');
      var km=document.getElementById('sdlg_serviceMileage');
      var total=document.getElementById('sdlg_totalAmount');
      var hash=String(location.hash||'');
      var is0429=/0429-2024-SDLG-PFR/.test(hash);
      if(repair && /19[\/\-]0?7[\/\-]2024/.test(String(repair.value||'')) && !is0429){
        var next='';
        if(window.__SDLG_LIVE_CLAIM__){
          var c=window.__SDLG_LIVE_CLAIM__;
          var cands=[c.dealer_repair_date,c.completion_date,c.failure_date];
          for(var i=0;i<cands.length;i++){
            var raw=cands[i];
            if(!raw) continue;
            var m=String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if(!m) continue;
            if(Number(m[1])===2024 && !is0429) continue;
            next=m[3]+'/'+m[2]+'/'+m[1];
            break;
          }
        }
        if(!next && fail && fail.value && !/19[\/\-]0?7[\/\-]2024/.test(fail.value)) next=fail.value;
        if(next){ setVal(repair, next); console.info('[SDLG inline] repair forced', next); }
      }
      var h=hrs?Number(String(hrs.value).replace(/[^0-9.]/g,'')):0;
      if(labour && h>0){
        var want=(h*25).toFixed(2);
        if(String(labour.value)!==want) setVal(labour, want);
      }
      var k=km?Number(String(km.value).replace(/[^0-9.]/g,'')):0;
      if(mile && k>0){
        var mw=(k*0.5).toFixed(2);
        if(String(mile.value)==='0'||String(mile.value)==='0.00'||String(mile.value)==='') setVal(mile, mw);
      }
      if(total && labour && mile){
        var la=Number(String(labour.value).replace(/[^0-9.]/g,''))||0;
        var ma=Number(String(mile.value).replace(/[^0-9.]/g,''))||0;
        var oa=document.getElementById('sdlg_otherAmount');
        var ot=oa?Number(String(oa.value).replace(/[^0-9.]/g,''))||0:0;
        setVal(total, (la+ma+ot).toFixed(2));
      }
      document.querySelectorAll('[data-sdlg-input-helper] *').forEach(function(n){
        if(n.childNodes && n.childNodes.length===1 && n.childNodes[0].nodeType===3){
          if(/^\s*Kosong\s*$/i.test(n.textContent||'')) n.textContent='\u2014';
        }
      });
    }catch(e){}
  }
  setInterval(tick, 400);
  setTimeout(tick, 200);
  setTimeout(tick, 1000);
  setTimeout(tick, 2000);
})();
</script>
"""

if "data-sdlg-inline-enforcer" not in data:
    data = data.replace("</body>", INLINE + "\n</body>", 1)

if "refreshClaimsCount" not in data:
    bootstrap = (
        "<script>(function(){\n"
        "async function refreshClaimsCount(){\n"
        "  try{\n"
        "    var repo=window.SDLGRepository||window.sdlgRepository;\n"
        "    if(repo&&repo.countClaimsCached){\n"
        "      var n=await repo.countClaimsCached(false);\n"
        "      if(typeof n==='number'){ window.__SDLG_CLAIMS_COUNT__=n;\n"
        "        document.querySelectorAll('a,button,span,div').forEach(function(el){\n"
        "          var t=el.childNodes.length===1&&el.childNodes[0].nodeType===3?el.textContent:'';\n"
        "          if(/^Claims\\s*·\\s*\\d+$/.test((t||'').trim())) el.textContent='Claims · '+n;\n"
        "        });\n"
        "      }\n"
        "    }\n"
        "  }catch(e){}\n"
        "}\n"
        "setTimeout(refreshClaimsCount,800);\n"
        "setTimeout(refreshClaimsCount,2500);\n"
        "setInterval(refreshClaimsCount,60000);\n"
        "})();</script>\n"
    )
    data = data.replace("</body>", bootstrap + "</body>", 1)

data = data.replace(
    'type="text" value="${esc(value)}" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
    'type="text" value="${esc(value)}" autocomplete="off" data-lpignore="true" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:#f8fafc"',
)

INDEX.write_text(data, encoding="utf-8")

# Force labour amount in final HTML
data2 = INDEX.read_text(encoding="utf-8", errors="replace")
data2 = re.sub(
    r'fieldHtml\("labourAmount","Labour Amount",[^\)]+\),false,false\)',
    lambda _m: 'fieldHtml("labourAmount","Labour Amount",(Number(selectedClaim.labour_hrs||0)*25).toFixed(2),false,false)',
    data2,
    count=1,
)
INDEX.write_text(data2, encoding="utf-8")
print("labour force applied", "(Number(selectedClaim.labour_hrs||0)*25)" in data2)
print("prepare done — inline enforcer + year-safe repair + labour hrs*25")
print("inline:", "data-sdlg-inline-enforcer" in data2)
print("ok(selectedClaim:", "ok(selectedClaim.dealer_repair_date)" in data2)
