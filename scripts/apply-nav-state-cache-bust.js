/** Force browsers/CDN to load navigation-state with embedded claim restore. */
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
const next = 'navigation-state.js?v=20261001-restore2';
if (!source.includes('navigation-state.js')) {
  console.warn('[nav-state-bust] navigation-state.js not referenced');
  process.exit(0);
}
const updated = source.replace(/navigation-state\.js(?:\?v=[^"'\s>]*)?/g, next);
if (updated === source) {
  console.log('[nav-state-bust] no change');
  process.exit(0);
}
fs.writeFileSync(file, updated);
console.log('[nav-state-bust] ->', next);
