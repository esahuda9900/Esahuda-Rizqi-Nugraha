const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.cwd();
const buildPath = path.join(root, 'scripts', 'build-production.js');
const corePath = path.join(root, 'modules', 'sdlg-core.js');
const architecturePath = path.join(root, 'ARCHITECTURE.md');
const freeTierPath = path.join(root, 'FREE_TIER.md');
const securityPath = path.join(root, 'SECURITY.md');
const deploymentPath = path.join(root, 'DEPLOYMENT.md');
const injectorRoadmapPath = path.join(root, 'INJECTOR_ROADMAP.md');

const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function read(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    fail(`${label}: ${err.message}`);
    return null;
  }
}

const build = read(buildPath, 'Production build script');
const core = read(corePath, 'SDLG core module');
const architecture = read(architecturePath, 'Architecture baseline');
const freeTier = read(freeTierPath, 'Free-tier baseline');
const security = read(securityPath, 'Security baseline');
const deployment = read(deploymentPath, 'Deployment discipline');
const injectorRoadmap = read(injectorRoadmapPath, 'Injector roadmap');

if (core) {
  try {
    new vm.Script(core, { filename: 'modules/sdlg-core.js' });
    pass('SDLG core syntax');
  } catch (err) {
    fail(`SDLG core syntax: ${err.message}`);
  }

  const requiredExports = [
    'SDLGCanonicalModel',
    'SDLGModelsEquivalent',
    'SDLGBaseCustomerName',
    'SDLGNormalizeDealerCode',
    'SDLGSerialEquivalent',
    'SDLGNormalizeClaimCurrency',
    'SDLGEffectiveClaimCurrency',
    'SDLGInferCurrencyToken',
    'SDLGCore'
  ];
  const missing = requiredExports.filter(name => !core.includes(name));
  if (missing.length) fail(`SDLG core contract missing export(s): ${missing.join(', ')}`);
  else pass(`SDLG core contract (${requiredExports.length} canonical exports)`);

  if (!core.includes('MODEL_ALIASES: Object.freeze(Object.assign({}, MODEL_ALIASES))')) {
    fail('SDLG core alias map is not frozen at the exported boundary');
  } else {
    pass('SDLG core alias map is frozen at the exported boundary');
  }

  // Accept any 1.x version marker (bumped when identity/currency rules change).
  if (!/version:\s*'1\.\d+\.\d+'/.test(core)) {
    fail('SDLG core version marker missing (expected version: \'1.x.x\')');
  } else {
    pass('SDLG core version marker present');
  }

  if (!core.includes('SDLG968F') || !core.includes('L968F')) {
    fail('SDLG core missing 968F → L968F canonical alias');
  } else {
    pass('SDLG core includes 968F → L968F alias');
  }
  if (!core.includes('srcWithoutPlaceholders') && !core.includes('USD')) {
    fail('SDLG core currency rules look incomplete');
  } else if (!core.includes('YNFW')) {
    fail('SDLG core missing YNFW → USD settlement rule');
  } else {
    pass('SDLG core currency rules include YNFW + placeholder handling');
  }

  // Behavioral: baseCustomerName must treat leading/trailing legal-entity tokens as equivalent.
  // Regression for: source="CV. WEN WEN LESTARI" vs parse="WEN-WEN LESTARI CV." SOURCE LOCK block.
  try {
    const sandbox = { window: {}, globalThis: {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(core, sandbox, { filename: 'modules/sdlg-core.js' });
    const fn = sandbox.SDLGBaseCustomerName || (sandbox.SDLGCore && sandbox.SDLGCore.baseCustomerName);
    if (typeof fn !== 'function') {
      fail('SDLGBaseCustomerName not available after core eval');
    } else {
      const a = fn('CV. WEN WEN LESTARI');
      const b = fn('WEN-WEN LESTARI CV.');
      const c = fn('PT. INDO TRAKTOR UTAMA');
      const d = fn('INDO TRAKTOR UTAMA PT.');
      if (a !== b) {
        fail(`baseCustomerName suffix strip failed: "CV. WEN WEN LESTARI"→${a} vs "WEN-WEN LESTARI CV."→${b}`);
      } else if (c !== d) {
        fail(`baseCustomerName PT suffix strip failed: "PT. INDO TRAKTOR UTAMA"→${c} vs "INDO TRAKTOR UTAMA PT."→${d}`);
      } else {
        pass(`baseCustomerName prefix/suffix equivalence (WENWENLESTARI / ${a})`);
      }
    }
  } catch (err) {
    fail(`baseCustomerName behavioral check: ${err.message}`);
  }
}

const sourceLockPatch = read(path.join(root, 'scripts', 'apply-master-model-source-lock.js'), 'Master source-lock patch script');

if (sourceLockPatch) {
  const requiredCustomerContract = [
    'SDLG_CUSTOMER_SOURCE_LOCK_V1',
    'sourceCustomerName',
    'source_customer_name',
    'Customer(?:\\\\s+Name)?'
  ];
  const missingCustomerContract = requiredCustomerContract.filter(value => !sourceLockPatch.includes(value));
  if (missingCustomerContract.length) {
    fail(`Customer source reconciliation contract missing: ${missingCustomerContract.join(', ')}`);
  } else {
    pass('Customer source reconciliation contract + provenance patch present');
  }
}

if (build) {
  const externalize = 'apply-externalize-sdlg-core.js';
  const modernRefresh = 'apply-modern-refresh.js';
  const externalizeAt = build.indexOf(`'${externalize}'`);
  const refreshAt = build.indexOf(`'${modernRefresh}'`);
  if (externalizeAt < 0) fail('External SDLG core step missing from production build chain');
  else pass('External SDLG core step remains in production build chain');

  if (externalizeAt >= 0 && refreshAt >= 0 && externalizeAt < refreshAt) {
    pass('SDLG core externalization runs before final visual refresh');
  } else {
    fail('Production build ordering changed: SDLG core externalization must precede final visual refresh');
  }

  if (build.includes("'apply-zero-display-fix.js'") || build.includes('"apply-zero-display-fix.js"')) {
    fail('apply-zero-display-fix.js must stay out of the active production build chain');
  } else {
    pass('apply-zero-display-fix.js is not in the active build chain');
  }

  if (!build.includes('FREEZE RULE') && !build.includes('do not append new apply')) {
    fail('build-production.js must document the injector freeze rule');
  } else {
    pass('build-production.js documents injector freeze rule');
  }

  const requiredOrder = [
    'apply-parts-parser-fix.js',
    'apply-safe-part-matching.js',
    'apply-export-table-helper.js',
    externalize,
    'apply-master-resolution-ux.js',
    'apply-master-model-source-lock.js',
    'apply-warranty-helper-canonical.js',
    modernRefresh
  ];
  let previous = -1;
  for (const script of requiredOrder) {
    const at = build.indexOf(`'${script}'`);
    if (at < 0) {
      fail(`Expected build step missing: ${script}`);
      continue;
    }
    if (at <= previous) fail(`Build step order violation around ${script}`);
    previous = at;
  }
  if (!failures.some(item => item.includes('Build step order violation'))) {
    pass('Protected production patch ordering is intact');
  }
}

if (architecture) {
  const requiredInvariants = [
    'Single source of truth',
    'Never expose Supabase `service_role` credentials to the browser.',
    'Never rely on client-side role checks as the only authorization boundary.',
    'A UI-only change must not alter warranty calculation.',
    'An export change must not modify persisted claim data.'
  ];
  const missing = requiredInvariants.filter(value => !architecture.includes(value));
  if (missing.length) fail(`Architecture invariant(s) missing: ${missing.join(' | ')}`);
  else pass(`Architecture invariants present (${requiredInvariants.length})`);
}

if (freeTier) {
  const softRequired = [
    'claim_audit_log',
    'SECURITY DEFINER',
    'service_role',
    '500 MB',
    'free_tier_db_health'
  ];
  const missing = softRequired.filter(value => !freeTier.includes(value));
  if (missing.length) fail(`FREE_TIER baseline missing concept(s): ${missing.join(', ')}`);
  else pass('FREE_TIER baseline documents DB size, health view, SECURITY DEFINER, and service_role rules');
}

if (security) {
  if (!security.includes('private_is_warranty_claim_writer')) {
    fail('SECURITY.md must document private_is_warranty_claim_writer role gate');
  } else {
    pass('SECURITY.md documents RPC role gate');
  }
  if (!security.includes('This is intentional')) {
    fail('SECURITY.md must mark SECURITY DEFINER grants as intentional');
  } else {
    pass('SECURITY.md marks SECURITY DEFINER design as intentional');
  }
  if (!security.includes('free_tier_db_health')) {
    fail('SECURITY.md must document free_tier_db_health monitoring view');
  } else {
    pass('SECURITY.md documents free_tier_db_health');
  }
}

if (deployment) {
  if (!deployment.includes('Injector freeze rule') && !deployment.includes('Do not add new `apply-*.js`')) {
    fail('DEPLOYMENT.md must document injector freeze rule');
  } else {
    pass('DEPLOYMENT.md documents injector freeze rule');
  }
  if (!deployment.includes('apply-externalize-sdlg-core.js')) {
    fail('DEPLOYMENT.md must list apply-externalize-sdlg-core.js in active chain');
  } else {
    pass('DEPLOYMENT.md lists externalize step in active chain');
  }
}

if (injectorRoadmap) {
  if (!injectorRoadmap.includes('Freeze rule')) {
    fail('INJECTOR_ROADMAP.md must document freeze rule');
  } else {
    pass('INJECTOR_ROADMAP.md documents freeze rule');
  }
  if (!injectorRoadmap.includes('apply-externalize-sdlg-core.js')) {
    fail('INJECTOR_ROADMAP.md must reference externalize step');
  } else {
    pass('INJECTOR_ROADMAP.md references externalize step');
  }
}

if (failures.length) {
  console.error(`SOURCE LOCK CONTRACT: FAIL (${failures.length} issue(s))`);
  process.exit(1);
}

console.log('SOURCE LOCK CONTRACT: PASS');
