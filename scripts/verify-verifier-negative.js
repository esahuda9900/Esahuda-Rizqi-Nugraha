/**
 * Black-box negative-contract tests for scripts/verify-production-live.js.
 *
 * The real verifier runs in BUILD_ONLY mode. Only the external production HTML
 * and Cloudflare API are mocked. This keeps the verifier's own gating logic under test.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO_ROOT = process.cwd();
const VERIFIER = path.join(REPO_ROOT, 'scripts', 'verify-production-live.js');
const MOCK_PRELOAD = path.join(REPO_ROOT, 'scripts', 'test-production-verifier-mock.cjs');
const BASE_URL = 'https://negative-test.invalid/';
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlg-verifier-negative-'));
const LIVE_HTML_PATH = path.join(TMP_DIR, 'live-index.html');

function fail(message) {
  throw new Error('VERIFIER NEGATIVE CONTRACT FAILED: ' + message);
}

function runVerifier({ expectedCommit, cloudflareCommit, mutateLive = false, blockedCommit = '' }) {
  const env = {
    ...process.env,
    BASE_URL,
    BUILD_ONLY: 'true',
    EXPECTED_CLOUDFLARE_COMMIT: expectedCommit,
    CLOUDFLARE_API_TOKEN: 'negative-test-token',
    CLOUDFLARE_ACCOUNT_ID: 'negative-test-account',
    CLOUDFLARE_SCRIPT_NAME: 'sdlg-warranty-backup',
    CLOUDFLARE_BUILD_WAIT_SECONDS: '1',
    NEGATIVE_TEST_LIVE_HTML_PATH: LIVE_HTML_PATH,
    NEGATIVE_TEST_MUTATE_LIVE: mutateLive ? 'true' : 'false',
    NEGATIVE_TEST_CLOUDFLARE_COMMIT: cloudflareCommit,
    NEGATIVE_TEST_BLOCKED_GIT_COMMIT: blockedCommit,
    GITHUB_REPOSITORY: 'esahuda9900/sdlg-warranty-backup',
    GITHUB_SHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    GITHUB_RUN_ID: 'negative-contract',
    GITHUB_RUN_NUMBER: '1',
    GITHUB_WORKFLOW: 'Verifier Negative Contract',
    NODE_OPTIONS: [process.env.NODE_OPTIONS || '', '--require=' + MOCK_PRELOAD].filter(Boolean).join(' '),
  };

  const result = spawnSync(process.execPath, [VERIFIER], {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const reportPath = path.join(REPO_ROOT, 'production-verify', 'report.json');
  if (!fs.existsSync(reportPath)) {
    fail('Verifier did not write production-verify/report.json.\nSTDOUT:\n' + result.stdout + '\nSTDERR:\n' + result.stderr);
  }

  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function assertNegative(name, report) {
  if (report.liveMatchesBuildOutput !== false) {
    fail(name + ': expected liveMatchesBuildOutput=false, got ' + String(report.liveMatchesBuildOutput) + '\n' +
      JSON.stringify(report.buildVerification || null, null, 2));
  }
  console.log('PASS negative: ' + name);
}

function assertPositive(report) {
  if (report.liveMatchesBuildOutput !== true) {
    fail('Positive control expected liveMatchesBuildOutput=true, got ' + String(report.liveMatchesBuildOutput) + '\n' +
      JSON.stringify(report.buildVerification || null, null, 2));
  }
  console.log('PASS positive control: exact live/build reproduction');
}

function main() {
  if (!fs.existsSync(VERIFIER)) fail('Missing verifier: ' + VERIFIER);
  if (!fs.existsSync(MOCK_PRELOAD)) fail('Missing mock harness: ' + MOCK_PRELOAD);

  // Build the exact current source once so the mock live artifact is a known-good
  // production artifact for the positive control and the one-byte mutation case.
  execFileSync(process.execPath, ['scripts/build-production.js'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  fs.writeFileSync(LIVE_HTML_PATH, fs.readFileSync(path.join(REPO_ROOT, 'index.html')));

  const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();

  assertPositive(runVerifier({
    expectedCommit: currentCommit,
    cloudflareCommit: currentCommit,
  }));

  // 1) Wrong expected Cloudflare commit SHA. The mocked API reports the current
  // repository commit, while the verifier is deliberately pinned to the wrong SHA.
  assertNegative(
    'wrong expected Cloudflare commit SHA',
    runVerifier({
      expectedCommit: '1111111111111111111111111111111111111111',
      cloudflareCommit: currentCommit,
    })
  );

  // 2) Mutate exactly one byte of the mocked live production HTML. The Cloudflare
  // build reproduction remains unchanged, so the verifier must catch the byte mismatch.
  assertNegative(
    'one-byte live build output mutation',
    runVerifier({
      expectedCommit: currentCommit,
      cloudflareCommit: currentCommit,
      mutateLive: true,
    })
  );

  // 3) Cloudflare reports a successful commit that cannot exist in the repository.
  // The mock blocks the verifier's fallback git fetch so the test remains offline.
  const missingCommit = '2222222222222222222222222222222222222222';
  const missingReport = runVerifier({
    expectedCommit: missingCommit,
    cloudflareCommit: missingCommit,
    blockedCommit: missingCommit,
  });
  assertNegative('Cloudflare commit unavailable in repository', missingReport);

  if (missingReport.buildVerification?.available !== false) {
    fail('Missing Cloudflare commit should set buildVerification.available=false.');
  }
  if (!missingReport.buildVerification?.error?.message) {
    fail('Missing Cloudflare commit should surface a verifier error message.');
  }

  console.log('VERIFIER NEGATIVE CONTRACT PASS: all required negative cases failed closed.');
}

try {
  main();
} finally {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}
