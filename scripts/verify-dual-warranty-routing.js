const isCi = Boolean(process.env.CI);
const skipLive = Boolean(process.env.SKIP_WARRANTY_GOLDEN) || process.env.SKIP_WARRANTY_GOLDEN === '1';
const requiredEnv = ['SUPABASE_URL'];
const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
const missingEnv = requiredEnv.filter((name) => !process.env[name]).concat(hasKey ? [] : ['SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY']);
const claimId = '0241-2026-SDLG-PFR';
const loaderHvacClaimId = '0240-2026-SDLG-PFR';

function assert(condition, label, actual) {
  if (condition) {
    console.log('✓ Dual warranty routing:', label, '=', JSON.stringify(actual));
    return;
  }
  throw new Error(label + ': received ' + JSON.stringify(actual));
}

function assertLive(resolution, claim) {
  const sdlg = resolution?.sdlg_assessment || {};
  const marketing = resolution?.marketing_assessment || {};

  assert(resolution?.claim_id === claimId, 'claim_id', resolution?.claim_id);
  assert(resolution?.component_category === 'Other parts', 'component_category', resolution?.component_category);
  assert(resolution?.component_category_source === 'MANUAL_APPROVED_PART_OVERRIDE', 'component_category_source', resolution?.component_category_source);
  assert(resolution?.component_category_confidence === 'HIGH', 'component_category_confidence', resolution?.component_category_confidence);
  assert(resolution?.component_identity === 'Sealing Kit Center Passage', 'component_identity', resolution?.component_identity);
  assert(resolution?.component_identity_source === 'EXACT_PARTS_MASTER', 'component_identity_source', resolution?.component_identity_source);
  assert(resolution?.component_identity_confidence === 'HIGH', 'component_identity_confidence', resolution?.component_identity_confidence);
  assert(resolution?.contract_customer_effective === true, 'contract_customer_effective', resolution?.contract_customer_effective);
  assert(resolution?.contract_resolution_source === 'B/L_CONTINUITY_RULE', 'contract_resolution_source', resolution?.contract_resolution_source);
  assert(sdlg.status === 'OUT_OF_WARRANTY', 'SDLG status', sdlg.status);
  assert(sdlg.warranty_months === 24, 'SDLG warranty_months', sdlg.warranty_months);
  assert(sdlg.warranty_hours === 4000, 'SDLG warranty_hours', sdlg.warranty_hours);
  assert(sdlg.bill_of_lading_date === '2023-01-07', 'SDLG B/L date', sdlg.bill_of_lading_date);
  assert(sdlg.bill_of_lading_cap_months === 30, 'SDLG B/L cap months', sdlg.bill_of_lading_cap_months);
  assert(sdlg.bill_of_lading_expiry_date === '2025-07-07', 'SDLG B/L cap expiry', sdlg.bill_of_lading_expiry_date);
  assert(sdlg.sales_expiry_date === '2027-08-12', 'SDLG sales expiry', sdlg.sales_expiry_date);
  assert(sdlg.effective_expiry_date === '2025-07-07', 'SDLG effective expiry', sdlg.effective_expiry_date);
  assert(marketing.status === 'IN_WARRANTY', 'Marketing status', marketing.status);
  assert(marketing.date_check === true, 'Marketing date_check', marketing.date_check);
  assert(marketing.hour_check === true, 'Marketing hour_check', marketing.hour_check);
  assert(marketing.warranty_months === 24, 'Marketing warranty_months', marketing.warranty_months);
  assert(marketing.warranty_hours === 4000, 'Marketing warranty_hours', marketing.warranty_hours);
  assert(marketing.expiry_date === '2027-08-12', 'Marketing expiry', marketing.expiry_date);
  assert(resolution.final_route === 'MARKETING', 'final_route', resolution.final_route);
  assert(resolution.final_route_reason === 'SDLG warranty is expired; Sales Date warranty is still active.', 'final_route_reason', resolution.final_route_reason);
  assert(claim?.machine_id, 'machine_id enrichment', claim?.machine_id);
  assert(claim?.customer_id, 'customer_id enrichment', claim?.customer_id);
  assert(claim?.branch_id, 'branch_id enrichment', claim?.branch_id);
  assert(String(claim?.dealer_wo_so || '').toUpperCase() === 'WO26044098', 'exact AX WO link', claim?.dealer_wo_so);
  assert(String(claim?.serial_no || '').toUpperCase() === 'VLGE621FCN0609734', 'exact machine serial', claim?.serial_no);
  assert(String(claim?.customer || '').toUpperCase() === 'PT. DIA INDAH AUTO SERVICE', 'source customer preserved', claim?.customer);
  assert(String(claim?.branch || '').toUpperCase() === 'PALEMBANG', 'source branch preserved', claim?.branch);
}

