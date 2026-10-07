const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260930153021_rebuild_sdlg_part_policy_engine_and_warranty_clocks.sql');
const refinementMigrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260930153200_refine_sdlg_part_classification_and_legacy_assessor.sql');
const helperPath = path.join(repoRoot, 'canonical-warranty-helper.js');
const isCI = String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';

function fail(message) {
  console.error('✗ Warranty policy engine: ' + message);
  process.exit(1);
}
function pass(message) {
  console.log('✓ Warranty policy engine: ' + message);
}
function assertEqual(label, actual, expected) {
  if (actual !== expected) fail(label + ' expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  pass(label + ' = ' + JSON.stringify(actual));
}
function assert(condition, message) {
  if (!condition) fail(message);
  pass(message);
}

if (!fs.existsSync(migrationPath)) fail('rebuilt policy migration is missing');
if (!fs.existsSync(refinementMigrationPath)) fail('policy refinement migration is missing');
if (!fs.existsSync(helperPath)) fail('canonical warranty helper is missing');
const migration = fs.readFileSync(migrationPath, 'utf8');
const refinementMigration = fs.readFileSync(refinementMigrationPath, 'utf8');
const helper = fs.readFileSync(helperPath, 'utf8');
const fnStart = migration.indexOf('create or replace function public.sdlg_warranty_resolve_claim');
const fnEnd = migration.indexOf('create or replace view public.claim_warranty_resolution_v as', fnStart);
if (fnStart < 0 || fnEnd < 0) fail('resolver function block is missing');
const fn = migration.slice(fnStart, fnEnd);

[
  'create table if not exists public.sdlg_policy_part_master',
  'CONSUMABLE_NOT_COVERED',
  'UNKNOWN_REQUIRES_REVIEW',
  'bl_cap_mode',
  'bl_cap_months',
  'special_warranty_options',
  'PRE_SALE_YARD',
  'DATE_ANOMALY_PRE_BILL_OF_LADING',
  'B_L_STOCK_FALLBACK',
  'SALES_DATE_FIRST',
  'B_L_FIRST',
  "5 t < T <= 6 t",
  "policy_code','SDLG_SERVICE_POLICY_2026"
].forEach((marker) => {
  if (!migration.includes(marker)) fail('migration marker missing: ' + marker);
});
assert(!fn.includes('sdlg_policy_component_taxonomy'), 'resolver no longer consults narrative taxonomy');
assert(!fn.includes('v_evidence text'), 'resolver has no narrative-evidence decision buffer');
assert(fn.includes('EXACT_PART_POLICY_MASTER'), 'resolver uses exact part policy master');
assert(fn.includes("SUPPORTING_CONTEXT_ONLY"), 'narrative is documented as supporting context only');
assert(refinementMigration.includes('RUBBER_SEALING_CONSUMABLE'), 'refinement classifies rubber/sealing consumables');
assert(refinementMigration.includes('WEAR_COMPONENT_POLICY_REVIEW'), 'refinement preserves explicit wear-part review');
assert(refinementMigration.includes('SDLG_BREAKER_WARRANTY'), 'refinement isolates breaker warranty policy');
assert(refinementMigration.includes('create or replace function public.sdlg_warranty_assess'), 'legacy assessor is aligned with the rebuilt clock logic');
['Coverage class','Policy variant','Category source','Expiry basis','SDLG: Sales expiry','SDLG: B/L maximum','SDLG: Effective expiry','Final routing reason'].forEach((marker) => {
  assert(helper.includes(marker), 'claim UI exposes ' + marker);
});

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = requiredEnv.filter((name) => !process.env[name] || !String(process.env[name]).trim());

if (missing.length) {
  if (isCI) fail('live verifier cannot run in GitHub Actions; missing ' + missing.join(', '));
  pass('static verifier only (live Supabase credentials not present)');
  process.exit(0);
}

(async () => {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  };

  async function getJson(endpoint) {
    const response = await fetch(url + endpoint, { headers });
    const body = await response.text();
    let payload;
    try { payload = JSON.parse(body); } catch { fail('Supabase returned non-JSON (' + response.status + ')'); }
    if (!response.ok) fail('Supabase request failed (' + response.status + '): ' + body.slice(0, 600));
    return payload;
  }

  const rows = await getJson('/rest/v1/claim_warranty_resolution_v?select=claim_id,component_category,component_category_source,component_category_confidence,component_coverage_class,component_classification_review_required,component_policy_variant,warranty_phase,date_anomaly,expiry_basis,effective_expiry_date,component_status,overall_status,final_route&limit=1000');
  assert(Array.isArray(rows), 'resolution view returned an array');
  assertEqual('active claim resolution row count', rows.length, 533);

  const sourceSet = new Set(rows.map((row) => row.component_category_source).filter(Boolean));
  assert(!sourceSet.has('CONTROLLED_TAXONOMY_SINGLE_EVIDENCE'), 'no active claim is classified by single-evidence narrative taxonomy');
  assert(!sourceSet.has('CONTROLLED_TAXONOMY_MULTI_EVIDENCE'), 'no active claim is classified by multi-evidence narrative taxonomy');

  const reviewRows = rows.filter((r) => r.final_route === 'REVIEW_REQUIRED');
  const anomalyRows = rows.filter((r) => r.date_anomaly === true);
  const unresolvedRows = rows.filter((r) => r.component_coverage_class === 'UNKNOWN_REQUIRES_REVIEW');

  assertEqual('review route count', reviewRows.length, 74);
  assertEqual('date anomaly count', anomalyRows.length, 1);
  assertEqual('explicit unresolved part count by claims', unresolvedRows.length, 0);

  const wearReviewRows = rows.filter((r) => r.component_policy_variant === 'WEAR_COMPONENT_POLICY_REVIEW' && r.component_classification_review_required === true);
  assertEqual('wear-part policy review count', wearReviewRows.length, 72);

  const breakerReviewRows = rows.filter((r) => r.component_policy_variant === 'SDLG_BREAKER_WARRANTY' && r.final_route === 'REVIEW_REQUIRED');
  assertEqual('breaker special-policy review count', breakerReviewRows.length, 1);

  const coveredWithoutExpiry = rows.filter((r) =>
    ['IN_WARRANTY', 'OUT_OF_WARRANTY'].includes(r.component_status) &&
    r.component_coverage_class !== 'CONSUMABLE_NOT_COVERED' &&
    !r.effective_expiry_date
  );
  assertEqual('covered claims missing effective expiry', coveredWithoutExpiry.length, 0);

  const samples = {
    '0246-2026-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'MARKETING',
      expiry: '2025-06-24',
      phase: 'SOLD_COMMERCIAL'
    },
    '0020-2026-SDLG-PFR': {
      coverage: 'CONSUMABLE_NOT_COVERED',
      category: null,
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'NON_WARRANTY'
    },
    '0049-2025-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'REVIEW_REQUIRED'
    },
    '0004-2025-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'SDLG'
    },
    '0040-2025-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'SDLG'
    },
    '0096-2026-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'SDLG'
    },
    '0176-2026-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'NON_WARRANTY'
    },
    '0117-2026-SDLG-PFR': {
      coverage: 'SPECIAL_POLICY',
      category: null,
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'REVIEW_REQUIRED'
    },
    '0024-2026-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER',
      route: 'SDLG'
    },
    '0104-2023-SDLG-PFR': {
      coverage: 'KEY_COMPONENT',
      category: 'Key components',
      source: 'EXACT_PART_POLICY_MASTER'
    },
    '0003-2025-SDLG-PFR': {
      coverage: 'OTHER_WARRANTABLE_PART',
      category: 'Other parts',
      source: 'EXACT_PART_POLICY_MASTER'
    },
    '0210-2026-SDLG-PFR': {
      phase: 'DATE_ANOMALY_PRE_BILL_OF_LADING',
      anomaly: true,
      route: 'REVIEW_REQUIRED'
    }
  };

  for (const [claimId, expected] of Object.entries(samples)) {
    const row = rows.find((r) => r.claim_id === claimId);
    if (!row) fail('sample claim missing from resolution view: ' + claimId);
    if ('coverage' in expected) assertEqual(claimId + ' coverage', row.component_coverage_class, expected.coverage);
    if ('category' in expected) assertEqual(claimId + ' category', row.component_category, expected.category);
    if ('source' in expected) assertEqual(claimId + ' source', row.component_category_source, expected.source);
    if ('route' in expected) assertEqual(claimId + ' route', row.final_route, expected.route);
    if ('expiry' in expected) assertEqual(claimId + ' effective expiry', row.effective_expiry_date, expected.expiry);
    if ('phase' in expected) assertEqual(claimId + ' warranty phase', row.warranty_phase, expected.phase);
    if ('anomaly' in expected) assertEqual(claimId + ' date anomaly', row.date_anomaly, expected.anomaly);
  }

  const rules = await getJson('/rest/v1/service_policy_warranty_rules?select=product_family,model_scope,component_category,bl_cap_mode,bl_cap_months,bl_extension_months,special_warranty_options&limit=1000');
  assertEqual('policy rule row count', rules.length, 32);

  const invalidCapRows = rules.filter((r) =>
    r.bl_cap_mode === null ||
    (r.bl_cap_mode === 'FIXED_MONTHS' && r.bl_cap_months === null) ||
    (r.bl_cap_mode === 'WARRANTY_MONTHS_PLUS_EXTENSION' && r.bl_extension_months === null)
  );
  assertEqual('policy rows with invalid B/L cap metadata', invalidCapRows.length, 0);

  const sixTon = await getJson('/rest/v1/models?select=model_code,rated_load_ton,policy_model_scope&model_code=eq.L968F&limit=1');
  assertEqual('L968F model row count', sixTon.length, 1);
  assertEqual('L968F policy scope', sixTon[0].policy_model_scope, '5 t < T <= 6 t');

  const noSalesYard = rows.filter((r) => r.warranty_phase === 'PRE_SALE_YARD' && r.sales_date === null && r.effective_expiry_date);
  assertEqual('B/L-only yard claims with calculated expiry', noSalesYard.length, 11);

  const electric = await getJson('/rest/v1/service_policy_warranty_rules?product_family=eq.Electric%20Loader&select=component_category,bl_cap_months&limit=20');
  const electricMap = Object.fromEntries(electric.map((r) => [r.component_category, String(r.bl_cap_months)]));
  assertEqual('Electric motor B/L maximum', electricMap['Electric motor'], '66');
  assertEqual('Power battery B/L maximum', electricMap['Power battery'], '66');
  assertEqual('HV distribution/controller B/L maximum', electricMap['HV distribution/controller'], '42');

  const assessor = await fetch(url + '/rest/v1/rpc/sdlg_warranty_assess', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_product_family: 'Excavator',
      p_model_scope: 'T < 20 t',
      p_component_category: 'Other parts',
      p_contract_customer: true,
      p_sale_date: '2024-12-30',
      p_bill_of_lading_date: '2023-06-24',
      p_failure_date: '2026-06-22',
      p_failure_hm: 2064
    })
  });
  const assessorBody = await assessor.text();
  let assessorPayload;
  try { assessorPayload = JSON.parse(assessorBody); } catch { fail('legacy assessor RPC returned non-JSON (' + assessor.status + ')'); }
  if (!assessor.ok) fail('legacy assessor RPC failed (' + assessor.status + '): ' + assessorBody.slice(0, 600));
  const assessorResult = assessorPayload && typeof assessorPayload === 'object' && assessorPayload.r ? assessorPayload.r : assessorPayload;
  assertEqual('legacy assessor status', assessorResult.status, 'OUT_OF_WARRANTY');
  assertEqual('legacy assessor expiry basis', assessorResult.expiry_basis, 'B_L_FIRST');
  assertEqual('legacy assessor effective expiry', assessorResult.effective_expiry_date, '2025-06-24');

  console.log('WARRANTY POLICY ENGINE: PASS');
})().catch((error) => fail(error.message));