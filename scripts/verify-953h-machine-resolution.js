const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const corePath = path.join(process.cwd(), 'modules', 'sdlg-core.js');
const indexPath = path.join(process.cwd(), 'index.html');
const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260923093000_fix_machine_resolver_953h_canonical_alias.sql'
);

const coreSource = fs.readFileSync(corePath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const migrationSource = fs.readFileSync(migrationPath, 'utf8');

const sandbox = { window: {} };
vm.runInNewContext(coreSource, sandbox, { filename: corePath });

const canonical = sandbox.window.SDLGCanonicalModel;
const equivalent = sandbox.window.SDLGModelsEquivalent;

const cases = [
  ['SDLG 953H', 'L953H'],
  ['SDLG953H', 'L953H'],
  ['953H', 'L953H'],
  ['L953H', 'L953H'],
  ['E6210F', 'E6210F']
];

for (const [input, expected] of cases) {
  const actual = canonical(input);
  if (actual !== expected) {
    throw new Error(
      `Canonical model regression failed: ${JSON.stringify(input)} -> ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    );
  }
}

if (!equivalent('SDLG 953H', 'L953H')) {
  throw new Error('Model equivalence regression failed: SDLG 953H must equal L953H.');
}

const requiredIndexSignals = [
  '"953H": "L953H"',
  '"SDLG953H": "L953H"',
  '"L953H": "L953H"'
];

for (const signal of requiredIndexSignals) {
  if (!indexSource.includes(signal)) {
    throw new Error(`index.html missing canonical 953H alias signal: ${signal}`);
  }
}

const requiredMigrationSignals = [
  "IN ('SDLG953H','953H')",
  "THEN 'L953H'",
  'resolve_machine_candidates'
];

for (const signal of requiredMigrationSignals) {
  if (!migrationSource.includes(signal)) {
    throw new Error(`Migration missing 953H resolver signal: ${signal}`);
  }
}

console.log(
  `953H machine-resolution contract PASS: ${cases.length} canonical cases + equivalence + source/migration guards`
);
