const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

const tag = '<script src="/modules/master-resolution-ux.js"></script>';
const anchor = '<script src="/modules/claim-parser-helpers.js"></script>';
const woPolicyTag = '<script src="/modules/wo-claim-policy.js"></script>';
const woModalTag = '<script src="/modules/wo-collision-modal.js"></script>';

function replaceOnce(input, pattern, replacement, label) {
  const output = input.replace(pattern, replacement);
  if (output === input) throw new Error(`${label}: target not found; refusing unsafe patch.`);
  return output;
}

function stripIndentBranchInference(src) {
  const MARKER = 'Branch diinfer dari histori indent + model + customer';
  if (!src.includes(MARKER)) {
    return { source: src, stripped: false, reason: 'no-marker' };
  }

  let guard = 0;
  let working = src;
  while (working.includes(MARKER) && guard < 5) {
    guard += 1;
    const markerIdx = working.indexOf(MARKER);
    let elseIdx = working.lastIndexOf('else {', markerIdx);
    if (elseIdx < 0) return { source: working, stripped: false, reason: 'else-not-found' };

    const window = working.slice(elseIdx, Math.min(working.length, elseIdx + 500));
    if (!window.includes('customerKey')) {
      const earlier = working.lastIndexOf('else {', elseIdx - 1);
      if (earlier >= 0) {
        const w2 = working.slice(earlier, Math.min(working.length, earlier + 500));
        if (w2.includes('customerKey')) elseIdx = earlier;
      }
    }

    const braceStart = working.indexOf('{', elseIdx);
    let depth = 0;
    let end = -1;
    for (let j = braceStart; j < working.length; j += 1) {
      const c = working[j];
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          end = j + 1;
          break;
        }
      }
    }
    if (end < 0) return { source: working, stripped: false, reason: 'unbalanced' };
    const span = end - elseIdx;
    if (span > 20000) return { source: working, stripped: false, reason: `span-too-large:${span}` };
    if (!working.slice(elseIdx, end).includes(MARKER)) {
      return { source: working, stripped: false, reason: 'span-missing-marker' };
    }
    working = working.slice(0, elseIdx) + working.slice(end);
  }

  if (working.includes(MARKER)) return { source: working, stripped: false, reason: 'marker-remains' };
  return { source: working, stripped: true, reason: 'ok' };
}

if (!source.includes(tag)) {
  if (!source.includes(anchor)) {
    throw new Error('Master resolution UX patch requires claim parser helper anchor; refusing unsafe patch.');
  }
  source = source.replace(anchor, `${anchor}\n${tag}`);
  console.log('Installed master resolution UX helper.');
} else {
  console.log('Master resolution UX helper already installed.');
}

// Modal before policy so policy can call it
if (!source.includes('/modules/wo-collision-modal.js')) {
  if (source.includes(anchor)) {
    source = source.replace(anchor, `${anchor}\n${woModalTag}`);
    console.log('Installed wo-collision-modal script tag.');
  }
} else {
  console.log('wo-collision-modal already installed.');
}

if (!source.includes('/modules/wo-claim-policy.js')) {
  if (source.includes(anchor)) {
    // ensure policy after modal
    if (source.includes('/modules/wo-collision-modal.js')) {
      source = source.replace(woModalTag, `${woModalTag}\n${woPolicyTag}`);
    } else {
      source = source.replace(anchor, `${anchor}\n${woPolicyTag}`);
    }
    console.log('Installed wo-claim-policy module script tag.');
  }
} else {
  console.log('wo-claim-policy module already installed.');
}

