const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
const externalTag = '<script src="canonical-warranty-helper.js?v=20261013-v2"></script>';

// Remove any previously injected inline Canonical Warranty Helper block.
source = source.replace(/<script>\s*\/\* SDLG_WARRANTY_HELPER_CANONICAL_V\d+ \*\/\s*[\s\S]*?<\/script>\s*/g, '');

// Normalize external wiring; a filename in a comment is not proof that the helper is loaded.
const externalTagPattern = /<script\b[^>]*\bsrc=["']\/?canonical-warranty-helper\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi;
source = source.replace(externalTagPattern, '');

const insertion = '</body>';
if (!source.includes(insertion)) {
  throw new Error('Warranty Helper canonical patch: </body> not found.');
}
source = source.replace(insertion, externalTag + '\n' + insertion);
fs.writeFileSync(file, source);
console.log('Canonical Warranty Helper tag normalized to exactly one cache-busted external script.');
