/**
 * Production patch chain for the monolithic index.html.
 *
 * FREEZE RULE: do not append new apply-*.js for routine fixes.
 * Prefer modules/*.js; the existing apply chain is compatibility glue for the monolith.
 * apply-zero-display-fix.js must never return to this list.
 * Navigation restore regression guard: detailId persistence is injected only after detailId initialization.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const INDEX_PATH = path.join(process.cwd(), 'index.html');
const PROD_URL = process.env.SDLG_PROD_INDEX_URL || 'https://sdlg-warranty-backup.esahuda9900.workers.dev/';

function indexLooksHealthy(source) {
  if (!source || typeof source !== 'string') return false;
  if (source.length < 1_000_000) return false;
  if (!source.includes('</head>')) return false;
  if (!source.includes('<!DOCTYPE') && !source.includes('<!doctype')) return false;
  if (/^PLACEHOLDER\s*$/m.test(source.slice(0, 200))) return false;
  if (source.slice(0, 80).includes('/tmp/sdlg')) return false;
  if (!source.includes('SOURCE LOCK') && !source.includes('SDLG')) return false;
  return true;
}

function assertHealthyIndex(source) {
  if (!source || typeof source !== 'string') throw new Error('index.html is missing or unreadable');
  if (source.length < 1_000_000) throw new Error('index.html is unexpectedly small; refusing a placeholder source');
  if (!source.includes('</head>')) throw new Error('index.html is missing </head>');
  if (!source.includes('<!DOCTYPE') && !source.includes('<!doctype')) throw new Error('index.html is missing a DOCTYPE');
  if (/^PLACEHOLDER\\s*$/m.test(source.slice(0, 200))) throw new Error('index.html contains PLACEHOLDER content');
  if (source.slice(0, 80).includes('/tmp/sdlg')) throw new Error('index.html contains a temporary path');
  if (!source.includes('SOURCE LOCK') && !source.includes('SDLG')) throw new Error('index.html is missing SDLG source markers');
  return source;
}


const scripts = [
  'apply-ui-redesign.js',
  'apply-responsive-ui.js',
  'apply-parts-parser-fix.js',
  'apply-safe-part-matching.js',
  'apply-allow-zero-part-qty.js',
  'apply-wo-save-fallback.js',
  'apply-export-table-helper.js',
  'apply-externalize-sdlg-core.js',
  'apply-master-resolution-ux.js',
  'apply-master-model-source-lock.js',
  'apply-warranty-helper-canonical.js',
  'apply-feedback-person-from-claim.js',
  'repair-feedback-person-render.js',
  'apply-boss-analytics-dashboard.js',
  'apply-perf-progressive-claims.js',
  'apply-helper-cache-bust.js',
  'apply-nav-detail-restore.js',
  'apply-inline-claim-restore.js',
  'apply-nav-state-cache-bust.js',
  'apply-modern-refresh.js'
];

const hasSupabase = Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
if (!hasSupabase && !process.env.SKIP_WARRANTY_GOLDEN) process.env.SKIP_WARRANTY_GOLDEN = '1';

function runNode(scriptPath) {
  console.log('\n>>> ' + scriptPath);
  try {
    const out = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    if (out && out.trim()) process.stdout.write(out.endsWith('\n') ? out : out + '\n');
  } catch (err) {
    if (err.stdout) process.stdout.write(String(err.stdout));
    if (err.stderr) process.stderr.write(String(err.stderr));
    process.exit(typeof err.status === 'number' ? err.status : 1);
  }
}

(async function main() {
  try {
    const current = fs.readFileSync(INDEX_PATH, 'utf8');
    assertHealthyIndex(current);
    console.log('index.html source verified (' + current.length + ' bytes).');
  } catch (err) {
    console.error('BUILD FAILED', err && err.message ? err.message : err);
    process.exit(1);
  }
  for (const script of scripts) runNode('scripts/' + script);
  runNode('scripts/verify-production.js');
  runNode('scripts/verify-parser-contract.js');
  if (hasSupabase && !process.env.SKIP_WARRANTY_GOLDEN) runNode('scripts/verify-warranty-contract.js');
  runNode('scripts/verify-dual-warranty-routing.js');
  runNode('scripts/verify-source-lock.js');
  runNode('scripts/verify-claim-id-year-contract.js');
  runNode('scripts/verify-public-release.js');
  runNode('scripts/verify-module-syntax.js');
  console.log('\nPRODUCTION BUILD: complete');
})();
