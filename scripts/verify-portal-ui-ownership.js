'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = fs.readFileSync(path.join(__dirname, '../modules/claim-fields.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');
const forbidden = [
  'sdlg-portal-ux-v2.js',
  'sdlg-ui-consolidate.js',
  'sdlg-hash-tab-bridge.js',
  'sdlg-input-claim-sync.js',
  'sdlg-input-hydrate.js'
];
const config = loader.match(/var MODULES = \[([\s\S]*?)\];/);
assert.ok(config, 'module loader must expose a static MODULES list');
for (const moduleName of forbidden) {
  assert.ok(!config[1].includes(moduleName), 'Conflicting DOM owner reactivated: ' + moduleName);
}
assert.match(app, /function SDLGPortalInputPage\(/, 'React portal form must remain present');
assert.match(app, /data-sdlg-input-helper/, 'React portal form root must remain present');
assert.match(app, /data-sdlg-copy-all/, 'React copy controls must remain present');
assert.match(app, /data-sdlg-copy/, 'Individual copy controls must remain present');
console.log('PORTAL UI OWNERSHIP PASS: React owns portal fields and copy controls; conflicting legacy modules disabled');
