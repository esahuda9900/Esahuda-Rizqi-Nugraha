const fs = require('node:fs');
const path = require('node:path');

// When deterministic Master Unit resolution (exact serial) overwrites the parsed
// model with the authoritative machine model, SOURCE LOCK must not treat that as
// a hard mismatch — the same contract already exists for Indent No.
//
// WO policy v1.4.1 keeps dealerWoSo on Simpan Baru (no UNIQUE on claims.dealer_wo_so).
// Legacy clearWoOnParsed still sets woClearedForCollision + sourceDealerWoSo; SOURCE LOCK
// skips Dealer WO/SO mismatch only in that intentional case.

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(input, pattern, replacement, label) {
  const output = input.replace(pattern, replacement);
  if (output === input) throw new Error(`${label}: target not found; refusing unsafe patch.`);
  return output;
}

// 1) Preserve sourceModel when applying deterministic master resolution.
if (!source.includes('sourceModel: p.sourceModel || p.model || null')) {
  const oldProv = `sourceSerialNo: p.sourceSerialNo || p.serialNo || null,\n            sourceIndentNo: p.sourceIndentNo || p.indentNo || null,`;
  const newProv = `sourceSerialNo: p.sourceSerialNo || p.serialNo || null,\n            sourceIndentNo: p.sourceIndentNo || p.indentNo || null,\n            sourceModel: p.sourceModel || p.model || null,`;
  source = replaceOnce(source, oldProv, newProv, 'sourceModel provenance');
  console.log('Preserved sourceModel during deterministic master resolution.');
} else {
  console.log('sourceModel provenance already present.');
}

// 2) SOURCE LOCK: allow model difference when it came from deterministic master unit.
if (!source.includes('modelCanonicalizedFromMaster')) {
  const oldIndent = `        const indentCanonicalizedFromMaster = label === "Indent No." && p?.masterResolved &&\n            p?.sourceIndentNo != null && cleanSourceCell(p.sourceIndentNo) === cleanSourceCell(source);\n        if (!indentCanonicalizedFromMaster && !modelEquivalent && !serialEquivalentSource && !customerEquivalent && !dealerCodeEquivalent && cleanSourceCell(source) !== cleanSourceCell(value))`;

  const newIndent = `        const indentCanonicalizedFromMaster = label === "Indent No." && p?.masterResolved &&\n            p?.sourceIndentNo != null && cleanSourceCell(p.sourceIndentNo) === cleanSourceCell(source);\n        // Parallel to indent: when Master Unit was resolved by exact serial identity,\n        // the claim model follows the machine master. Source model is kept in sourceModel\n        // for provenance and must not hard-block save.\n        const modelCanonicalizedFromMaster = label === "Model" && p?.masterResolved &&\n            p?.sourceModel != null && cleanSourceCell(p.sourceModel) === cleanSourceCell(source);\n        // Customer follows the explicit claim source when present. The unit master's customer\n        // remains available as machine metadata and must not create a false SOURCE LOCK error.\n        const sourceCustomerName = cleanSourceCell(p?.sourceCustomerName || p?.source_customer_name || "");\n        const customerCanonicalizedFromMaster = /Customer(?:\\s+Name)?/i.test(label) && p?.masterResolved &&\n            sourceCustomerName && sourceCustomerName === cleanSourceCell(source);\n        if (!indentCanonicalizedFromMaster && !modelCanonicalizedFromMaster && !customerCanonicalizedFromMaster && !modelEquivalent && !serialEquivalentSource && !customerEquivalent && !dealerCodeEquivalent && cleanSourceCell(source) !== cleanSourceCell(value))`;

  source = replaceOnce(source, oldIndent, newIndent, 'SOURCE LOCK master model exception');
  console.log('SOURCE LOCK now allows deterministic master-resolved model overrides.');
} else {
  console.log('modelCanonicalizedFromMaster guard already present.');
}

