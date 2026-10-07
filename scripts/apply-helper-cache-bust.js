const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
const next = 'canonical-warranty-helper.js?v=20261006-mirror155';
if (source.includes('canonical-warranty-helper.js')) {
  const updated = source.replace(/canonical-warranty-helper\.js(?:\?v=[^"'\s>]*)?/g, next);
  if (updated !== source) {
    fs.writeFileSync(file, updated);
    console.log('[apply-helper-cache-bust] updated to', next);
  } else console.log('[apply-helper-cache-bust] no change');
} else console.log('[apply-helper-cache-bust] no helper tag');
