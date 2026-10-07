const fs = require('node:fs');
const path = require('node:path');

// Root cause:
// The early inline window.SDLGCanonicalModel / SDLGModelsEquivalent in index.html
// overwrites the module version and does not know that SDLG 968F ≈ 968F ≈ L968F.
// SOURCE LOCK then treats a benign canonical rename as a hard mismatch and blocks save.
//
// This patch only extends the existing inline alias map. It does not disable SOURCE LOCK.

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

const oldBlock = `const aliases={\n          SDLGG9138F:"G9138F-LS", G9138F:"G9138F-LS", G9138FLS:"G9138F-LS",\n          SDLGRS7120H:"RS7120H-LS", RS7120H:"RS7120H-LS", RS7120HLS:"RS7120H-LS",\n          SDLGE6210F:"E6210F", E6210F:"E6210F",\n          SDLGE660FL:"E660FL", E660FL:"E660FL"\n        };`;

const newBlock = `const aliases={\n          SDLGG9138F:"G9138F-LS", G9138F:"G9138F-LS", G9138FLS:"G9138F-LS",\n          SDLGRS7120H:"RS7120H-LS", RS7120H:"RS7120H-LS", RS7120HLS:"RS7120H-LS",\n          SDLGE6210F:"E6210F", E6210F:"E6210F",\n          SDLGE660FL:"E660FL", E660FL:"E660FL",\n          SDLG968F:"L968F", "968F":"L968F", L968F:"L968F"\n        };`;

if (!source.includes(oldBlock)) {
  if (source.includes('SDLG968F:"L968F"') || source.includes("SDLG968F:'L968F'")) {
    console.log('Inline SDLG 968F canonical alias already present.');
    process.exit(0);
  }
  throw new Error('Inline SDLGCanonicalModel alias block not found; refusing unsafe patch.');
}

source = source.replace(oldBlock, newBlock);
fs.writeFileSync(file, source);
console.log('Patched inline SDLGCanonicalModel aliases: SDLG 968F / 968F → L968F.');