const lockPattern = /const validateSourceLock = \(p, rawText\) => \{([\s\S]*?)\n    \};\n    const validateParsed =/;
if (!source.includes('const validateSourceLockStrict = (p, rawText) => {')) {
  try {
    source = replaceOnce(
      source,
      lockPattern,
      (match, body) => `const validateSourceLockStrict = (p, rawText) => {${body}\n    };\n    const validateSourceLock = (p, rawText) => {\n        const issues = validateSourceLockStrict(p, rawText);\n        const sourceModel = sourceScalarValue(rawText, [\"Product Name (Model)\"]);\n        const parsedModel = String(p?.model || \"\").trim();\n        if (sourceModel && parsedModel) {\n            const sourceCanonical = window.SDLGCanonicalModel ? window.SDLGCanonicalModel(sourceModel) : canonicalModel(sourceModel);\n            const parsedCanonical = window.SDLGCanonicalModel ? window.SDLGCanonicalModel(parsedModel) : canonicalModel(parsedModel);\n            const equivalent = normalizeModel(sourceCanonical) === normalizeModel(parsedCanonical) || (window.SDLGModelsEquivalent && window.SDLGModelsEquivalent(sourceCanonical, parsedCanonical));\n            if (equivalent && normalizeModel(sourceModel) !== normalizeModel(parsedModel)) {\n                return issues.filter((issue) => {\n                    const text = String(issue || \"\");\n                    return !/^Model\\s*:/i.test(text) && !/Model source/i.test(text);\n                });\n            }\n        }\n        return issues;\n    };\n    const validateParsed =`,
      'SOURCE LOCK canonical-model wrapper'
    );
    console.log('Patched SOURCE LOCK to accept confirmed canonical model aliases only.');
  } catch (err) {
    console.warn('SOURCE LOCK wrapper skipped: ' + err.message);
  }
} else {
  const legacyFilter = 'return issues.filter((issue) => !String(issue || "").includes("Model source"));';
  const hardenedFilter = 'return issues.filter((issue) => {\n                    const text = String(issue || "");\n                    return !/^Model\\s*:/i.test(text) && !/Model source/i.test(text);\n                });';
  if (source.includes(legacyFilter)) {
    source = source.replace(legacyFilter, hardenedFilter);
    console.log('Hardened existing SOURCE LOCK model-alias filter.');
  }
}

const oldHistSelect = 'claim_id,serial_no,model,customer,branch,branch_id,last_updated,hm_failure,causing_part_no,causing_part_desc,dealer_wo_so,archived_at';
const histFields = ',indent_no,dealer_name,sales_date';
const newHistSelect = oldHistSelect + histFields;
const histSelectPattern = new RegExp(`${oldHistSelect.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?:${histFields.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})+`);
if (histSelectPattern.test(source)) {
  source = source.replace(histSelectPattern, newHistSelect);
} else if (source.includes(oldHistSelect)) {
  source = source.replace(oldHistSelect, newHistSelect);
}

const stripResult = stripIndentBranchInference(source);
if (stripResult.stripped) source = stripResult.source;

const MARKER_V3 = '/* SDLG_WO_ONE_CLAIM_V3 */';

function ensureMatchedClaimWire(src) {
  if (src.includes('window.SDLGWoClaimPolicy.findMatchedClaim')) {
    console.log('matchedClaim already uses SDLGWoClaimPolicy.');
    return src;
  }
  try {
    const start = src.indexOf('const matchedClaim = parsed');
    if (start < 0) throw new Error('matchedClaim not found');
    const after = src.indexOf('\n    const ', start + 10);
    if (after < 0 || after - start > 1200) throw new Error('boundary');
    const oldBlock = src.slice(start, after);
    if (!oldBlock.includes('claims.find') || !oldBlock.includes('dealerWoSo')) throw new Error('shape');
    const newBlock =
      MARKER_V3 +
      '\n    const matchedClaim = parsed\n' +
      '        ? (window.SDLGWoClaimPolicy && typeof window.SDLGWoClaimPolicy.findMatchedClaim === "function"\n' +
      '            ? window.SDLGWoClaimPolicy.findMatchedClaim(claims, parsed, serialEquivalent)\n' +
      '            : claims.find((c) => !c.archived_at && ((parsed.distributorNo && String(c.claim_id || "").trim() === String(parsed.distributorNo).trim()) ||\n' +
      '                (!parsed.distributorNo && parsed.dealerWoSo && parsed.serialNo &&\n' +
      '                    c.dealer_wo_so === parsed.dealerWoSo && serialEquivalent(c.serial_no, parsed.serialNo)))))\n' +
      '        : null;\n' +
      '    const strictWoMatch = matchedClaim && window.SDLGWoClaimPolicy && typeof window.SDLGWoClaimPolicy.isStrictWoMatch === "function"\n' +
      '        ? window.SDLGWoClaimPolicy.isStrictWoMatch(parsed, matchedClaim)\n' +
      '        : false';
    src = src.slice(0, start) + newBlock + src.slice(after);
    console.log('matchedClaim delegated to policy.');
  } catch (err) {
    console.warn('matchedClaim wire skipped: ' + err.message);
  }
  return src;
}

