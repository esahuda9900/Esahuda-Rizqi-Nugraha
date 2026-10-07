from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

def req(old, new):
    global s
    if old not in s:
        raise SystemExit(f'Missing target snippet: {old[:160]!r}')
    s = s.replace(old, new, 1)

# Upgrade an already-patched frontend from the previous report-name format.
old_report = '''    const reportNameParts = [\n        reportModel ? `SDLG ${reportModel}` : "SDLG",\n        reportSerialShort ? `SN.${reportSerialShort}` : "SN.—",\n        reportHm ? `${reportHm} hr` : "HM.—",\n        reportComplaint || "Complaint —",\n        reportPfr || "PFR—",\n        reportClaimNo || "Claim—",\n        reportWo || "WO—"\n    ];\n    const reportName = reportNameParts.join(", ").replace(/, Claim([^,]+), WO/i, ", Claim$1 WO");'''
new_report = '''    const reportMachine = reportModel && reportSerialShort\n        ? `SDLG ${reportModel} SN.${reportSerialShort}`\n        : reportModel ? `SDLG ${reportModel}` : "SDLG";\n    const reportNameParts = [\n        reportMachine,\n        reportHm ? `${reportHm} hr` : "HM.—",\n        reportComplaint || "Complaint —",\n        reportPfr || "PFR—",\n        reportClaimNo || "Claim—",\n        reportWo || "WO—"\n    ];\n    const reportName = reportNameParts.join(", ").replace(/, (Claim[^,]+), (WO[^,]+)/i, ", $1 $2");'''

if old_report in s:
    req(old_report, new_report)
    p.write_text(s, encoding='utf-8')
    print('upgraded report naming format')
    raise SystemExit(0)

if 'const reportMachine = reportModel && reportSerialShort' in s:
    print('already upgraded')
    raise SystemExit(0)

# First-time installation.
req(
'''    const parts = Array.isArray(selectedClaim.parts) ? selectedClaim.parts : [];\n''',
'''    const reportPfrMatch = String(selectedClaim.claim_id || "").match(/^(\\d+)-\\d{4}-SDLG-PFR$/i);\n    const reportPfr = reportPfrMatch ? `PFR${reportPfrMatch[1]}` : (selectedClaim.claim_id || "");\n    const reportClaimNo = String(selectedClaim.dealer_claim_no || selectedClaim.claim_no || selectedClaim.sdlg_no || "").trim();\n    const reportWo = String(selectedClaim.dealer_wo_so || selectedClaim.wo_so || "").trim();\n    const reportModel = String(selectedClaim.model || "").trim();\n    const reportSerialShort = String(selectedClaim.serial_no || selectedClaim.canonical_serial_no || "").trim().replace(/\\s+/g, "").slice(-6);\n    const reportHm = numberText(selectedClaim.hm_failure) || "";\n    const reportComplaint = String(selectedClaim.fault_description || "").trim().replace(/[\\r\\n]+/g, " ").replace(/\\s{2,}/g, " ");\n    const reportMachine = reportModel && reportSerialShort\n        ? `SDLG ${reportModel} SN.${reportSerialShort}`\n        : reportModel ? `SDLG ${reportModel}` : "SDLG";\n    const reportNameParts = [\n        reportMachine,\n        reportHm ? `${reportHm} hr` : "HM.—",\n        reportComplaint || "Complaint —",\n        reportPfr || "PFR—",\n        reportClaimNo || "Claim—",\n        reportWo || "WO—"\n    ];\n    const reportName = reportNameParts.join(", ").replace(/, (Claim[^,]+), (WO[^,]+)/i, ", $1 $2");\n\n    const parts = Array.isArray(selectedClaim.parts) ? selectedClaim.parts : [];\n''')

req(
'''        const all = root.querySelector("[data-sdlg-copy-all]");\n''',
'''        const reportBtn = root.querySelector("[data-sdlg-copy-report-name]");\n        let reportHandler = null;\n        if (reportBtn) {\n            reportHandler = async () => {\n                const value = reportBtn.getAttribute("data-value") || "";\n                try { await navigator.clipboard.writeText(value); }\n                catch { const ta = document.createElement("textarea"); ta.value = value; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }\n                const old = reportBtn.textContent; reportBtn.textContent = "✓ Copied"; setTimeout(() => { if (reportBtn.isConnected) reportBtn.textContent = old; }, 1200);\n            };\n            reportBtn.addEventListener("click", reportHandler);\n        }\n        const all = root.querySelector("[data-sdlg-copy-all]");\n''')

req(
'''            handlers.forEach(([btn, handler]) => btn.removeEventListener("click", handler));\n            if (all && allHandler) all.removeEventListener("click", allHandler);\n''',
'''            handlers.forEach(([btn, handler]) => btn.removeEventListener("click", handler));\n            if (reportBtn && reportHandler) reportBtn.removeEventListener("click", reportHandler);\n            if (all && allHandler) all.removeEventListener("click", allHandler);\n''')

req(
'''      <div class="card card-pad" style="margin-bottom:14px"><div style="display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:10px"><div><div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:4px">CLAIM</div><div style="padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:800">${esc(selectedClaim.claim_id)}</div></div><div><div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:4px">MODEL</div><div style="padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px">${esc(selectedClaim.model || "—")}</div></div><div><div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:4px">CUSTOMER</div><div style="padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px">${esc(selectedClaim.customer || "—")}</div></div></div></div>\n''',
'''      <div class="card card-pad" style="margin-bottom:14px"><div style="display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:10px"><div><div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:4px">CLAIM</div><div style="padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:800">${esc(selectedClaim.claim_id)}</div></div><div><div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:4px">MODEL</div><div style="padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px">${esc(selectedClaim.model || "—")}</div></div><div><div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:4px">CUSTOMER</div><div style="padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px">${esc(selectedClaim.customer || "—")}</div></div></div></div>\n      <div class="card card-pad" style="margin-bottom:14px;border:1px solid #c7d2fe;background:#f8faff"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div style="min-width:0;flex:1"><div class="eyebrow">Report Naming</div><div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px">Nama Report</div><div style="font-family:monospace;font-size:11px;line-height:1.55;color:#334155;word-break:break-word;background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:10px">${esc(reportName)}</div><div style="font-size:10px;color:#64748b;margin-top:6px">Format: SDLG MODEL SN.xxxxxx, HM hr, Complaint, PFRxxxx ClaimNo WOxxxx</div></div><button id="sdlg-copy-report-name" type="button" data-sdlg-copy-report-name data-value="${esc(reportName)}" class="primary-btn">📋 Copy Nama Report</button></div></div>\n''')

p.write_text(s, encoding='utf-8')
print('patched', p.stat().st_size)
