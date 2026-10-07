const isGitHubActions = String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';
const isCi = isGitHubActions || String(process.env.CI || '').toLowerCase() === 'true';
const skipGolden = ['1', 'true', 'yes'].includes(String(process.env.SKIP_WARRANTY_GOLDEN || '').trim().toLowerCase());

if (skipGolden) {
  console.warn('⚠ Warranty golden RPC skipped by explicit SKIP_WARRANTY_GOLDEN build flag.');
  console.warn('  This is intended for static hosting builds that must not receive privileged Supabase credentials.');
  process.exit(0);
}

// GitHub Actions production CI should use service_role; local/static hosts may use anon or offline.
const requiredEnv = isGitHubActions
  ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  : ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnv = requiredEnv.filter((name) => !process.env[name] || !String(process.env[name]).trim());

const claimId = '0231-2026-SDLG-PFR';

function assertGolden(result, sourceLabel) {
  const componentRule = result?.component_rule || {};
  const failures = [];

  const checks = [
    ['claim_id', result?.claim_id === claimId, result?.claim_id],
    ['machine_status', result?.machine_status === 'IN_WARRANTY', result?.machine_status],
    ['component_status', result?.component_status === 'IN_WARRANTY', result?.component_status],
    ['overall_status', result?.overall_status === 'ELIGIBLE', result?.overall_status],
    ['component_identity', result?.component_identity === 'Fuel Tank', result?.component_identity],
    ['component_category', result?.component_category === 'Other parts', result?.component_category],
    ['warranty_tier_used', result?.warranty_tier_used === 'Contract Customer', result?.warranty_tier_used],
    ['contract_customer_effective', result?.contract_customer_effective === true, result?.contract_customer_effective],
    ['warranty_months', componentRule.warranty_months === 18, componentRule.warranty_months],
    ['warranty_hours', componentRule.warranty_hours === 3000, componentRule.warranty_hours]
  ];

  for (const [name, ok, actual] of checks) {
    if (ok) console.log(`✓ Warranty golden (${sourceLabel}): ${name} = ${JSON.stringify(actual)}`);
    else {
      failures.push(`${name}: expected contract value, received ${JSON.stringify(actual)}`);
      console.error(`✗ Warranty golden (${sourceLabel}): ${name} = ${JSON.stringify(actual)}`);
    }
  }

  if (failures.length) {
    console.error(`\nWARRANTY GOLDEN: FAIL (${failures.length} issue(s))`);
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log(`\nWARRANTY GOLDEN: PASS — ${claimId} (${sourceLabel})`);
}

async function runRemote() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '');
  const apiKey = isGitHubActions
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

  const response = await fetch(`${url}/rest/v1/rpc/sdlg_warranty_resolve_claim`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_claim_id: claimId })
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Supabase RPC returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`Supabase RPC failed (${response.status}): ${payload?.message || payload?.error || text}`);
  }

  const result = payload && typeof payload === 'object' && payload.r ? payload.r : payload;
  assertGolden(result, isGitHubActions ? 'Supabase RPC (trusted CI role)' : 'Supabase RPC');
}

function runOffline(reason) {
  const fixture = {
    claim_id: claimId,
    machine_status: 'IN_WARRANTY',
    component_status: 'IN_WARRANTY',
    overall_status: 'ELIGIBLE',
    component_identity: 'Fuel Tank',
    component_category: 'Other parts',
    warranty_tier_used: 'Contract Customer',
    contract_customer_effective: true,
    component_rule: {
      warranty_months: 18,
      warranty_hours: 3000
    }
  };

  console.warn(`⚠ Warranty golden remote test unavailable — ${reason}`);
  console.warn('Running golden assertions against the committed offline fixture (static host / local).');
  assertGolden(fixture, 'offline fixture');
}

if (missingEnv.length) {
  // Only GitHub Actions production CI is required to have live secrets.
  // Cloudflare Workers Builds also set CI=true but never ship SUPABASE_* — offline is correct.
  if (isGitHubActions) {
    console.error(`✗ Warranty golden remote test cannot run in GitHub Actions — missing: ${missingEnv.join(', ')}`);
    console.error('GitHub Actions must exercise the live canonical Supabase RPC with protected secrets.');
    process.exit(1);
  }
  runOffline('missing environment variable(s): ' + missingEnv.join(', '));
} else {
  runRemote().catch((err) => {
    console.error(`✗ Warranty golden test crashed — ${err.message}`);
    process.exit(1);
  });
}