// 3) SOURCE LOCK: intentional WO clear (legacy clearWoOnParsed path).
if (!source.includes('woClearedForCollision')) {
  const oldCmp = `        if (!indentCanonicalizedFromMaster && !modelCanonicalizedFromMaster && !modelEquivalent && !serialEquivalentSource && !customerEquivalent && !dealerCodeEquivalent && cleanSourceCell(source) !== cleanSourceCell(value))\n            issues.push(\`\${label}: source="\${cleanSourceCell(source)}" vs parse="\${cleanSourceCell(value)}"\`);`;

  const newCmp = `        // WO intentionally cleared after collision confirm — not a parse error.\n        // Provenance: sourceDealerWoSo / woClearedForCollision (SDLGWoClaimPolicy.clearWoOnParsed).\n        const woClearedForCollision = label === "Dealer WO/SO" && p?.woClearedForCollision === true &&\n            (cleanSourceCell(value) === "" || value == null);\n        if (!indentCanonicalizedFromMaster && !modelCanonicalizedFromMaster && !woClearedForCollision && !modelEquivalent && !serialEquivalentSource && !customerEquivalent && !dealerCodeEquivalent && cleanSourceCell(source) !== cleanSourceCell(value))\n            issues.push(\`\${label}: source="\${cleanSourceCell(source)}" vs parse="\${cleanSourceCell(value)}"\`);`;

  source = replaceOnce(source, oldCmp, newCmp, 'SOURCE LOCK WO collision clear exception');
  console.log('SOURCE LOCK allows intentional Dealer WO/SO clear after collision.');
} else {
  console.log('woClearedForCollision guard already present.');
}

// 3b) SOURCE LOCK: explicit claim Customer Name is transactional source
if (!source.includes('SDLG_CUSTOMER_SOURCE_LOCK_V1')) {
  const customerGuardMarker = '/* SDLG_CUSTOMER_SOURCE_LOCK_V1 */';
  const customerGuardNeedle = '        if (!indentCanonicalizedFromMaster && !modelCanonicalizedFromMaster &&';
  if (source.includes(customerGuardNeedle)) {
    const customerGuard = `        const customerSourceCanonicalized = /Customer(?:\\s+Name)?/i.test(label) && p?.masterResolved &&
            cleanSourceCell(p?.sourceCustomerName || p?.source_customer_name || "") &&
            cleanSourceCell(p?.sourceCustomerName || p?.source_customer_name || "") === cleanSourceCell(source);
        ${customerGuardMarker}
        if (!customerSourceCanonicalized && !indentCanonicalizedFromMaster && !modelCanonicalizedFromMaster &&`;
    source = source.replace(customerGuardNeedle, customerGuard);
    console.log('SOURCE LOCK customer-source reconciliation guard installed.');
  } else {
    console.warn('SOURCE LOCK customer guard: condition anchor not found; leaving unchanged.');
  }
} else {
  console.log('SOURCE LOCK customer-source reconciliation guard already installed.');
}

