from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')
changed = 0


def replace_exact(old, new, label):
    global s, changed
    if old in s:
        s = s.replace(old, new, 1)
        changed += 1
        print(f'Patched: {label}')
        return True
    return False

# Current main (9557064...) catch-up logic.
old_current = '''        // Dealer Claim Date means the claim has already passed the internal\n        // Warranty Admin and SDLG submission milestones. Catch up sequentially\n        // so workflow history records every step instead of performing a jump.\n        if (form?.dealer_claim_date && rank < workflowRank["Claimed to SDLG"]) {\n            advance("Submitted to Warranty Admin", form.dealer_claim_date, "Otomatis: workflow di-catch-up berdasarkan Dealer Claim Date.");\n            advance("Submitted to SDLG", form.dealer_claim_date, "Otomatis: workflow di-catch-up berdasarkan Dealer Claim Date.");\n            advance("Claimed to SDLG", form.dealer_claim_date, "Otomatis: workflow di-catch-up berdasarkan Dealer Claim Date.");\n        }\n        // Legacy/manual path: submission number can still advance Submitted -> Claimed.\n        if (form?.sdlg_submission_no && rank >= workflowRank["Submitted to SDLG"] && rank < workflowRank["Claimed to SDLG"])\n            advance("Claimed to SDLG", form.dealer_claim_date || form.status_date || today(), "Otomatis: SDLG Submission No. sudah diisi.");'''
new_current = '''        // Dealer Claim Date is the single operational submission action.\n        // It closes the submission milestones and immediately transfers ownership to SDLG Audit.\n        if (form?.dealer_claim_date && rank < workflowRank["SDLG Audit"]) {\n            advance("Ready to Claim", form.dealer_claim_date, "Otomatis: Final report Technical Support siap diklaim.");\n            advance("Submitted to SDLG", form.dealer_claim_date, "Otomatis: submission ke SDLG.");\n            advance("Claimed to SDLG", form.dealer_claim_date, "Otomatis: submission tercatat.");\n            advance("SDLG Audit", form.dealer_claim_date, "Otomatis: claim masuk antrean audit SDLG.");\n        }\n        // Legacy/manual path remains only for old records without Dealer Claim Date.\n        if (!form?.dealer_claim_date && form?.sdlg_submission_no && rank >= workflowRank["Submitted to SDLG"] && rank < workflowRank["Claimed to SDLG"])\n            advance("Claimed to SDLG", form.dealer_claim_date || form.status_date || today(), "Otomatis: SDLG Submission No. sudah diisi.");'''

old_legacy = '''        // Dealer Claim Date is the gate for Draft -> Submitted to SDLG.\n        if (form?.dealer_claim_date && rank < workflowRank["Submitted to SDLG"])\n            advance("Submitted to SDLG", form.dealer_claim_date, "Otomatis: Dealer Claim Date sudah diisi.");\n        // Submission number is the gate for Submitted -> Claimed.\n        if (form?.sdlg_submission_no && rank >= workflowRank["Submitted to SDLG"] && rank < workflowRank["Claimed to SDLG"])\n            advance("Claimed to SDLG", form.dealer_claim_date || form.status_date || today(), "Otomatis: SDLG Submission No. sudah diisi.");'''

if not replace_exact(old_current, new_current, 'current catch-up workflow'):
    replace_exact(old_legacy, new_current, 'legacy catch-up workflow')

# Route the save operation through the atomic DB catch-up when Dealer Claim Date is present.
old_save_current = '''            // Database trigger records the catch-up history atomically for Draft claims\n            // whose Dealer Claim Date drives them through Claimed to SDLG.\n            const catchupByDealerClaimDate = detail.claim_status === "Draft" && !!editForm.dealer_claim_date && finalAutoStatus === "Claimed to SDLG";\n            await SDLG_USE_CASES.UpdateClaimRecord.execute({\n                claimId: detail.claim_id,\n                claim: payload,\n                statusHistory: catchupByDealerClaimDate ? [] : (autoTransitions || [])\n            });'''
new_save = '''            // Database trigger owns the atomic catch-up for every pre-submission state\n            // once Dealer Claim Date is present; the final operational state is SDLG Audit.\n            const preSubmissionStatus = ["Draft","Ready to Claim","Submitted to Warranty Admin","Submitted to SDLG","Claimed to SDLG"].includes(detail.claim_status);\n            const catchupByDealerClaimDate = preSubmissionStatus && !!editForm.dealer_claim_date && finalAutoStatus === "SDLG Audit";\n            await SDLG_USE_CASES.UpdateClaimRecord.execute({\n                claimId: detail.claim_id,\n                claim: payload,\n                statusHistory: catchupByDealerClaimDate ? [] : (autoTransitions || [])\n            });'''

if not replace_exact(old_save_current, new_save, 'atomic catch-up save'):
    old_save_older = '''            await SDLG_USE_CASES.UpdateClaimRecord.execute({\n                claimId: detail.claim_id,\n                claim: payload,\n                statusHistory: autoTransitions || []\n            });'''
    replace_exact(old_save_older, new_save, 'legacy atomic catch-up save')

# New claims created from a parsed Technical Support final report should start at Ready to Claim,
# while existing genuine Draft records remain Draft until explicitly progressed.
pattern = r'claim_status:\s*finalAuto\?\.status\s*\|\|\s*existingClaim\.claim_status\s*\|\|\s*"Draft"'
replacement = 'claim_status: finalAuto?.status || existingClaim.claim_status || "Ready to Claim"'
s, n = re.subn(pattern, replacement, s, count=1)
if n:
    changed += n
    print('Patched: new parsed-claim default status')

# Make the legacy display mapping consistent with the Ball Owner model when the exact older mapping exists.
old_display = '''const displayStatus = (s) => ({\n        "Submitted to Warranty Admin": "Ready to Claim",\n        "Submitted to SDLG": "SDLG Audit",\n        "Claimed to SDLG": "SDLG Audit",\n        "Approved": "Yes to Settlement",\n        "Rejected": "No to Settlement"\n    }[s] || s || "Draft");'''
new_display = '''const displayStatus = (s) => ({\n        "Submitted to Warranty Admin": "Ready to Claim",\n        "Submitted to SDLG": "SDLG Audit",\n        "Claimed to SDLG": "SDLG Audit",\n        "Approved": "Yes to Settlement",\n        "Rejected": "No to Settlement"\n    }[s] || s || "Ready to Claim");'''
replace_exact(old_display, new_display, 'status display fallback')

if changed:
    p.write_text(s, encoding='utf-8')
    print(f'Workflow patch applied; index.html size={p.stat().st_size}; changes={changed}')
else:
    print('No changes needed; frontend already aligned.')