const NEW_ASYNC =
  'onClick: () => { (async () => { if (window.SDLGWoClaimPolicy && typeof window.SDLGWoClaimPolicy.confirmAndPrepareNewSave === "function" && matchedClaim && parsed) { const ok = await window.SDLGWoClaimPolicy.confirmAndPrepareNewSave(parsed, matchedClaim); if (!ok) return; } proceedSaveAfterReview("new"); })(); }';

const UPD_ASYNC =
  'onClick: () => { (async () => { if (window.SDLGWoClaimPolicy && typeof window.SDLGWoClaimPolicy.confirmUpdateSave === "function" && matchedClaim && parsed) { const ok = await window.SDLGWoClaimPolicy.confirmUpdateSave(parsed, matchedClaim); if (!ok) return; } proceedSaveAfterReview("update", matchedClaim); })(); }';

function ensureNewSaveConfirm(src) {
  src = src.split('|| strictWoMatch').join('');
  src = src.split(' || strictWoMatch').join('');

  if (src.includes('await window.SDLGWoClaimPolicy.confirmAndPrepareNewSave')) {
    console.log('Simpan Baru async confirm already wired.');
    return src;
  }

  // Upgrade sync confirm handler if present
  if (src.includes('confirmAndPrepareNewSave(parsed, matchedClaim)) return; } proceedSaveAfterReview("new")')) {
    src = src.replace(
      /onClick: \(\) => \{ if \(window\.SDLGWoClaimPolicy && typeof window\.SDLGWoClaimPolicy\.confirmAndPrepareNewSave === "function" && matchedClaim && parsed\) \{ if \(!window\.SDLGWoClaimPolicy\.confirmAndPrepareNewSave\(parsed, matchedClaim\)\) return; \} proceedSaveAfterReview\("new"\); \}/,
      NEW_ASYNC
    );
    console.log('Upgraded Simpan Baru to async modal handler.');
    return src;
  }

  const dual =
    'onClick: () => proceedSaveAfterReview("new"), disabled: sourceLockIssues.length > 0 || saving || !isOnline';
  if (src.includes(dual)) {
    src = src.replace(dual, NEW_ASYNC + ', disabled: sourceLockIssues.length > 0 || saving || !isOnline');
    console.log('Simpan Baru async confirm wired (dual).');
  } else {
    console.warn('Simpan Baru onClick not found.');
  }
  return src;
}

function ensureUpdateConfirm(src) {
  if (src.includes('await window.SDLGWoClaimPolicy.confirmUpdateSave')) {
    console.log('Update async confirm already wired.');
    return src;
  }

  if (src.includes('confirmUpdateSave(parsed, matchedClaim)) return; } proceedSaveAfterReview("update"')) {
    src = src.replace(
      /onClick: \(\) => \{ if \(window\.SDLGWoClaimPolicy && typeof window\.SDLGWoClaimPolicy\.confirmUpdateSave === "function" && matchedClaim && parsed\) \{ if \(!window\.SDLGWoClaimPolicy\.confirmUpdateSave\(parsed, matchedClaim\)\) return; \} proceedSaveAfterReview\("update", matchedClaim\); \}/,
      UPD_ASYNC
    );
    console.log('Upgraded Update to async modal handler.');
    return src;
  }

  const old =
    'onClick: () => proceedSaveAfterReview("update", matchedClaim), disabled: sourceLockIssues.length > 0 || saving || !isOnline';
  if (src.includes(old)) {
    src = src.replace(old, UPD_ASYNC + ', disabled: sourceLockIssues.length > 0 || saving || !isOnline');
    console.log('Update async confirm wired.');
  } else {
    console.warn('Update onClick pattern not found.');
  }
  return src;
}

source = ensureMatchedClaimWire(source);
source = ensureNewSaveConfirm(source);
source = ensureUpdateConfirm(source);

fs.writeFileSync(file, source);
console.log('Master resolution production patch complete (WO modern modal).');
