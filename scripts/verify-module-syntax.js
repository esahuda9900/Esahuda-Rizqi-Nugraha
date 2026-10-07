const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Production modules are classic <script> assets (Cloudflare Workers static).
// They must parse as scripts: no bare import/export (ESM).
// Scans modules/ recursively (top-level + core/parser/ui scaffolds).
const root = path.join(process.cwd(), 'modules');
const failures = [];

function looksLikeEsm(source) {
  return /^\s*(import\s|export\s)/m.test(source);
}

function collectJsFiles(dir, base) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = path.join(base, ent.name).replace(/\\/g, '/');
    if (ent.isDirectory()) {
      out.push.apply(out, collectJsFiles(full, rel));
    } else if (ent.isFile() && ent.name.endsWith('.js')) {
      out.push({ full: full, rel: rel });
    }
  }
  return out;
}

const files = collectJsFiles(root, 'modules').sort(function (a, b) {
  return a.rel.localeCompare(b.rel);
});

for (const item of files) {
  const source = fs.readFileSync(item.full, 'utf8');
  try {
    new vm.Script(source, { filename: item.rel });
    console.log('\u2713 ' + item.rel);
  } catch (err) {
    let msg = err.message;
    if (looksLikeEsm(source) || /Unexpected token 'export'|Unexpected token 'import'/.test(msg)) {
      msg +=
        ' | Hint: modules JS files must be classic scripts (IIFE), not ESM. ' +
        'Remove top-level import/export or wrap in (function(){ ... })();';
    }
    failures.push(item.rel + ': ' + msg);
    console.error('\u2717 ' + item.rel + ': ' + msg);
    if (err && err.stack) console.error(err.stack);
  }
}

if (failures.length) {
  console.error('MODULE SYNTAX CHECK: FAIL (' + failures.length + ')');
  process.exit(1);
}

console.log('MODULE SYNTAX CHECK: PASS (' + files.length + ' module(s))');
