const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

const externalTag = '<script src="/canonical-warranty-helper.js"></script>';
if (source.includes('canonical-warranty-helper.js')) {
  console.log('Warranty Helper external runtime already present; no change.');
  process.exit(0);
}

// Remove any previously injected inline Canonical Warranty Helper block.
// The generated helper has a unique marker and contains no nested </script> tag.
source = source.replace(/<script>\s*\/\* SDLG_WARRANTY_HELPER_CANONICAL_V\d+ \*\/\s*[\s\S]*?<\/script>\s*/g, '');

const insertion = '</body>';
if (!source.includes(insertion)) {
  throw new Error('Warranty Helper canonical patch: </body> not found.');
}
source = source.replace(insertion, externalTag + '\n' + insertion);
fs.writeFileSync(file, source);
console.log('Applied Canonical Warranty Helper as external runtime script.');
