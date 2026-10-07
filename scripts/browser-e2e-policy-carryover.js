/**
 * Canonical policy carry-over evidence suite.
 *
 * A) Direct fixture test of modules/canonical-warranty-helper.js:
 *    exact async path under test, with response-delay interception.
 *
 * B) Production surface test:
 *    current production PolicyDecisionCard path, with claim_warranty_policy_v response delays.
 *
 * No business data is mutated.
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = (process.env.BASE_URL || 'https://sdlg-warranty-backup.esahuda9900.workers.dev/').replace(/\/+$/, '/');
const EMAIL = process.env.E2E_TEST_EMAIL || '';
const PASSWORD = process.env.E2E_TEST_PASSWORD || '';

const PRIME = '0239-2026-SDLG-PFR';
const TARGET = '0211-2026-SDLG-PFR';
const PRIME_SCOPE = '5 t < T <= 6 t';
const TARGET_SCOPE = '20 t <= T < 65 t';

const MODULE_PATH = path.join(process.cwd(), 'modules', 'canonical-warranty-helper.js');
const OUTPUT_DIR = path.join(process.cwd(), 'production-verify');
const REPORT_PATH = path.join(OUTPUT_DIR, 'canonical-policy-carryover.json');
let lastReport = null;

function fail(message) {
  throw new Error('CANONICAL POLICY CARRY-OVER FAILED: ' + message);
}

function scopeFromBadgeText(text) {
  const match = String(text || '').match(/Scope:\s*([^\n·]+)/i);
  return match ? match[1].trim() : null;
}

async function runModuleFixtureScenario(browser, aDelay, bDelay) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const trace = [];
  const pageErrors = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.route('https://mock.sdlg.test/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const claimId = (() => {
      if (url.includes('/claims?')) return new URL(url).searchParams.get('claim_id');
      try { return request.postDataJSON()?.p_claim_id || null; } catch (_) { return null; }
    })();

    const delay = claimId === PRIME ? aDelay : claimId === TARGET ? bDelay : 0;
    const endpoint = url.includes('/rpc/') ? 'sdlg_warranty_resolve_claim' : 'claims';

    trace.push({
      event: 'request-intercepted',
      atMs: Date.now(),
      claimId,
      endpoint,
      delayMs: delay,
    });

    const payload = endpoint === 'sdlg_warranty_resolve_claim'
      ? {
          data: claimId === PRIME
            ? {
                claim_id: PRIME,
                model: 'Loader',
                model_scope: PRIME_SCOPE,
                machine_status: 'IN_WARRANTY',
                component_status: 'IN_WARRANTY',
                overall_status: 'ELIGIBLE',
                component_category: 'Engine',
                warranty_tier_used: 'Standard',
                reason: 'fixture PRIME',
                machine_policies: [],
              }
            : {
                claim_id: TARGET,
                model: 'E6210F',
                model_scope: TARGET_SCOPE,
                machine_status: 'IN_WARRANTY',
                component_status: 'IN_WARRANTY',
                overall_status: 'REVIEW_REQUIRED',
                component_category: 'UNMAPPED',
                warranty_tier_used: 'Standard',
                reason: 'fixture TARGET',
                machine_policies: [],
              },
          error: null,
        }
      : {
          data: claimId === PRIME
            ? { claim_id: PRIME, technical_personnel: 'Prime Tech', fault_description: 'prime fixture' }
            : { claim_id: TARGET, technical_personnel: 'Target Tech', fault_description: 'target fixture' },
          error: null,
        };

    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });

    trace.push({
      event: 'response-released',
      atMs: Date.now(),
      claimId,
      endpoint,
      delayMs: delay,
    });
  });

  try {
    await page.setContent(
      '<!doctype html><html><body>' +
      '<div id="claim-id">' + PRIME + '</div>' +
      '<div id="warranty-anchor">Warranty Engine</div>' +
      '<label for="feedback-person">Feedback Person</label><input id="feedback-person">' +
      '<label for="whole-machine">Whole Machine Warranty</label><input id="whole-machine">' +
      '<button data-sdlg-copy-report-name data-value="prime fixture">Copy</button>' +
      '</body></html>',
      { waitUntil: 'domcontentloaded' }
    );

    await page.evaluate(() => {
      window.sdlgSupabase = {
        from(table) {
          const state = { table, claimId: null };
          const builder = {
            select() { return builder; },
            eq(_field, value) { state.claimId = value; return builder; },
            maybeSingle() {
              return fetch(
                'https://mock.sdlg.test/claims?claim_id=' +
                encodeURIComponent(state.claimId)
              ).then((r) => r.json());
            },
          };
          return builder;
        },
        rpc(name, args) {
          return fetch('https://mock.sdlg.test/rpc/' + name, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(args || {}),
          }).then((r) => r.json());
        },
      };
    });

    await page.evaluate(() => {
      window.__canonicalCarryoverTrace = [];
      const nativeInsertBefore = Element.prototype.insertBefore;
      Element.prototype.insertBefore = function (newNode, referenceNode) {
        if (newNode && newNode.id === 'sdlg-canonical-warranty-badge') {
          window.__canonicalCarryoverTrace.push({
            event: 'badge-insert',
            atMs: performance.now(),
            selectedClaimId: document.getElementById('claim-id')?.textContent || null,
            badgeScope: (newNode.innerText || '').match(/Scope:\\s*([^\\n·]+)/i)?.[1]?.trim() || null,
            badgeText: newNode.innerText || '',
          });
        }
        return nativeInsertBefore.call(this, newNode, referenceNode);
      };
    });

    await page.addScriptTag({ path: MODULE_PATH });
    await page.waitForTimeout(500);

    const primeResolverReached = trace.some((entry) =>
      entry.endpoint === 'sdlg_warranty_resolve_claim' &&
      entry.claimId === PRIME &&
      entry.event === 'request-intercepted'
    );
    if (!primeResolverReached) {
      const diagnostics = await page.evaluate(() => ({
        readyState: document.readyState,
        hasSupabaseClient: !!window.sdlgSupabase,
        bodyText: document.body?.innerText || '',
        helperScriptCount: Array.from(document.scripts).length,
        badgePresent: !!document.getElementById('sdlg-canonical-warranty-badge'),
      }));
      fail(
        'Direct module fixture did not reach PRIME resolver RPC within 500ms. ' +
        'Diagnostics: ' + JSON.stringify({ trace, pageErrors, diagnostics })
      );
    }

    await page.locator('#claim-id').evaluate((el) => {
      el.textContent = '0211-2026-SDLG-PFR';
    });
    await page.waitForTimeout(500);

    const immediateBadge = await page.locator('#sdlg-canonical-warranty-badge').first().isVisible().catch(() => false)
      ? scopeFromBadgeText(await page.locator('#sdlg-canonical-warranty-badge').innerText())
      : null;

    await page.waitForTimeout(Math.max(2600, bDelay + 500));

    const badge = page.locator('#sdlg-canonical-warranty-badge').first();
    const settledVisible = await badge.isVisible().catch(() => false);
    const settledText = settledVisible ? await badge.innerText() : '';
    const settledScope = scopeFromBadgeText(settledText);

    const mutationTrace = await page.evaluate(() => window.__canonicalCarryoverTrace || []);
    const stalePostTargetWrites = mutationTrace.filter((entry) =>
      entry.event === 'badge-insert' &&
      entry.selectedClaimId === TARGET &&
      entry.badgeScope === PRIME_SCOPE
    );

    const selectedClaimId = await page.locator('#claim-id').innerText();

    return {
      mode: 'direct-module-fixture',
      aDelay,
      bDelay,
      primeClaimId: PRIME,
      targetClaimId: TARGET,
      primeScope: PRIME_SCOPE,
      targetScope: TARGET_SCOPE,
      immediateBadgeScope: immediateBadge,
      settledBadgeScope: settledScope,
      selectedClaimId,
      stalePostTargetWrites,
      badgeInsertTrace: mutationTrace,
      requestTrace: trace,
      pageErrors,
      pass: (
        selectedClaimId === TARGET &&
        settledScope === TARGET_SCOPE &&
        stalePostTargetWrites.length === 0 &&
        pageErrors.length === 0 &&
        (bDelay <= 100 ? immediateBadge === TARGET_SCOPE : true)
      ),
    };
  } finally {
    await context.close();
  }
}

async function login(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!response || !response.ok()) fail('Production page unavailable during authentication.');

  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  const loginScreen = page.locator('.login-screen');
  const scope = (await loginScreen.count()) ? loginScreen.first() : page.locator('body');
  const emailInput = scope.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[type="text"]').first();
  const passwordInput = scope.locator('input[type="password"]').first();
  const submitButton = scope.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Masuk")').first();

  if (!(await emailInput.count()) || !(await passwordInput.count())) {
    await context.close();
    fail('Production login form not found.');
  }

  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  if (await submitButton.count()) await submitButton.click();
  else await passwordInput.press('Enter');

  if (await loginScreen.count()) {
    try {
      await loginScreen.first().waitFor({ state: 'detached', timeout: 20000 });
    } catch (_) {
      try {
        await loginScreen.first().waitFor({ state: 'hidden', timeout: 5000 });
      } catch (__) {
        await context.close();
        fail('Production authentication did not leave login shell.');
      }
    }
  }

  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  const afterLogin = (await page.locator('body').innerText()).trim();
  if (!/dashboard|claim|warranty|command center|action center|logout|sign out|keluar|sdlg/i.test(afterLogin)) {
    await context.close();
    fail('Post-login production shell did not show operational markers.');
  }

  const storageState = await context.storageState();
  await context.close();
  return storageState;
}

async function openClaims(page) {
  const button = page.getByRole('button', { name: /^Claims/i }).first();
  try {
    await button.waitFor({ state: 'visible', timeout: 20000 });
  } catch (_) {
    const visibleButtons = await page.locator('button.nav-btn:visible').allTextContents();
    fail('Claims navigation button did not become visible. Visible nav labels: ' + JSON.stringify(visibleButtons));
  }
  await button.click({ timeout: 8000 });
  await page.locator('.claims-searchbar input').first().waitFor({ state: 'visible', timeout: 20000 });
}

async function openExactClaim(page, claimId) {
  const search = page.locator('.claims-searchbar input').first();
  await search.waitFor({ state: 'visible', timeout: 20000 });
  await search.fill(claimId);

  const exact = page.getByText(claimId, { exact: true }).first();
  try {
    await exact.waitFor({ state: 'visible', timeout: 20000 });
  } catch (_) {
    const visibleRows = await page.locator('.claim-row:visible').allTextContents();
    const body = (await page.locator('body').innerText()).slice(-5000);
    fail(
      'Exact production claim not found: ' + claimId +
      '. Visible claim rows: ' + JSON.stringify(visibleRows.slice(0, 10)) +
      '. Body tail: ' + JSON.stringify(body)
    );
  }

  await exact.click({ timeout: 8000 });
  await page.waitForTimeout(900);
}

async function returnToClaims(page) {
  const back = page.getByRole('button', { name: /Kembali/i }).first();
  if (!(await back.count()) || !(await back.isVisible().catch(() => false))) {
    fail('Production Claim Detail back button not found.');
  }
  await back.click({ timeout: 6000 });
  await page.waitForTimeout(700);
}

async function captureProductionScope(page) {
  const panel = page.locator('.card').filter({ hasText: /Policy Decision/i }).first();
  const canonicalBadge = page.locator('#sdlg-canonical-warranty-badge').first();
  const canonicalBadgeVisible = await canonicalBadge.isVisible().catch(() => false);
  const canonicalBadgeText = canonicalBadgeVisible ? (await canonicalBadge.innerText()).trim() : null;

  if (!(await panel.count()) || !(await panel.isVisible().catch(() => false))) {
    return {
      scope: null,
      policyRowModelScope: null,
      text: '',
      visible: false,
      canonicalBadgeText,
    };
  }

  const text = (await panel.innerText()).trim();
  const policyRowModelScope = (await panel.locator('span').allTextContents())
    .map((v) => String(v).trim())
    .find((v) => /(?:^|\s)\d+(?:\.\d+)?\s*t\s*(?:<=|<|≥|>)\s*T\s*(?:<=|<|≥|>)\s*\d+(?:\.\d+)?\s*t/i.test(v))
    || null;

  return {
    scope: policyRowModelScope,
    policyRowModelScope,
    text,
    visible: true,
    canonicalBadgeText,
  };
}

async function runProductionScenario(browser, storageState, aDelay, bDelay) {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const trace = [];
  const pageErrors = [];
  let resolveTargetPolicyResponse;
  const targetPolicyResponse = new Promise((resolve) => {
    resolveTargetPolicyResponse = resolve;
  });

  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.route('**/rest/v1/claim_warranty_policy_v**', async (route) => {
    const request = route.request();
    const url = request.url();
    const raw = new URL(url).searchParams.get('claim_id');
    const claimId = raw ? raw.replace(/^eq\./, '') : null;
    const delay = claimId === PRIME ? aDelay : claimId === TARGET ? bDelay : 0;

    trace.push({
      event: 'request-intercepted',
      atMs: Date.now(),
      claimId,
      endpoint: 'claim_warranty_policy_v',
      delayMs: delay,
    });

    const response = await route.fetch();
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({ response });

    trace.push({
      event: 'response-released',
      atMs: Date.now(),
      claimId,
      endpoint: 'claim_warranty_policy_v',
      delayMs: delay,
    });

    if (claimId === TARGET) resolveTargetPolicyResponse();
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await openClaims(page);
    await openExactClaim(page, PRIME);
    await page.waitForTimeout(500);

    const primeReached = trace.some((entry) =>
      entry.claimId === PRIME && entry.endpoint === 'claim_warranty_policy_v'
    );
    if (!primeReached) fail('Production claim_warranty_policy_v PRIME path was not reached.');

    await returnToClaims(page);
    await openExactClaim(page, TARGET);

    // "Immediate" is response-synchronized: the TARGET policy response has just
    // been released and the browser has had one render frame to commit policyRow.
    await Promise.race([
      targetPolicyResponse,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TARGET policy response did not complete within 20s.')), 20000)
      ),
    ]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

    const immediate = await captureProductionScope(page);
    const currentClaimId = await page.getByText(TARGET, { exact: true }).first().innerText().catch(() => null);

    // Settled checkpoint: allow follow-up renders/effects to finish without a
    // fixed sleep tied to the configured interception delay.
    await page.waitForTimeout(500);
    const settled = await captureProductionScope(page);
    const settledClaimId = await page.getByText(TARGET, { exact: true }).first().innerText().catch(() => null);
    const body = await page.locator('body').innerText();

    const result = {
      mode: 'production-policy-decision',
      aDelay,
      bDelay,
      primeClaimId: PRIME,
      targetClaimId: TARGET,
      primeScope: PRIME_SCOPE,
      targetScope: TARGET_SCOPE,
      immediateScope: immediate.scope,
      immediatePolicyRowModelScope: immediate.policyRowModelScope,
      immediateCanonicalBadgeText: immediate.canonicalBadgeText,
      immediateCurrentClaimId: currentClaimId,
      settledScope: settled.scope,
      settledPolicyRowModelScope: settled.policyRowModelScope,
      settledCanonicalBadgeText: settled.canonicalBadgeText,
      settledCurrentClaimId: settledClaimId,
      targetVisibleInBody: body.includes(TARGET),
      requestTrace: trace,
      pageErrors,
      pass: (
        body.includes(TARGET) &&
        currentClaimId === TARGET &&
        settledClaimId === TARGET &&
        settled.scope === TARGET_SCOPE &&
        settled.policyRowModelScope === TARGET_SCOPE &&
        pageErrors.length === 0 &&
        (bDelay <= 100 ? immediate.policyRowModelScope === TARGET_SCOPE : true)
      ),
    };

    if (!result.pass) {
      fail('Production scenario ' + aDelay + 'ms/' + bDelay + 'ms failed:\n' + JSON.stringify(result, null, 2));
    }

    return result;
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });

  try {
    const moduleResults = [];
    for (const [aDelay, bDelay] of [
      [500, 100],
      [2000, 100],
      [100, 2000],
    ]) {
      const result = await runModuleFixtureScenario(browser, aDelay, bDelay);
      moduleResults.push(result);
      console.log('MODULE scenario: A=' + aDelay + 'ms, B=' + bDelay + 'ms pass=' + result.pass);
    }

    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      moduleHelperPath: 'modules/canonical-warranty-helper.js',
      rootHelperProductionPath: '/canonical-warranty-helper.js',
      moduleResults,
      productionExecuted: false,
      productionResults: [],
    };

    // Persist the module evidence before touching the production surface so a
    // later production-harness failure cannot erase already completed evidence.
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    if (EMAIL && PASSWORD) {
      const storageState = await login(browser);
      report.productionExecuted = true;
      for (const [aDelay, bDelay] of [
        [500, 100],
        [2000, 100],
        [100, 2000],
      ]) {
        const result = await runProductionScenario(browser, storageState, aDelay, bDelay);
        report.productionResults.push(result);
        fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
        console.log('PRODUCTION scenario: A=' + aDelay + 'ms, B=' + bDelay + 'ms pass=' + result.pass);
      }
    } else {
      report.productionSkipReason = 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured.';
    }

    report.overallPass =
      moduleResults.every((r) => r.pass) &&
      (!report.productionExecuted || report.productionResults.every((r) => r.pass));

    lastReport = report;
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    if (process.env.MODULE_ONLY === 'true') {
      if (!report.moduleResults.every((r) => r.pass)) {
        fail('One or more direct module carry-over scenarios failed.');
      }
      console.log('CANONICAL MODULE POLICY CARRY-OVER TEST PASS');
      return;
    }

    if (!report.overallPass) fail('One or more carry-over scenarios failed.');
    console.log('CANONICAL POLICY CARRY-OVER EVIDENCE SUITE PASS');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const failure = {
    ...(lastReport || {}),
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    moduleHelperPath: 'modules/canonical-warranty-helper.js',
    rootHelperProductionPath: '/canonical-warranty-helper.js',
    overallPass: false,
    fatalError: { message: error.message, stack: error.stack || '' },
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(failure, null, 2));
  console.error(error.message || String(error));
  process.exit(1);
});
