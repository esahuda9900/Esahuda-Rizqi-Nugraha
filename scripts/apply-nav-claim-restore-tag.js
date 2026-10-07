/** Inject nav-claim-restore module into index.html head (refresh stay-on-claim). */
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
const tag = '<script src="/modules/nav-claim-restore.js?v=20261001"></script>';
if (source.includes('nav-claim-restore.js')) {
  console.log('[nav-claim-restore-tag] already present');
  process.exit(0);
}
if (!source.includes('</head>')) {
  console.warn('[nav-claim-restore-tag] no </head>');
  process.exit(0);
}
source = source.replace('</head>', tag + '\n</head>');
fs.writeFileSync(file, source);
console.log('[nav-claim-restore-tag] injected');