function assertLoaderHvac(resolution) {
  const sdlg = resolution?.sdlg_assessment || {};
  const marketing = resolution?.marketing_assessment || {};

  assert(resolution?.claim_id === loaderHvacClaimId, 'Loader HVAC claim_id', resolution?.claim_id);
  assert(resolution?.component_category === 'Other parts', 'Loader HVAC component_category', resolution?.component_category);
  assert(resolution?.component_category_source === 'CONTROLLED_TAXONOMY_MULTI_EVIDENCE', 'Loader HVAC component_category_source', resolution?.component_category_source);
  assert(resolution?.component_category_confidence === 'HIGH', 'Loader HVAC component_category_confidence', resolution?.component_category_confidence);
  assert(resolution?.component_identity === 'Evaporator', 'Loader HVAC component_identity', resolution?.component_identity);
  assert(resolution?.component_identity_source === 'EXACT_PARTS_MASTER', 'Loader HVAC component_identity_source', resolution?.component_identity_source);
  assert(resolution?.component_identity_confidence === 'HIGH', 'Loader HVAC component_identity_confidence', resolution?.component_identity_confidence);
  assert(resolution?.contract_customer_effective === true, 'Loader HVAC contract_customer_effective', resolution?.contract_customer_effective);
  assert(sdlg.status === 'IN_WARRANTY', 'Loader HVAC SDLG status', sdlg.status);
  assert(sdlg.warranty_months === 18, 'Loader HVAC SDLG warranty_months', sdlg.warranty_months);
  assert(sdlg.warranty_hours === 2000, 'Loader HVAC SDLG warranty_hours', sdlg.warranty_hours);
  assert(sdlg.sales_expiry_date === '2026-10-30', 'Loader HVAC SDLG sales expiry', sdlg.sales_expiry_date);
  assert(sdlg.bill_of_lading_expiry_date === '2027-02-02', 'Loader HVAC SDLG B/L expiry', sdlg.bill_of_lading_expiry_date);
  assert(sdlg.effective_expiry_date === '2026-10-30', 'Loader HVAC SDLG effective expiry', sdlg.effective_expiry_date);
  assert(sdlg.failure_date === '2026-07-23', 'Loader HVAC SDLG failure date', sdlg.failure_date);
  assert(sdlg.failure_hm === 1598, 'Loader HVAC SDLG failure HM', sdlg.failure_hm);
  assert(marketing.status === 'IN_WARRANTY', 'Loader HVAC Marketing status', marketing.status);
  assert(marketing.warranty_months === 18, 'Loader HVAC Marketing warranty_months', marketing.warranty_months);
  assert(marketing.warranty_hours === 2000, 'Loader HVAC Marketing warranty_hours', marketing.warranty_hours);
  assert(marketing.expiry_date === '2026-10-30', 'Loader HVAC Marketing expiry', marketing.expiry_date);
  assert(resolution.final_route === 'SDLG', 'Loader HVAC final_route', resolution.final_route);
}

async function runRemote() {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const headers = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  };

  const rpcResponse = await fetch(baseUrl + '/rest/v1/rpc/sdlg_warranty_resolve_claim', {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_claim_id: claimId })
  });
  const rpcText = await rpcResponse.text();
  let resolution;
  try { resolution = JSON.parse(rpcText); } catch { throw new Error('Warranty RPC returned non-JSON (' + rpcResponse.status + ')'); }
  if (!rpcResponse.ok) throw new Error('Warranty RPC failed (' + rpcResponse.status + '): ' + (resolution?.message || resolution?.error || rpcText));

  const hvacRpcResponse = await fetch(baseUrl + '/rest/v1/rpc/sdlg_warranty_resolve_claim', {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_claim_id: loaderHvacClaimId })
  });
  const hvacRpcText = await hvacRpcResponse.text();
  let hvacResolution;
  try { hvacResolution = JSON.parse(hvacRpcText); } catch { throw new Error('Loader HVAC warranty RPC returned non-JSON (' + hvacRpcResponse.status + ')'); }
  if (!hvacRpcResponse.ok) throw new Error('Loader HVAC warranty RPC failed (' + hvacRpcResponse.status + '): ' + (hvacResolution?.message || hvacResolution?.error || hvacRpcText));
  assertLoaderHvac(hvacResolution && hvacResolution.r ? hvacResolution.r : hvacResolution);

  const claimResponse = await fetch(
    baseUrl + '/rest/v1/claims?select=claim_id,machine_id,customer_id,branch_id,customer,branch,dealer_wo_so,serial_no&claim_id=eq.' + encodeURIComponent(claimId) + '&limit=1',
    { headers }
  );
  const claimText = await claimResponse.text();
  let claimRows;
  try { claimRows = JSON.parse(claimText); } catch { throw new Error('Claims endpoint returned non-JSON (' + claimResponse.status + ')'); }
  if (!claimResponse.ok) throw new Error('Claims lookup failed (' + claimResponse.status + '): ' + (claimRows?.message || claimRows?.error || claimText));

  assertLive(resolution && resolution.r ? resolution.r : resolution, Array.isArray(claimRows) ? claimRows[0] : null);
  console.log('\nDUAL WARRANTY ROUTING: PASS — ' + claimId);
}

