const fs = require('node:fs');
const path = require('node:path');

// SDLG source forms often print "USD -" as an empty Amount placeholder.
// That must NOT force claim currency to USD.
// Rules:
// - Dealer claim no starting with YNFW → USD (settlement path)
// - Real USD signals ($123, amount with $, explicit currency) → USD
// - Otherwise prefer CNY

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(input, pattern, replacement, label) {
  const output = typeof pattern === 'string'
    ? (input.includes(pattern) ? input.replace(pattern, replacement) : input)
    : input.replace(pattern, replacement);
  if (output === input) throw new Error(`${label}: target not found; refusing unsafe patch.`);
  return output;
}

const oldNorm = `function normalizeClaimCurrency(value, sourceText = "", dealerClaimNo = "") {\n    const v = String(value || "").trim().toUpperCase();\n    const src = String(sourceText || "");\n    const claimNo = String(dealerClaimNo || "").trim().toUpperCase();\n    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return "USD";\n    if (/\\bUSD\\b|\\$/.test(src) && v === "USD") return "USD";\n    if (/\\bIDR\\b|\\bRP\\b/i.test(src) && v === "IDR") return "IDR";\n    if (/¥|CNY/i.test(src)) return "CNY";\n    return "CNY";\n}`;

const newNorm = `function normalizeClaimCurrency(value, sourceText = "", dealerClaimNo = "") {\n    const v = String(value || "").trim().toUpperCase();\n    const src = String(sourceText || "");\n    const claimNo = String(dealerClaimNo || "").trim().toUpperCase();\n    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return "USD";\n    // "USD -" / "USD —" are blank amount markers on SDLG forms, not currency choice.\n    const srcWithoutPlaceholders = src.replace(/\\bUSD\\s*[-–—]+/gi, " ").replace(/\\$\\s*[-–—]+/g, " ");\n    const hasRealUsd = /\\bUSD\\b/i.test(srcWithoutPlaceholders) || /\\$\\s*\\d/.test(srcWithoutPlaceholders);\n    if (hasRealUsd && (v === "USD" || v === "")) return "USD";\n    if (/\\bIDR\\b|\\bRP\\b/i.test(src) && v === "IDR") return "IDR";\n    if (/¥|CNY/i.test(src)) return "CNY";\n    if (v === "USD" && !hasRealUsd) return "CNY";\n    return "CNY";\n}`;

if (source.includes('srcWithoutPlaceholders')) {
  console.log('Currency placeholder fix already present.');
} else {
  source = replaceOnce(source, oldNorm, newNorm, 'normalizeClaimCurrency');
  console.log('Patched normalizeClaimCurrency to ignore USD - placeholders.');
}

const oldAssign = `p.currency = normalizeClaimCurrency(/\\bUSD\\b|\\$/i.test(rawText) ? "USD" : /\\bIDR\\b|\\bRP\\b/i.test(rawText) ? "IDR" : "CNY", rawText, p.dealerClaimNo);`;

const newAssign = `p.currency = normalizeClaimCurrency((() => {\n        const cleaned = String(rawText || "").replace(/\\bUSD\\s*[-–—]+/gi, " ").replace(/\\$\\s*[-–—]+/g, " ");\n        if (/\\bUSD\\b/i.test(cleaned) || /\\$\\s*\\d/.test(cleaned)) return "USD";\n        if (/\\bIDR\\b|\\bRP\\b/i.test(rawText)) return "IDR";\n        return "CNY";\n    })(), rawText, p.dealerClaimNo);`;

if (source.includes('const cleaned = String(rawText || "").replace(/\\bUSD\\s*[-–—]+/gi')) {
  console.log('Currency assign already hardened.');
} else if (source.includes(oldAssign)) {
  source = replaceOnce(source, oldAssign, newAssign, 'parser currency assign');
  console.log('Patched parser currency assignment.');
} else {
  console.log('Parser currency assign pattern not found (may already differ); normalizeClaimCurrency still hardened.');
}

fs.writeFileSync(file, source);
console.log('Currency USD-placeholder patch complete.');
