const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const fail = (message) => {
  console.error(`PUBLIC RELEASE CHECK FAILED: ${message}`);
  process.exitCode = 1;
};

const index = read('index.html');
const core = read('modules/sdlg-core.js');
const helper = read('canonical-warranty-helper.js');
const build = read('scripts/build-production.js');

// Browser-delivered source must never contain Supabase privileged credentials.
for (const needle of ['service_role', 'SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_']) {
  if (index.includes(needle) || core.includes(needle) || helper.includes(needle)) {
    fail(`privileged credential marker found in browser-delivered source: ${needle}`);
  }
}

// Prevent the exact class of regression that previously rendered Feedback Person as a
// literal template string in a React value/defaultValue prop. Executable template
// interpolation elsewhere remains valid and is intentionally not blocked.
const literalFeedbackFieldPattern = /\b(?:value|defaultValue)\s*:\s*["']\$\{sdlgFeedbackPerson\(selectedClaim\)\}["']/;
if (literalFeedbackFieldPattern.test(index)) {
  fail('literal Feedback Person interpolation remains in a value/defaultValue field');
}

// Canonical source-of-truth wiring must remain present.
for (const needle of [
  'modules/sdlg-core.js',
  'canonical-warranty-helper.js',
  'SDLGCore',
]) {
  if (!index.includes(needle) && !core.includes(needle)) {
    fail(`required canonical wiring marker missing: ${needle}`);
  }
}

// Legacy injector freeze: prevent the disabled zero-display patch from silently returning.
const buildScripts = [...build.matchAll(/'([^']+\.js)'/g)].map((match) => match[1]);
if (buildScripts.includes('apply-zero-display-fix.js')) {
  fail('disabled apply-zero-display-fix.js is active in the production build chain');
}

// Required production verification gates must execute after the build transformations.
for (const verifier of [
  'verify-production.js',
  'verify-parser-contract.js',
  'verify-warranty-contract.js',
  'verify-dual-warranty-routing.js',
  'verify-source-lock.js',
  'verify-claim-id-year-contract.js',
]) {
  if (!build.includes(verifier)) {
    fail(`required regression gate is missing from build-production.js: ${verifier}`);
  }
}

// Cloudflare-only: vercel.json must stay retired.
if (fs.existsSync(path.join(root, 'vercel.json'))) {
  fail('vercel.json is present — Cloudflare is the sole production host; remove Vercel config');
}
if (!fs.existsSync(path.join(root, 'wrangler.jsonc'))) {
  fail('wrangler.jsonc missing — Cloudflare production config is required');
}

// Keep the critical browser shell available before attempting deployment.
for (const relativePath of [
  'index.html',
  'modules/sdlg-core.js',
  'canonical-warranty-helper.js',
  'modules/claim-parser-helpers.js',
  'modules/export-table-helper.js',
]) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).size === 0) {
    fail(`required release file missing or empty: ${relativePath}`);
  }
}

if (!process.exitCode) {
  console.log('PUBLIC RELEASE CHECK PASSED: credential exposure, known UI regression, canonical wiring, injector freeze, Cloudflare-only host, regression gates, and release files are clean.');
}