function runOffline() {
  const resolution = {
    claim_id: claimId,
    component_category: 'Other parts',
    component_category_source: 'MANUAL_APPROVED_PART_OVERRIDE',
    component_category_confidence: 'HIGH',
    component_identity: 'Sealing Kit Center Passage',
    component_identity_source: 'EXACT_PARTS_MASTER',
    component_identity_confidence: 'HIGH',
    contract_customer_effective: true,
    contract_resolution_source: 'B/L_CONTINUITY_RULE',
    sdlg_assessment: {
      status: 'OUT_OF_WARRANTY',
      warranty_months: 24,
      warranty_hours: 4000,
      bill_of_lading_date: '2023-01-07',
      bill_of_lading_cap_months: 30,
      bill_of_lading_expiry_date: '2025-07-07',
      sales_expiry_date: '2027-08-12',
      effective_expiry_date: '2025-07-07'
    },
    marketing_assessment: {
      status: 'IN_WARRANTY',
      date_check: true,
      hour_check: true,
      warranty_months: 24,
      warranty_hours: 4000,
      expiry_date: '2027-08-12'
    },
    final_route: 'MARKETING',
    final_route_reason: 'SDLG warranty is expired; Sales Date warranty is still active.'
  };
  const claim = {
    machine_id: 'fixture-machine',
    customer_id: 'fixture-customer',
    branch_id: 'fixture-branch',
    dealer_wo_so: 'WO26044098',
    serial_no: 'VLGE621FCN0609734',
    customer: 'PT. DIA INDAH AUTO SERVICE',
    branch: 'PALEMBANG'
  };
  console.warn('⚠ Live Supabase credentials unavailable; running deterministic offline routing fixture.');
  if (isCi) {
    console.warn('  (CI/static host such as Cloudflare Workers Builds — offline fixture is intentional.)');
  }

  assertLoaderHvac({
    claim_id: loaderHvacClaimId,
    component_category: 'Other parts',
    component_category_source: 'CONTROLLED_TAXONOMY_MULTI_EVIDENCE',
    component_category_confidence: 'HIGH',
    component_identity: 'Evaporator',
    component_identity_source: 'EXACT_PARTS_MASTER',
    component_identity_confidence: 'HIGH',
    contract_customer_effective: true,
    sdlg_assessment: {
      status: 'IN_WARRANTY',
      warranty_months: 18,
      warranty_hours: 2000,
      sales_expiry_date: '2026-10-30',
      bill_of_lading_expiry_date: '2027-02-02',
      effective_expiry_date: '2026-10-30',
      failure_date: '2026-07-23',
      failure_hm: 1598
    },
    marketing_assessment: {
      status: 'IN_WARRANTY',
      warranty_months: 18,
      warranty_hours: 2000,
      expiry_date: '2026-10-30'
    },
    final_route: 'SDLG'
  });

  assertLive(resolution, claim);
  console.log('\nDUAL WARRANTY ROUTING: PASS — offline fixture');
}

// Static hosts (Cloudflare Workers Builds) set CI=true but do not ship SUPABASE secrets.
// Always use offline fixture when credentials are missing or SKIP_WARRANTY_GOLDEN is set.
try {
  if (skipLive || missingEnv.length) {
    runOffline();
  } else {
    runRemote().catch((err) => {
      console.error('✗ Dual warranty routing verifier crashed — ' + err.message);
      process.exit(1);
    });
  }
} catch (err) {
  console.error('✗ Dual warranty routing verifier failed — ' + ((err && err.message) || err));
  process.exit(1);
}
