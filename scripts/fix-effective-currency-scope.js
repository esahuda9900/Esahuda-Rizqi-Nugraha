const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
const source = fs.readFileSync(file, 'utf8');

const inner = `    const effectiveClaimCurrency = (claim) => {
        const claimNo = String(claim?.dealer_claim_no || "").trim().toUpperCase();
        const stored = String(claim?.currency || "").trim().toUpperCase();
        if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return "USD";
        if (/^ORF(?:-|$)/.test(claimNo)) return "CNY";
        return ["USD", "CNY", "IDR"].includes(stored) ? stored : "UNKNOWN";
    };
`;

if (!source.includes(inner)) {
  if (source.includes('function effectiveClaimCurrency(claim)')) {
    console.log('effectiveClaimCurrency already has bundle-scope definition; no patch needed.');
    process.exit(0);
  }
  throw new Error('Expected local effectiveClaimCurrency definition was not found. Refusing unsafe patch.');
}

const topLevel = `\n// Global claim-currency resolver. Keep this at bundle scope because exportToExcel()\n// is defined outside the React component and must resolve currency at call time.\nfunction effectiveClaimCurrency(claim) {\n    const claimNo = String(claim?.dealer_claim_no || "").trim().toUpperCase();\n    const stored = String(claim?.currency || "").trim().toUpperCase();\n    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return "USD";\n    if (/^ORF(?:-|$)/.test(claimNo)) return "CNY";\n    return ["USD", "CNY", "IDR"].includes(stored) ? stored : "UNKNOWN";\n}\n`;

const marker = 'function normalizeClaimCurrency(value, sourceText = "", dealerClaimNo = "") {';
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error('normalizeClaimCurrency marker not found. Refusing unsafe patch.');

const insertAt = source.indexOf('\n}', markerIndex) + 2;
if (insertAt <= 1) throw new Error('normalizeClaimCurrency function boundary not found. Refusing unsafe patch.');

const patched = source.slice(0, insertAt) + topLevel + source.slice(insertAt).replace(inner, '', 1);
fs.writeFileSync(file, patched);
console.log('Applied bundle-scope effectiveClaimCurrency patch.');
