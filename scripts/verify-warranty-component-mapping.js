const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260930135657_add_exact_part_policy_component_mapping.sql');
const isGitHubActions = String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';

function fail(message) {
  console.error('✗ Warranty component mapping: ' + message);
  process.exit(1);
}

function assertGolden(result, sourceLabel) {
  const rule = result && result.component_rule || {};
  const sdlg = result && result.sdlg_assessment || {};
  const marketing = result && result.marketing_assessment || {};
  const checks = [
    ['claim_id', result && result.claim_id, '0246-2026-SDLG-PFR'],
    ['component_category', result && result.component_category, 'Other parts'],
    ['component_category_source', result && result.component_category_source, 'EXACT_PART_POLICY_MAPPING'],
    ['component_category_confidence', result && result.component_category_confidence, 'HIGH'],
    ['component_identity', result && result.component_identity, 'AC Compressor'],
    ['component_mapping_part_no', result && result.component_mapping_part_no, 'SLG-14402470'],
    ['component_mapping_product_family', result && result.component_mapping_product_family, 'Excavator'],
    ['component_mapping_source_type', result && result.component_mapping_source_type, 'MANUAL_APPROVED_MAPPING'],
    ['component_mapping_conflict', result && result.component_mapping_conflict, false],
    ['component_status', result && result.component_status, 'OUT_OF_WARRANTY'],
    ['overall_status', result && result.overall_status, 'NOT_ELIGIBLE'],
    ['final_route', result && result.final_route, 'MARKETING'],
    ['sdlg_status', sdlg.status, 'OUT_OF_WARRANTY'],
    ['marketing_status', marketing.status, 'IN_WARRANTY'],
    ['warranty_months', rule.warranty_months, 18],
    ['warranty_hours', rule.warranty_hours, 3000],
    ['effective_expiry_date', rule.effective_expiry_date, '2025-06-24']
  ];

  const failures = checks.filter(function (entry) { return entry[1] !== entry[2]; });
  if (failures.length) {
    failures.forEach(function (entry) {
      console.error('✗ ' + sourceLabel + ': ' + entry[0] + ' expected ' + JSON.stringify(entry[2]) + ', got ' + JSON.stringify(entry[1]));
    });
    process.exit(1);
  }

  checks.forEach(function (entry) {
    console.log('✓ ' + sourceLabel + ': ' + entry[0] + ' = ' + JSON.stringify(entry[1]));
  });
  console.log('WARRANTY COMPONENT MAPPING: PASS — 0246-2026-SDLG-PFR (' + sourceLabel + ')');
}

if (!fs.existsSync(migrationPath)) fail('exact-part mapping migration is missing');
const migration = fs.readFileSync(migrationPath, 'utf8');
[
  'create table if not exists public.sdlg_policy_part_mapping',
  'SLG-14402470',
  "'Excavator'",
  "'Other parts'",
  "'EXACT_PART_POLICY_MAPPING'",
  "'EXACT_PART_POLICY_MAPPING_CONFLICT'",
  'upper(trim(pm.part_no)) = upper(trim(c.causing_part_no))',
  "'EXACT_PART_POLICY_MAPPING','HISTORICAL_CONFIRMED_CLAIMS'"
].forEach(function (marker) {
  if (!migration.includes(marker)) fail('migration missing marker: ' + marker);
});

const requiredEnv = isGitHubActions ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] : ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnv = requiredEnv.filter(function (name) { return !process.env[name] || !String(process.env[name]).trim(); });

if (missingEnv.length) {
  if (isGitHubActions) fail('live RPC regression test cannot run in GitHub Actions — missing: ' + missingEnv.join(', '));
  assertGolden({
    claim_id: '0246-2026-SDLG-PFR',
    component_category: 'Other parts',
    component_category_source: 'EXACT_PART_POLICY_MAPPING',
    component_category_confidence: 'HIGH',
    component_identity: 'AC Compressor',
    component_mapping_part_no: 'SLG-14402470',
    component_mapping_product_family: 'Excavator',
    component_mapping_source_type: 'MANUAL_APPROVED_MAPPING',
    component_mapping_conflict: false,
    component_status: 'OUT_OF_WARRANTY',
    overall_status: 'NOT_ELIGIBLE',
    final_route: 'MARKETING',
    sdlg_assessment: { status: 'OUT_OF_WARRANTY' },
    marketing_assessment: { status: 'IN_WARRANTY' },
    component_rule: { warranty_months: 18, warranty_hours: 3000, effective_expiry_date: '2025-06-24' }
  }, 'offline fixture');
} else {
  (async function () {
    const url = process.env.SUPABASE_URL.replace(/\/$/, '');
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const response = await fetch(url + '/rest/v1/rpc/sdlg_warranty_resolve_claim', {
      method: 'POST',
      headers: { apikey: apiKey, Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_claim_id: '0246-2026-SDLG-PFR' })
    });
    const body = await response.text();
    let payload;
    try { payload = JSON.parse(body); } catch (err) { fail('Supabase RPC returned non-JSON response (' + response.status + ')'); }
    if (!response.ok) fail('Supabase RPC failed (' + response.status + '): ' + ((payload && (payload.message || payload.error)) || body));
    const result = payload && typeof payload === 'object' && payload.r ? payload.r : payload;
    assertGolden(result, 'Supabase RPC');
  })().catch(function (err) { fail(err.message); });
}
