const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
const source = fs.readFileSync(file, 'utf8');

const marker = 'SDLG_ALLOW_ZERO_PART_QTY_V2';
if (source.includes(marker)) {
  console.log('Allow-zero part quantity patch already present.');
  process.exit(0);
}

// The validator must reject negative/non-numeric quantities, but zero is a valid
// source value for a parts row and must not block saving. Target only the qty
// comparison so harmless source formatting changes do not break the build patch.
const needle = /Number\(part\.qty\)\s*<=\s*0/;
if (!needle.test(source)) {
  throw new Error('Expected numeric part quantity <= 0 validator was not found. Refusing unsafe patch.');
}

const patched = source.replace(needle, 'Number(part.qty) < 0');
const finalSource = patched.replace(
  /\/\*\s*SDLG_ALLOW_ZERO_PART_QTY_V2\s*\*\//,
  ''
).replace(
  /(?=if\s*\(part\.qty\s*!=\s*null)/,
  `/* ${marker} */\n            `
);

fs.writeFileSync(file, finalSource);
console.log('Applied zero-quantity part validation fix: qty=0 is accepted; negative/non-numeric quantities remain invalid.');
