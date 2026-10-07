#!/usr/bin/env node
/**
 * After importing AX warranty work orders into Supabase, run learned fixes:
 *   1) serial corrections (typo maps + chassis promote)
 *   2) machine branch from latest primary_resource_group
 *   3) machine customer from latest delivery_name
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/post-ax-import-refresh.js
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/post-ax-import-refresh.js --dry-run
 *
 * Prefer service_role so RLS does not block bulk machine updates.
 * Never expose service_role to the browser.
 */
'use strict';

const dryRun = process.argv.includes('--dry-run');

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

if (!url || !key) {
  console.error(
    'Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).'
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
  console.warn(
    '[warn] Using non-service key; branch/customer updates may be blocked by RLS.'
  );
}

async function main() {
  const endpoint = `${url}/rest/v1/rpc/sdlg_post_ax_import_refresh`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ p_dry_run: dryRun }),
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    console.error('RPC failed', res.status, body);
    process.exit(1);
  }

  console.log(dryRun ? 'Dry run — post AX import refresh' : 'Applied — post AX import refresh');
  if (Array.isArray(body)) {
    for (const row of body) {
      console.log(
        `  ${row.step}: ${row.detail} rows=${row.rows_affected}`
      );
    }
  } else {
    console.log(body);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
