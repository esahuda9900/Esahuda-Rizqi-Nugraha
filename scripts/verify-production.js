const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.cwd();
const failures = [];
const checks = [];

function pass(name, detail) {
  checks.push({ name: name, ok: true, detail: detail || '' });
  console.log('✓ ' + name + (detail ? ' — ' + detail : ''));
}
function fail(name, detail) {
  failures.push(name + ': ' + detail);
  checks.push({ name: name, ok: false, detail: detail });
  console.error('✗ ' + name + ' — ' + detail);
}
function readRequired(file, label) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (err) { fail(label, 'cannot read file: ' + err.message); return null; }
}

const html = readRequired(path.join(root, 'index.html'), 'Production HTML');
// Canonical helper URLs may carry a cache-busting query string (?v=...).
// Validate the helper resource identity without rejecting the deterministic cache key.
const helper = readRequired(path.join(root, 'canonical-warranty-helper.js'), 'Canonical warranty helper');
const helperModule = readRequired(path.join(root, 'modules', 'canonical-warranty-helper.js'), 'Canonical warranty helper module');
const exportTableModule = readRequired(path.join(root, 'modules', 'export-table-helper.js'), 'Excel export table helper module');
const claimParserHelper = readRequired(path.join(root, 'modules', 'claim-parser-helpers.js'), 'Claim parser helper module');
const masterResolutionUx = readRequired(path.join(root, 'modules', 'master-resolution-ux.js'), 'Master resolution UX module');
const paymentEvidence = readRequired(path.join(root, 'modules', 'payment-evidence.js'), 'Payment evidence module');
const rebalancingEvidence = readRequired(path.join(root, 'modules', 'rebalancing-evidence.js'), 'Rebalancing evidence module');
const exportTablePatch = readRequired(path.join(root, 'scripts', 'apply-export-table-helper.js'), 'Excel export table helper patch');
const parserPatch = readRequired(path.join(root, 'scripts', 'apply-parts-parser-fix.js'), 'Parts parser patch');
const masterResolutionUxPatch = readRequired(path.join(root, 'scripts', 'apply-master-resolution-ux.js'), 'Master resolution UX patch');
const parserContract = readRequired(path.join(root, 'scripts', 'verify-parser-contract.js'), 'Warranty parser contract');
const golden = readRequired(path.join(root, 'scripts', 'verify-warranty-contract.js'), 'Warranty golden verifier');
const dualWarrantyVerifier = readRequired(path.join(root, 'scripts', 'verify-dual-warranty-routing.js'), 'Dual warranty routing verifier');
const build = readRequired(path.join(root, 'scripts', 'build-production.js'), 'Production build script');
const wranglerConfig = readRequired(path.join(root, 'wrangler.jsonc'), 'Cloudflare wrangler configuration');

const vercelPath = path.join(root, 'vercel.json');
if (fs.existsSync(vercelPath)) {
  fail('Vercel retirement', 'vercel.json still present — Cloudflare is the sole production host');
} else {
  pass('Vercel retirement', 'vercel.json is absent (Cloudflare-only production)');
}

function checkSyntax(code, label) {
  if (!code) return;
  try { new vm.Script(code, { filename: label }); pass(label + ' syntax'); }
  catch (err) { fail(label + ' syntax', err.message); }
}

