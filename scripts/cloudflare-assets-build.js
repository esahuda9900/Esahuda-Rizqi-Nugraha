#!/usr/bin/env node
/**
 * Cloudflare Workers Builds entrypoint.
 *
 * Why this file exists:
 * Cloudflare dashboard / Workers Builds trigger is currently set to run:
 *   node scripts/cloudflare-assets-build.js
 *
 * That path was missing and caused MODULE_NOT_FOUND on every build
 * (see 2026-10-07 failure). Keep this thin wrapper so production
 * builds keep working even if the dashboard command is not updated.
 *
 * Canonical build authority remains scripts/build-production.js
 * (invoked via `npm run build`). Do not put product logic here.
 *
 * Environment notes (Cloudflare Workers Builds):
 * - SKIP_DEPENDENCY_INSTALL may be present (deps restored from cache)
 * - No SUPABASE_* secrets should be required for static asset build
 * - SKIP_WARRANTY_GOLDEN is auto-set by build-production.js when offline
 */

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const buildScript = path.join(root, 'scripts', 'build-production.js');

function fail(msg) {
  console.error('[cloudflare-assets-build] FAIL:', msg);
  process.exit(1);
}

function info(msg) {
  console.log('[cloudflare-assets-build]', msg);
}

// Preflight: ensure we are not running against a broken tree.
if (!fs.existsSync(buildScript)) {
  fail('scripts/build-production.js is missing — cannot build production assets');
}

const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) {
  fail('index.html is missing at repo root');
}

// Cloudflare may set SKIP_DEPENDENCY_INSTALL when restoring from cache.
// We only need Node + the scripts already in the repo; no install required here.
if (process.env.SKIP_DEPENDENCY_INSTALL) {
  info('SKIP_DEPENDENCY_INSTALL is set — using cached / checked-in tree');
}

// Ensure offline-safe behaviour on Cloudflare (no live Supabase secrets).
if (!process.env.SKIP_WARRANTY_GOLDEN) {
  process.env.SKIP_WARRANTY_GOLDEN = '1';
  info('SKIP_WARRANTY_GOLDEN=1 (static host / no privileged secrets)');
}

info('Running canonical production build: scripts/build-production.js');

try {
  execFileSync(process.execPath, [buildScript], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  const code = typeof err.status === 'number' ? err.status : 1;
  fail('build-production.js exited with code ' + code);
}

info('Production assets ready for Cloudflare Workers deploy');
process.exit(0);
