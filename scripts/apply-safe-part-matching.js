const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
const source = fs.readFileSync(file, 'utf8');

const marker = 'SDLG_SAFE_PART_MATCHING_V1';
if (source.includes(marker)) {
  console.log('Safe part matching patch already present.');
  process.exit(0);
}

const old = `if (!partCandidates.length && pd) {\n                partCandidates = partsActive.map(x => ({ ...x, _score: similarityScore(pd, x.part_name || "") })).filter(x => x._score >= 0.55).sort((x, y) => y._score - x._score).slice(0, 5);\n            }`;

const replacement = `/* ${marker} */\n            if (!partCandidates.length && pd) {\n                // Source part number is authoritative. Do not invent a master part\n                // from description similarity when the exact part number is absent.\n                // A wrong fuzzy match can silently corrupt warranty history/claims.\n                partCandidates = [];\n            }`;

if (!source.includes(old)) {
  throw new Error('Expected fuzzy part-matching fallback was not found. Refusing unsafe patch.');
}

const patched = source.replace(old, replacement);
fs.writeFileSync(file, patched);
console.log('Applied safe part matching: no fuzzy master-part fallback for unmatched part numbers.');
