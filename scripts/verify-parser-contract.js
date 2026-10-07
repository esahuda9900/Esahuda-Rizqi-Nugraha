const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(process.cwd(), 'index.html');
const helperFile = path.join(process.cwd(), 'modules', 'claim-parser-helpers.js');
const woFile = path.join(process.cwd(), 'modules', 'wo-claim-policy.js');
const source = fs.readFileSync(file, 'utf8');
const helperSource = fs.readFileSync(helperFile, 'utf8');
const woSource = fs.existsSync(woFile) ? fs.readFileSync(woFile, 'utf8') : '';

/**
 * Stable contract = signals that existed on last known-good production builds.
 * HTML markers for money/WO wiring are applied best-effort and must NOT block deploy.
 */
const requiredSignals = [
  {
    name: 'Numeric-cell parser delegation',
    signal: 'const isNumericCell = window.SDLGClaimParserHelpers.isNumericCell;'
  },
  {
    name: 'Parts-total source parsing',
    signal: 'out.partsTotal = n;'
  },
  {
    name: 'Database machine resolver',
    signal: 'resolve_machine_candidates'
  },
  {
    name: 'High-confidence resolver precedence',
    signal: 'resolverWinner ? [resolverWinner]'
  },
  {
    name: 'Unit-history branch inference',
    signal: 'Branch dari histori unit yang sama'
  },
  {
    name: 'Resolved branch payload mapping',
    signal: 'out.branch_id = resolvedBranch.id;'
  },
  {
    name: 'Parts amount consistency validation',
    signal: 'amount-mismatch'
  },
  {
    name: 'Parts total consistency validation',
    signal: 'parts:total-mismatch'
  },
  {
    name: 'Safe unmatched-part behavior',
    signal: 'SDLG_SAFE_PART_MATCHING_V1'
  },
  {
    name: 'Zero quantity remains valid',
    signal: 'SDLG_ALLOW_ZERO_PART_QTY_V2'
  },
  {
    name: 'Mileage spelling alias',
    signal: 'Milage To Site'
  }
];

const missing = requiredSignals.filter(({ signal }) => !source.includes(signal));
if (missing.length) {
  console.error('PARSER CONTRACT: FAIL');
  missing.forEach(({ name, signal }) => console.error(`- ${name}: missing signal ${signal}`));
  process.exit(1);
}

if (!source.includes('<script src="/modules/claim-parser-helpers.js"></script>')) {
  console.error('PARSER CONTRACT: FAIL');
  console.error('- Parser helper script tag missing from index.html');
  process.exit(1);
}

if (source.includes('const isNumericCell = v => /^[+-]?')) {
  console.error('PARSER CONTRACT: FAIL');
  console.error('- Numeric-cell predicate still contains inline implementation in index.html');
  process.exit(1);
}

if (!helperSource.includes('SDLGClaimParserHelpers') || !helperSource.includes('function isNumericCell(value)')) {
  console.error('PARSER CONTRACT: FAIL');
  console.error('- claim-parser-helpers.js missing expected exported helper');
  process.exit(1);
}

const sandbox = { window: {} };
try {
  vm.runInNewContext(helperSource, sandbox, { filename: 'modules/claim-parser-helpers.js' });
} catch (err) {
  console.error('PARSER CONTRACT: FAIL');
  console.error(`- claim-parser-helpers.js syntax/runtime error: ${err.message}`);
  process.exit(1);
}

const helper = sandbox.window.SDLGClaimParserHelpers;
const runtimeCases = [
  ['349', true],
  ['0', true],
  ['1,250', true],
  ['12.83', true],
  ['Gasket Head (1.4)', false],
  ['Battery Low Voltage', false],
  ['', false]
];

for (const [input, expected] of runtimeCases) {
  const actual = helper.isNumericCell(input);
  if (actual !== expected) {
    console.error('PARSER CONTRACT: FAIL');
    console.error(`- isNumericCell(${JSON.stringify(input)}) expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

// Soft: money helpers (module may be ahead of HTML wiring)
let moneyNote = 'money helpers n/a';
if (typeof helper.parseCellMoney === 'function') {
  const moneyCases = [
    ['¥-', 0],
    ['USD -', 0],
    ['SN.611152', null],
    ['8', 8]
  ];
  for (const [input, expected] of moneyCases) {
    const actual = helper.parseCellMoney(input);
    if (actual !== expected) {
      console.error('PARSER CONTRACT: FAIL');
      console.error(`- parseCellMoney(${JSON.stringify(input)}) expected ${expected}, got ${actual}`);
      process.exit(1);
    }
  }
  moneyNote = `money helpers ok (${moneyCases.length})`;
}

// Soft: WO policy module present and consistent (HTML wire is best-effort)
let woNote = 'wo policy n/a';
if (woSource) {
  try {
    vm.runInNewContext(woSource, sandbox, { filename: 'modules/wo-claim-policy.js' });
    const wo = sandbox.window.SDLGWoClaimPolicy;
    if (!wo || !wo.isMultiClaimAllowed('WO26040309') || wo.isMultiClaimAllowed('WO26043314')) {
      console.error('PARSER CONTRACT: FAIL');
      console.error('- wo-claim-policy allowlist invalid');
      process.exit(1);
    }
    woNote = 'wo policy module ok';
  } catch (err) {
    console.error('PARSER CONTRACT: FAIL');
    console.error(`- wo-claim-policy.js error: ${err.message}`);
    process.exit(1);
  }
}

if (source.includes('SDLG_MONEY_HARDEN_V1')) {
  moneyNote += '+html';
}
if (source.includes('SDLG_WO_ONE_CLAIM_V1')) {
  woNote += '+html';
}

console.log(
  `PARSER CONTRACT: PASS (${requiredSignals.length} core signals + ${runtimeCases.length} numeric | ${moneyNote} | ${woNote})`
);