// SOURCE CUSTOMER PROVENANCE V2: capture explicit Customer Name before master enrichment.
if (!source.includes('sourceCustomerName: cleanSourceCell(_sourceCustomerName)')) {
  const finalPattern = /const finalParsed = \{ \.\.\.resolvedWithSourceParts, source_raw_text: parserInput, source_fields: buildSourceSnapshot\(parserInput, resolvedWithSourceParts\), source_parse_version: "[^"]+" \};/;
  const match = source.match(finalPattern);
  if (match) {
    const original = match[0];
    const versionMatch = original.match(/source_parse_version: "([^"]+)"/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    const replacement = `const _sourceCustomerName = sourceScalarValue(parserInput, ["Customer Name"]) || "";
            const finalParsed = { ...resolvedWithSourceParts, source_raw_text: parserInput, source_fields: buildSourceSnapshot(parserInput, resolvedWithSourceParts), source_parse_version: "2.35.16", sourceCustomerName: cleanSourceCell(_sourceCustomerName) || null, source_customer_name: cleanSourceCell(_sourceCustomerName) || null };
            // SOURCE CUSTOMER PROVENANCE V2: preserve explicit form customer before master enrichment.
            // Ensure labeled Dealer WO/SO from source is never dropped before SOURCE LOCK.
            if (!cleanSourceCell(finalParsed.dealerWoSo)) {
                const _wo = sourceScalarValue(parserInput, ["Dealer WO/SO"]);
                if (_wo) finalParsed.dealerWoSo = _wo;
            }`;
    source = source.replace(original, replacement);
    console.log('Explicit claim Customer Name provenance captured in finalParsed.');
  } else {
    console.warn('Customer provenance: finalParsed construction not found; leaving unchanged.');
  }
} else {
  console.log('Explicit claim Customer Name provenance already captured.');
}

// 4) Never drop labeled Dealer WO/SO before lock at end of parse.
if (!source.includes('Ensure labeled Dealer WO/SO from source is never dropped')) {
  const oldFinal = `const _sourceCustomerName = sourceScalarValue(parserInput, ["Customer Name"]) || "";\n            const finalParsed = { ...resolvedWithSourceParts, source_raw_text: parserInput, source_fields: buildSourceSnapshot(parserInput, resolvedWithSourceParts), source_parse_version: "2.35.16", sourceCustomerName: cleanSourceCell(_sourceCustomerName) || null, source_customer_name: cleanSourceCell(_sourceCustomerName) || null };\n            // SOURCE CUSTOMER PROVENANCE V1: preserve the explicit form customer before master enrichment.`;
  const newFinal = `const finalParsed = { ...resolvedWithSourceParts, source_raw_text: parserInput, source_fields: buildSourceSnapshot(parserInput, resolvedWithSourceParts), source_parse_version: "2.35.15" };\n            // Ensure labeled Dealer WO/SO from source is never dropped before SOURCE LOCK.\n            if (!cleanSourceCell(finalParsed.dealerWoSo)) {\n                const _wo = sourceScalarValue(parserInput, ["Dealer WO/SO"]);\n                if (_wo) finalParsed.dealerWoSo = _wo;\n            }`;
  if (source.includes(oldFinal)) {
    source = replaceOnce(source, oldFinal, newFinal, 'finalParsed WO backfill');
    console.log('Parse path backfills Dealer WO/SO from source when empty.');
  } else if (source.includes('source_parse_version: "2.35.15"')) {
    console.log('finalParsed WO backfill version already bumped.');
  } else {
    console.warn('finalParsed WO backfill: marker not found (may already be custom).');
  }
} else {
  console.log('finalParsed WO backfill guard already present.');
}

// 5) Vertical layout: value on next row same column for sourceScalarValue.
if (!source.includes('Fallback: value on the next row, same column')) {
  const oldEnd = `    return null;\n};\nconst sourceHasLabel = (rawText, labels) => {`;
  const newEnd = `    // Fallback: value on the next row, same column (vertical Excel layout).\n    for (let li = 0; li < lines.length - 1; li++) {\n        const cells = lines[li].split("\\t");\n        const nextCells = lines[li + 1].split("\\t");\n        for (let ci = 0; ci < cells.length; ci++) {\n            const n = normSourceLabel(cells[ci]);\n            const matched = wanted.find(w => n === w || n.startsWith(w + " "));\n            if (!matched) continue;\n            if (n.startsWith(matched + " ") && n !== matched) {\n                const suffix = stripSourceLabelPrefix(cells[ci], matched);\n                if (suffix && !isLabel(suffix) && !isHelperValue(suffix)) return suffix;\n            }\n            const below = cleanSourceCell(nextCells[ci] || "");\n            if (below && !isLabel(below) && !isHelperValue(below)) return below;\n            for (let cj = ci + 1; cj < nextCells.length; cj++) {\n                const v = cleanSourceCell(nextCells[cj]);\n                if (!v) continue;\n                if (isLabel(v)) break;\n                if (isHelperValue(v)) continue;\n                return v;\n            }\n        }\n    }\n    return null;\n};\nconst sourceHasLabel = (rawText, labels) => {`;
  if (source.includes(oldEnd)) {
    source = replaceOnce(source, oldEnd, newEnd, 'sourceScalarValue vertical fallback');
    console.log('sourceScalarValue: vertical next-row fallback added.');
  } else {
    console.warn('sourceScalarValue vertical fallback: end marker not found.');
  }
} else {
  console.log('sourceScalarValue vertical fallback guard already present.');
}

fs.writeFileSync(file, source);
console.log('Master model SOURCE LOCK patch complete.');
