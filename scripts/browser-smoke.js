const { chromium } = require('playwright');
const vm = require('node:vm');

const baseUrl = process.env.BASE_URL || 'https://sdlg-warranty-backup.esahuda9900.workers.dev/';
const supabaseUrl = process.env.SUPABASE_URL || 'https://frqvelcreczmnofldrga.supabase.co';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL || undefined;

function isNoiseConsoleError(entry) {
  const text = String(entry || '');
  if (/favicon|sourcemap|DevTools|Download the React DevTools|net::ERR_BLOCKED_BY_CLIENT|third-party cookie|chrome-extension:/i.test(text)) return true;
  if (/Failed to load resource:.*status of (401|403)/i.test(text)) return true;
  if (/\b(401|403)\b/.test(text) && /supabase\.co|\/rest\/v1|\/auth\/v1|\/functions\/v1/i.test(text)) return true;
  return false;
}

function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) blocks.push({ attrs: match[1] || '', body: match[2] || '' });
  return blocks;
}

function attrValue(attrs, name) {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = re.exec(attrs || '');
  return match ? match[1] : null;
}

async function verifyLiveScriptSyntax(page, html) {
  const failures = [];
  const blocks = extractScriptBlocks(html);

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const src = attrValue(block.attrs, 'src');
    if (src) {
      const url = new URL(src, baseUrl).toString();
      const response = await page.request.get(url);
      if (!response.ok()) {
        failures.push(`${src}: HTTP ${response.status()}`);
        continue;
      }
      const source = await response.text();
      try {
        new vm.Script(source, { filename: src });
      } catch (error) {
        failures.push(`${src}: ${error.message}`);
      }
      continue;
    }

    const type = attrValue(block.attrs, 'type');
    if (type && !/javascript|text\/javascript/i.test(type)) continue;
    const source = block.body;
    if (!source.trim()) continue;
    try {
      new vm.Script(source, { filename: `index.html:<script-${i + 1}>` });
    } catch (error) {
      failures.push(`inline script #${i + 1}: ${error.message}`);
    }
  }

  if (failures.length) throw new Error(`Live script syntax validation failed:\n${failures.join('\n')}`);
}


// Mobile layout smoke: catch desktop-canvas regressions before production release.
async function verifyMobileLayout(page) {
  const mobile = await page.context().browser().newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 1,
    isMobile: true,
  });
  const mobilePage = await mobile.newPage();
  try {
    const response = await mobilePage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!response || !response.ok()) throw new Error(`Mobile production page returned ${response?.status() ?? 'no response'}`);
    const result = await mobilePage.evaluate(() => {
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const bodyWidth = document.body.scrollWidth;
      const viewportWidth = window.innerWidth;
      const checkbox = document.querySelector('input[type="checkbox"]');
      const checkboxWidth = checkbox ? checkbox.getBoundingClientRect().width : null;
      return {
        viewport,
        bodyWidth,
        viewportWidth,
        horizontalOverflow: bodyWidth > viewportWidth + 2,
        checkboxWidth,
      };
    });
    if (!/width=device-width/i.test(result.viewport)) {
      throw new Error(`Mobile viewport meta missing or invalid: ${result.viewport}`);
    }
    if (result.horizontalOverflow) {
      throw new Error(`Mobile horizontal overflow detected: body=${result.bodyWidth}px viewport=${result.viewportWidth}px`);
    }
    if (result.checkboxWidth !== null && (result.checkboxWidth < 14 || result.checkboxWidth > 28)) {
      throw new Error(`Mobile checkbox sizing regression: ${result.checkboxWidth}px`);
    }
    console.log(`MOBILE LAYOUT PASS: viewport=${result.viewportWidth}px body=${result.bodyWidth}px checkbox=${result.checkboxWidth ?? 'n/a'}px`);
  } finally {
    await mobile.close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: browserChannel, headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push({ message: error.message, stack: error.stack || '' });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!response || !response.ok()) throw new Error(`Production page returned ${response?.status() ?? 'no response'}`);

    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    const html = await response.text();
    const title = await page.title();
    const body = (await page.locator('body').innerText()).trim();

    if (!/SDLG Warranty/i.test(`${title}\n${body}`)) {
      throw new Error('Expected SDLG Warranty marker is missing from the browser-rendered page');
    }
    if (!/login|sign in|masuk/i.test(body)) {
      throw new Error('Expected authentication shell is not visible to an unauthenticated browser');
    }

    const reactRuntime = await page.evaluate(() => ({
      react: Boolean(window.React),
      reactDom: Boolean(window.ReactDOM),
      reactVersion: window.React && window.React.version ? window.React.version : null,
    }));
    if (!reactRuntime.react || !reactRuntime.reactDom) {
      throw new Error(`React runtime missing in production: React=${reactRuntime.react}, ReactDOM=${reactRuntime.reactDom}, version=${reactRuntime.reactVersion ?? 'n/a'}`);
    }

    const moduleRuntime = await page.evaluate(() => ({
      payment: Boolean(window.SDLGPaymentEvidence),
      rebalancing: Boolean(window.SDLGRebalancingEvidence),
      commandCenter: Boolean(window.SDLGCommandCenter),
      bossAnalytics: Boolean(window.SDLGBossAnalytics),
    }));
    if (!moduleRuntime.payment || !moduleRuntime.rebalancing || !moduleRuntime.commandCenter || !moduleRuntime.bossAnalytics) {
      throw new Error(`Required dashboard modules missing: ${JSON.stringify(moduleRuntime)}`);
    }

    await verifyLiveScriptSyntax(page, html);
    await verifyMobileLayout(page);

    for (const path of ['/modules/sdlg-core.js', '/modules/navigation-state.js', '/modules/claim-list-sort.js', '/modules/command-center.js', '/modules/boss-analytics-dashboard.js', '/modules/payment-evidence.js', '/modules/rebalancing-evidence.js']) {
      const asset = await page.request.get(new URL(path, baseUrl).toString());
      if (!asset.ok()) throw new Error(`Required asset ${path} returned HTTP ${asset.status()}`);
    }

    const anonymousClaims = await page.request.get(`${supabaseUrl}/rest/v1/claims?select=id&limit=1`);
    if (![401, 403].includes(anonymousClaims.status())) {
      throw new Error(`Protected claims endpoint returned HTTP ${anonymousClaims.status()} to an anonymous browser request`);
    }

    if (pageErrors.length > 0) {
      const details = pageErrors.map((entry) => `${entry.message}\n${entry.stack}`).join('\n---\n');
      throw new Error(`Browser pageerror detected:\n${details}`);
    }

    const meaningfulConsoleErrors = consoleErrors.filter((entry) => !isNoiseConsoleError(entry));
    if (meaningfulConsoleErrors.length > 0) {
      throw new Error(`Browser console error detected: ${meaningfulConsoleErrors.join(' | ')}`);
    }

    console.log(`BROWSER SMOKE PASS: ${baseUrl}`);
    console.log('Live script syntax, protected claims access, and required production assets verified.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`BROWSER SMOKE FAILED: ${error.message}`);
  process.exit(1);
});
