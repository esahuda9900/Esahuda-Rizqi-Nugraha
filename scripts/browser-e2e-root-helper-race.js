/**
 * Production root canonical helper race torture test.
 *
 * Intentionally loads canonical-warranty-helper.js (root production helper),
 * not modules/canonical-warranty-helper.js.
 *
 * Matrix:
 *   A=500ms,  B=100ms
 *   A=2000ms, B=100ms
 *   A=100ms,  B=2000ms
 *
 * No business data is mutated. This is a synthetic browser fixture that only
 * exercises the helper's async DOM-write contract.
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT_HELPER_PATH = path.join(process.cwd(), 'canonical-warranty-helper.js');
const OUTPUT_DIR = path.join(process.cwd(), 'production-verify');
const REPORT_PATH = path.join(OUTPUT_DIR, 'canonical-root-helper-race.json');

const PRIME = '0239-2026-SDLG-PFR';
const TARGET = '0211-2026-SDLG-PFR';

const PRIME_PERSON = 'Technician — Prime Tech';
const TARGET_PERSON = 'Technician — Target Tech';

const PRIME_REPORT = 'PRIME complaint text deliberately longer than fifty six characters';
const TARGET_REPORT = 'TARGET complaint text deliberately longer than fifty six characters';

function fail(message) {
  throw new Error('CANONICAL ROOT HELPER RACE FAILED: ' + message);
}

async function runScenario(browser, aDelay, bDelay) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const requestTrace = [];
  const mutationTrace = [];
  const pageErrors = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.route('https://mock.sdlg-root.test/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const claimId = new URL(url).searchParams.get('claim_id');
    const delay = claimId === PRIME ? aDelay : claimId === TARGET ? bDelay : 0;

    requestTrace.push({
      event: 'request-intercepted',
      atMs: Date.now(),
      claimId,
      delayMs: delay,
    });

    const payload = {
      data: claimId === PRIME
        ? {
            claim_id: PRIME,
            technical_personnel: 'Prime Tech',
            fault_description: PRIME_REPORT,
          }
        : {
            claim_id: TARGET,
            technical_personnel: 'Target Tech',
            fault_description: TARGET_REPORT,
          },
      error: null,
    };

    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });

    requestTrace.push({
      event: 'response-released',
      atMs: Date.now(),
      claimId,
      delayMs: delay,
    });
  });

  try {
    await page.setContent(
      '<!doctype html><html><body>' +
      '<div id="claim-id">' + PRIME + '</div>' +
      '<div id="person">Technician — Akhsana Taqwim</div>' +
      '<div id="report">' + PRIME_REPORT + '</div>' +
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
                'https://mock.sdlg-root.test/claims?claim_id=' +
                encodeURIComponent(state.claimId)
              ).then((r) => r.json());
            },
          };
          return builder;
        },
      };
    });

    await page.evaluate(() => {
      const targetNodes = [
        document.getElementById('person'),
        document.getElementById('report'),
      ];

      window.__rootHelperMutationTrace = [];

      const observer = new MutationObserver(() => {
        window.__rootHelperMutationTrace.push({
          atMs: performance.now(),
          selectedClaimId: document.getElementById('claim-id')?.textContent?.trim() || null,
          person: document.getElementById('person')?.textContent || '',
          report: document.getElementById('report')?.textContent || '',
        });
      });

      targetNodes.forEach((node) => observer.observe(node, {
        childList: true,
        subtree: true,
        characterData: true,
      }));
    });

    await page.addScriptTag({ path: ROOT_HELPER_PATH });

    // Let the PRIME request start, then switch the visible claim while it is in flight.
    await page.waitForTimeout(50);

    const navigationAtMs = await page.evaluate(() => {
      document.getElementById('claim-id').textContent = '0211-2026-SDLG-PFR';
      document.getElementById('person').textContent = 'Technician — Akhsana Taqwim';
      document.getElementById('report').textContent =
        'TARGET complaint text deliberately longer than fifty six characters';
      return performance.now();
    });

    await page.waitForTimeout(500);

    const immediate = await page.evaluate(() => ({
      selectedClaimId: document.getElementById('claim-id')?.textContent?.trim() || null,
      person: document.getElementById('person')?.textContent || '',
      report: document.getElementById('report')?.textContent || '',
      helperLast: window.__SDLG_HELPER_LAST__ || null,
    }));

    await page.waitForTimeout(Math.max(2300, aDelay + bDelay + 700));

    const state = await page.evaluate(() => ({
      selectedClaimId: document.getElementById('claim-id')?.textContent?.trim() || null,
      person: document.getElementById('person')?.textContent || '',
      report: document.getElementById('report')?.textContent || '',
      helperLast: window.__SDLG_HELPER_LAST__ || null,
      trace: window.__rootHelperMutationTrace || [],
    }));

    const postNavigationTrace = state.trace.filter((entry) => entry.atMs >= navigationAtMs);
    const staleWrites = postNavigationTrace.filter((entry) =>
      entry.selectedClaimId === TARGET &&
      (entry.person === PRIME_PERSON ||
       entry.report === PRIME_REPORT ||
       entry.person.includes('Prime Tech') ||
       entry.report.includes('PRIME complaint'))
    );

    const pass = (
      state.selectedClaimId === TARGET &&
      state.person === TARGET_PERSON &&
      state.helperLast?.claimId === TARGET &&
      staleWrites.length === 0 &&
      pageErrors.length === 0
    );

    const result = {
      mode: 'root-production-helper-fixture',
      helperPath: '/canonical-warranty-helper.js',
      aDelay,
      bDelay,
      primeClaimId: PRIME,
      targetClaimId: TARGET,
      selectedClaimId: state.selectedClaimId,
      immediateWindowMs: 500,
      immediate,
      settledPerson: state.person,
      settledReport: state.report,
      helperLast: state.helperLast,
      staleWrites,
      postNavigationTrace,
      requestTrace,
      pageErrors,
      pass,
    };

    result.immediatePass = bDelay <= 100
      ? (
          immediate.selectedClaimId === TARGET &&
          immediate.person === TARGET_PERSON &&
          !immediate.person.includes('Prime Tech') &&
          !immediate.report.includes('PRIME complaint')
        )
      : true;

    result.pass = result.pass && result.immediatePass;

    if (!result.pass) {
      fail(JSON.stringify(result, null, 2));
    }

    return result;
  } finally {
    await context.close();
  }
}

async function main() {
  if (!fs.existsSync(ROOT_HELPER_PATH)) {
    fail('Root helper file not found at ' + ROOT_HELPER_PATH);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });

  try {
    const results = [];
    for (const [aDelay, bDelay] of [
      [500, 100],
      [2000, 100],
      [100, 2000],
    ]) {
      const result = await runScenario(browser, aDelay, bDelay);
      results.push(result);
      console.log('ROOT scenario: A=' + aDelay + 'ms, B=' + bDelay + 'ms pass=' + result.pass);
    }

    const report = {
      timestamp: new Date().toISOString(),
      helperPath: '/canonical-warranty-helper.js',
      results,
      overallPass: results.every((result) => result.pass),
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    if (!report.overallPass) fail('One or more root helper scenarios failed.');

    console.log('CANONICAL ROOT HELPER RACE TEST PASS');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      helperPath: '/canonical-warranty-helper.js',
      overallPass: false,
      fatalError: { message: error.message, stack: error.stack || '' },
    }, null, 2)
  );
  console.error(error.message || String(error));
  process.exit(1);
});