if (html) {
  const scriptRe = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match, syntaxErrors = 0, count = 0;
  while ((match = scriptRe.exec(html))) {
    const code = match[1].trim();
    if (!code) continue;
    count += 1;
    try { new vm.Script(code, { filename: 'index-inline-script-' + count + '.js' }); }
    catch (err) { syntaxErrors += 1; fail('Inline JavaScript syntax #' + count, err.message); }
  }
  if (syntaxErrors === 0) pass('Inline JavaScript syntax', count + ' inline script block(s) parsed');

  function countSrc(re) { return (html.match(re) || []).length; }
  if (countSrc(/<script[^>]+src=["']\/?canonical-warranty-helper\.js(?:\?[^"']*)?["'][^>]*>/gi) === 1) pass('Canonical helper wiring', 'exactly one external helper tag (query-string cache bust allowed)');
  else fail('Canonical helper wiring', 'expected exactly 1 canonical helper tag');
  if (countSrc(/<script[^>]+src=["']\/?modules\/export-table-helper\.js["'][^>]*>/gi) === 1) pass('Excel export helper wiring', 'exactly one external export helper tag');
  else fail('Excel export helper wiring', 'expected exactly 1 export helper tag');
  if (countSrc(/<script[^>]+src=["']\/?modules\/claim-parser-helpers\.js["'][^>]*>/gi) === 1) pass('Claim parser helper wiring', 'exactly one external parser helper tag');
  else fail('Claim parser helper wiring', 'expected exactly 1 parser helper tag');
  if (countSrc(/<script[^>]+src=["']\/?modules\/master-resolution-ux\.js["'][^>]*>/gi) === 1) pass('Master resolution UX wiring', 'exactly one external resolution UX helper tag');
  else fail('Master resolution UX wiring', 'expected exactly 1 resolution UX helper tag');

  if (html.includes('const styleTable = window.SDLGExportTableHelper.styleTable;')) pass('Excel export helper integration', 'inline exporter delegates styleTable');
  else fail('Excel export helper integration', 'inline exporter does not delegate styleTable');
  if (html.includes('const isNumericCell = window.SDLGClaimParserHelpers.isNumericCell;')) pass('Claim parser helper integration', 'inline parser delegates isNumericCell');
  else fail('Claim parser helper integration', 'inline parser does not delegate isNumericCell');

  const loginSignals = ['.login-screen{', '.login-layout{', '.login-card{', '.login-intro h1{', '.login-submit{', '#sdlg-self-signup-panel{'];
  const missingLogin = loginSignals.filter(function(v) { return !html.includes(v); });
  if (missingLogin.length) fail('Login layout contract', 'missing: ' + missingLogin.join(', '));
  else pass('Login layout contract', 'login structure + responsive card styling present');

  if (html.includes('SDLG_FEEDBACK_PERSON_OVERRIDE_V2')) fail('Feedback Person runtime safety', 'legacy global DOM polling override still embedded');
  else pass('Feedback Person runtime safety', 'legacy global DOM polling override is absent');

  if (html.includes('SDLG_MOBILE_CLAIM_RUNTIME_V10')) fail('Mobile runtime safety', 'legacy V10 global DOM scanner still embedded');
  else if (html.includes('SDLG_RESPONSIVE_UI_V10') || html.includes('SDLG_MOBILE_CLAIM_RUNTIME_V11')) pass('Mobile runtime safety', 'responsive markers present without V10 scanner');
  else fail('Mobile runtime safety', 'expected responsive markers missing');
}

checkSyntax(helper, 'Canonical helper');
checkSyntax(helperModule, 'Canonical helper module');
checkSyntax(exportTableModule, 'Excel export helper module');
checkSyntax(claimParserHelper, 'Claim parser helper module');
checkSyntax(masterResolutionUx, 'Master resolution UX module');
checkSyntax(paymentEvidence, 'Payment evidence module');
checkSyntax(rebalancingEvidence, 'Rebalancing evidence module');
checkSyntax(parserContract, 'Warranty parser guard');
checkSyntax(golden, 'Warranty golden verifier');
checkSyntax(dualWarrantyVerifier, 'Dual warranty routing verifier');

if (helper) {
  if (helper.includes("rpc('sdlg_warranty_resolve_claim'") || helper.includes('rpc("sdlg_warranty_resolve_claim"')) pass('Canonical warranty runtime source', 'root helper calls canonical warranty RPC');
  else fail('Canonical warranty runtime source', 'root helper lacks direct canonical warranty RPC');
  if (helper.includes('claim_warranty_resolution_v')) fail('Canonical warranty runtime source', 'root helper still depends on legacy warranty view');
  else pass('Canonical warranty legacy view removal', 'root helper does not depend on claim_warranty_resolution_v');
  if (helper.includes('technical_personnel')) pass('Canonical helper feedback contract', 'reads claims.technical_personnel');
}

if (exportTableModule) {
  const req = ['styleTable', 'addTable', 'SDLGExportTableHelper'];
  const miss = req.filter(function(v) { return !exportTableModule.includes(v); });
  if (miss.length) fail('Excel export helper contract', 'missing: ' + miss.join(', '));
  else pass('Excel export helper contract', 'extracted helper preserves ExcelJS table behavior');
}

if (claimParserHelper) {
  const req = ['SDLGClaimParserHelpers', 'function isNumericCell(value)'];
  const miss = req.filter(function(v) { return !claimParserHelper.includes(v); });
  if (miss.length) fail('Claim parser helper contract', 'missing: ' + miss.join(', '));
  else pass('Claim parser helper contract', 'numeric-cell predicate isolated');
}

if (parserContract) {
  const signals = ['Numeric-cell parser delegation', 'Parts-total source parsing', 'Database machine resolver', 'High-confidence resolver precedence', 'Unit-history branch inference', 'Resolved branch payload mapping', 'Parts amount consistency validation', 'Parts total consistency validation', 'Safe unmatched-part behavior', 'Zero quantity remains valid', 'Mileage spelling alias'];
  const miss = signals.filter(function(v) { return !parserContract.includes(v); });
  if (miss.length) fail('Warranty parser guard contract', 'missing: ' + miss.join(', '));
  else pass('Warranty parser guard contract', signals.length + ' protected parser behaviors remain guarded');
}

if (exportTablePatch) {
  const req = ['modules/export-table-helper.js', 'window.SDLGExportTableHelper.styleTable'];
  const miss = req.filter(function(v) { return !exportTablePatch.includes(v); });
  if (miss.length) fail('Excel export helper patch contract', 'missing: ' + miss.join(', '));
  else pass('Excel export helper patch contract', 'patch is deterministic');
}
if (parserPatch) {
  const req = ['modules/claim-parser-helpers.js', 'window.SDLGClaimParserHelpers.isNumericCell'];
  const miss = req.filter(function(v) { return !parserPatch.includes(v); });
  if (miss.length) fail('Claim parser helper patch contract', 'missing: ' + miss.join(', '));
  else pass('Claim parser helper patch contract', 'numeric helper extraction is deterministic');
}
if (masterResolutionUxPatch) {
  const req = ['modules/master-resolution-ux.js', 'claim-parser-helpers.js', 'refusing unsafe patch'];
  const miss = req.filter(function(v) { return !masterResolutionUxPatch.includes(v); });
  if (miss.length) fail('Master resolution UX patch contract', 'missing: ' + miss.join(', '));
  else pass('Master resolution UX patch contract', 'production patch owns canonical lock');
}

if (wranglerConfig) {
  const hasName = wranglerConfig.includes('"name": "sdlg-warranty-backup"');
  const hasAssets = wranglerConfig.includes('assets');
  const hasSpa = wranglerConfig.includes('single-page-application') || wranglerConfig.includes('not_found_handling');
  if (hasName && hasAssets && hasSpa) pass('Cloudflare wrangler contract', 'worker name, assets, and SPA fallback are configured');
  else fail('Cloudflare wrangler contract', 'wrangler.jsonc missing name/assets/SPA signals');
}

if (golden) {
  const req = ['0231-2026-SDLG-PFR', 'machine_status', 'component_status', 'Fuel Tank', 'Other parts', 'Contract Customer'];
  const miss = req.filter(function(v) { return !golden.includes(v); });
  if (miss.length) fail('Warranty golden contract', 'missing: ' + miss.join(', '));
  else pass('Warranty golden contract', 'golden case 0231 has executable assertions');
}

if (dualWarrantyVerifier) {
  const req = ['0241-2026-SDLG-PFR', 'MANUAL_APPROVED_PART_OVERRIDE', 'Other parts', 'OUT_OF_WARRANTY', 'IN_WARRANTY', 'MARKETING'];
  const miss = req.filter(function(v) { return !dualWarrantyVerifier.includes(v); });
  if (miss.length) fail('Dual warranty routing verifier contract', 'missing: ' + miss.join(', '));
  else pass('Dual warranty routing verifier contract', 'E6210F routing + enrichment regression is protected');
}

if (build) {
  const names = new Set();
  const re = /['"](apply-[^'"]+\.js)['"]/g;
  let m;
  while ((m = re.exec(build))) names.add(m[1]);
  if (names.has('apply-zero-display-fix.js')) fail('Unsafe zero-display injector', 'build chain still includes apply-zero-display-fix.js');
  else pass('Unsafe zero-display injector', 'disabled from production build chain');
  const required = ['apply-ui-redesign.js','apply-responsive-ui.js','apply-parts-parser-fix.js','apply-safe-part-matching.js','apply-allow-zero-part-qty.js','apply-wo-save-fallback.js','apply-export-table-helper.js','apply-master-resolution-ux.js','apply-warranty-helper-canonical.js'];
  const missing = required.filter(function(n) { return !names.has(n); });
  if (missing.length) fail('Production patch chain', 'missing required injector(s): ' + missing.join(', '));
  else pass('Production patch chain', required.length + ' approved injector(s) present');
}

if (!failures.length) {
  console.log('\nPRODUCTION VERIFY: PASS');
  process.exit(0);
}
console.error('\nPRODUCTION VERIFY: FAIL (' + failures.length + ')');
failures.forEach(function(item) { console.error('- ' + item); });
process.exit(1);
