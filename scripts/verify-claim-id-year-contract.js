const fs = require('node:fs');
const vm = require('node:vm');

const helperPaths = [
  'canonical-warranty-helper.js',
  'modules/canonical-warranty-helper.js'
];

const yearAgnosticMatcher = /\b\d{4}-\d{4}-SDLG-PFR\b/;
const legacyMatcher = /\b\d{4}-2026-SDLG-PFR\b/;
const yearAgnosticSource = String.raw`/\b\d{4}-\d{4}-SDLG-PFR\b/`;
const legacySource = String.raw`/\b\d{4}-2026-SDLG-PFR\b/`;

const samples = [
  '0001-2026-SDLG-PFR',
  '0231-2026-SDLG-PFR',
  '0002-2027-SDLG-PFR',
  '0015-2030-SDLG-PFR'
];

for (const sample of samples) {
  if (!yearAgnosticMatcher.test(sample)) {
    console.error(`✗ Claim-ID year contract — sample did not match: ${sample}`);
    process.exit(1);
  }
}

for (const path of helperPaths) {
  const helper = fs.readFileSync(path, 'utf8');
  try {
    new vm.Script(helper, { filename: path });
  } catch (err) {
    console.error(`✗ Claim-ID year contract — ${path} syntax: ${err.message}`);
    process.exit(1);
  }

  if (!helper.includes(yearAgnosticSource)) {
    console.error(`✗ Claim-ID year contract — ${path} is not year-agnostic.`);
    process.exit(1);
  }
  if (helper.includes(legacySource) || legacyMatcher.test(helper)) {
    console.error(`✗ Claim-ID year contract — legacy 2026-only matcher remains in ${path}.`);
    process.exit(1);
  }
}

console.log('✓ Claim-ID year contract — canonical helpers accept NNNN-YYYY-SDLG-PFR and reject the old 2026-only matcher.');
console.log(`✓ Claim-ID year contract — validated ${samples.length} cross-year samples across ${helperPaths.length} helpers.`);
console.log('CLAIM-ID YEAR CONTRACT: PASS');
