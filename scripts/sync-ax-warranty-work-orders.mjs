#!/usr/bin/env node
import fs from 'node:fs/promises';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const seedDir = new URL('../supabase/seed/ax_warranty_work_orders.parts/', import.meta.url);
let names = [];
try {
  names = (await fs.readdir(seedDir)).filter((name) => /^\d+\.json$/i.test(name)).sort();
} catch {}

let seed;
let records;
if (names.length) {
  const parts = [];
  for (const name of names) {
    const part = JSON.parse(await fs.readFile(new URL(name, seedDir), 'utf8'));
    if (!Array.isArray(part.records)) throw new Error(`AX seed part has no records array: ${name}`);
    parts.push(part);
  }
  const sourceNames = new Set(parts.map((p) => p.source_name));
  const sourceHashes = new Set(parts.map((p) => p.source_sha256));
  if (sourceNames.size !== 1 || sourceHashes.size !== 1) throw new Error('AX seed parts disagree on source identity');
  const total = parts.reduce((n, p) => n + p.records.length, 0);
  const expected = Number(parts[0].record_count ?? total);
  if (expected !== total) throw new Error(`AX chunked seed record_count mismatch: expected ${expected}, got ${total}`);
  seed = { ...parts[0], record_count: total };
  records = parts.flatMap((p) => p.records);
} else {
  const seedPath = new URL('../supabase/seed/ax_warranty_work_orders.json', import.meta.url);
  seed = JSON.parse(await fs.readFile(seedPath, 'utf8'));
  records = Array.isArray(seed.records) ? seed.records : [];
}

const expected = Number(seed.record_count ?? records.length);
if (!records.length) throw new Error('AX seed contains no records');
if (expected !== records.length) throw new Error(`AX seed record_count mismatch: expected ${expected}, got ${records.length}`);

const seen = new Set();
for (const [i, row] of records.entries()) {
  const wo = String(row?.wo_no ?? '').trim().toUpperCase();
  if (!/^WO\d+$/.test(wo)) throw new Error(`Invalid AX WO identity at seed index ${i}`);
  if (seen.has(wo)) throw new Error(`Duplicate AX WO identity in seed: ${wo}`);
  seen.add(wo);
  row.wo_no = wo;
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};

async function rest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase REST ${response.status} ${path}: ${body}`);
  }
  return response;
}

await rest('sdlg_data_sources?on_conflict=source_name', {
  method: 'POST',
  body: JSON.stringify({
    source_name: seed.source_name,
    source_type: 'Dynamics AX warranty work orders',
    source_mime_type: 'text/markdown',
    source_sha256: seed.source_sha256,
    source_date: new Date().toISOString().slice(0, 10),
    description: 'Dynamics AX warranty work-order export. AX WO is the authoritative source for claim WO identity.',
    metadata: {
      source_physical_lines: seed.source_physical_lines,
      record_count: expected,
      parser: 'wrapped-row reconstruction v1',
      join_key: 'wo_no',
      serial_is_not_unique: true,
    },
  }),
});

const batchSize = 100;
for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  await rest('ax_warranty_work_orders?on_conflict=wo_no', {
    method: 'POST',
    body: JSON.stringify(batch),
  });
  console.log(`Synced ${Math.min(i + batchSize, records.length)}/${records.length} AX WOs`);
}

const verifyResponse = await rest(`ax_warranty_work_orders?select=wo_no,source_sha256&source_sha256=eq.${encodeURIComponent(seed.source_sha256)}&limit=1000`);
const verified = await verifyResponse.json();
const verifiedCount = Array.isArray(verified) ? verified.length : 0;
if (verifiedCount !== expected) {
  throw new Error(`AX sync verification failed: seed=${expected}, db_source_hash=${verifiedCount}`);
}

console.log(`Dynamics AX sync completed: ${verifiedCount} records sourced from ${seed.source_physical_lines} physical data lines.`);
