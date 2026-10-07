/**
 * Strip unsafe branch inference from production index.html.
 *
 * Policy (2026-09-28/29):
 * - Branch belongs to the UNIT (serial), not indent, not customer.
 * - Keep: same-serial claim history → exact branch.
 * - Remove: indent + model + customer multi-unit inference (false matches).
 *
 * Uses brace-balanced removal (never greedy regex across the monolith).
 *
 * Run from repo root:
 *   node scripts/apply-branch-unit-only.js
 * Then commit index.html and deploy (push main → Cloudflare).
 *
 * Note: scripts/apply-master-resolution-ux.js runs the same strip during
 * build-production.js, so a normal CF build also cleans the block.
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
if (!fs.existsSync(file)) {
  console.error('index.html not found; run from repo root.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');
const before = source.length;
const MARKER = 'Branch diinfer dari histori indent + model + customer';

function stripIndentBranchInference(src) {
  if (!src.includes(MARKER)) {
    return { source: src, stripped: false, reason: 'no-marker' };
  }

  let guard = 0;
  let working = src;
  while (working.includes(MARKER) && guard < 5) {
    guard += 1;
    const markerIdx = working.indexOf(MARKER);
    let elseIdx = working.lastIndexOf('else {', markerIdx);
    if (elseIdx < 0) {
      return { source: working, stripped: false, reason: 'else-not-found' };
    }

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
    if (end < 0) {
      return { source: working, stripped: false, reason: 'unbalanced' };
    }

    const span = end - elseIdx;
    if (span > 20000) {
      return { source: working, stripped: false, reason: `span-too-large:${span}` };
    }
    if (!working.slice(elseIdx, end).includes(MARKER)) {
      return { source: working, stripped: false, reason: 'span-missing-marker' };
    }
    working = working.slice(0, elseIdx) + working.slice(end);
  }

  if (working.includes(MARKER)) {
    return { source: working, stripped: false, reason: 'marker-remains' };
  }
  return { source: working, stripped: true, reason: 'ok' };
}

const result = stripIndentBranchInference(source);
let changes = 0;

if (result.stripped) {
  source = result.source;
  changes += 1;
  console.log('Removed indent+model+customer branch inference block (brace-balanced).');
} else if (result.reason === 'no-marker') {
  console.log('No indent branch-inference marker found (already clean or never injected).');
} else {
  console.error('Found indent-inference marker but could not safely strip:', result.reason);
  process.exit(2);
}

// Soften any remaining inline comments that advertise indent branch inference
if (source.includes('same-indent + same-model + same-customer')) {
  source = source.replace(
    /same-indent \+ same-model \+ same-customer inference/g,
    'unit-serial-only branch resolution (indent inference removed)'
  );
  changes += 1;
}

if (changes === 0) {
  console.log('Nothing to change.');
  process.exit(0);
}

fs.writeFileSync(file, source);
console.log(`Wrote index.html (${before} → ${source.length} bytes). Commit and deploy.`);
