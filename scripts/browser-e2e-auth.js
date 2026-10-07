/**
 * Authenticated browser E2E for SDLG Warranty Claim (Issue #12).
 *
 * Journey (non-mutating where possible):
 *   Login → operational shell → Claims list → open claim detail (read) →
 *   soft-check warranty / export affordances → mobile Claims + SDLG Input → Logout
 *
 * Activation:
 *   E2E_TEST_EMAIL, E2E_TEST_PASSWORD (GitHub Actions secrets)
 *   BASE_URL optional (defaults to Cloudflare production)
 *
 * Usage:
 *   BASE_URL=https://sdlg-warranty-backup.esahuda9900.workers.dev \
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *   node scripts/browser-e2e-auth.js
 */

const { chromium } = require('playwright');

const baseUrl = process.env.BASE_URL || 'https://sdlg-warranty-backup.esahuda9900.workers.dev/';
const email = process.env.E2E_TEST_EMAIL || '';
const password = process.env.E2E_TEST_PASSWORD || '';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL || undefined;

function fail(message) {
  console.error(`AUTH E2E FAILED: ${message}`);
  process.exit(1);
}

function requireCredentials() {
  if (!email || !password) {
    fail(
      'Missing E2E_TEST_EMAIL / E2E_TEST_PASSWORD. ' +
        'Create a dedicated non-production Supabase Auth user and wire the secrets before enabling this gate.'
    );
  }
}

async function run() {
  requireCredentials();

  const browser = await chromium.launch({ channel: browserChannel, headless: true });
  const page = await browser.newPage();
  const pageErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  try {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!response || !response.ok()) {
      fail(`Production page returned ${response?.status() ?? 'no response'}`);
    }

    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    const loginScreen = page.locator('.login-screen');
    try {
      await loginScreen.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch (_) {
      const bodyText = (await page.locator('body').innerText()).trim();
      if (!/login|sign in|masuk|email|password/i.test(bodyText)) {
        fail('Expected authentication shell (.login-screen) is not visible before login');
      }
    }

    const scope = (await loginScreen.count()) > 0 ? loginScreen.first() : page.locator('body');
    const emailInput = scope
      .locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[type="text"]')
      .first();
    const passwordInput = scope.locator('input[type="password"]').first();
    const submitButton = scope
      .locator(
        'button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Masuk")'
      )
      .first();

    if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
      fail('Could not locate login email/password inputs on the production shell');
    }

    await emailInput.fill(email);
    await passwordInput.fill(password);

    if ((await submitButton.count()) > 0) {
      await submitButton.click();
    } else {
      await passwordInput.press('Enter');
    }

    if ((await loginScreen.count()) > 0) {
      try {
        await loginScreen.first().waitFor({ state: 'detached', timeout: 25000 });
      } catch (_) {
        try {
          await loginScreen.first().waitFor({ state: 'hidden', timeout: 8000 });
        } catch (__) {
          fail('Login screen still visible after submit — authentication likely failed');
        }
      }
    } else {
      await page.waitForTimeout(2500);
    }

    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});

    const afterLogin = (await page.locator('body').innerText()).trim();

    if ((await page.locator('.login-screen').count()) > 0) {
      const stillVisible = await page.locator('.login-screen').first().isVisible().catch(() => false);
      if (stillVisible) {
        fail('Still on login shell after submitting credentials — authentication likely failed');
      }
    }

    const operationalHints = [
      /dashboard|claim|warranty|command center|action center|sdl[gG]/i,
      /logout|sign out|keluar/i,
    ];
    const hasOperational = operationalHints.some((re) => re.test(afterLogin));
    if (!hasOperational) {
      fail('Post-login page does not show expected operational markers (dashboard / claims / logout)');
    }

    // Role chip soft-check (warranty_admin / admin / viewer)
    if (!/warranty admin|admin|viewer|branch/i.test(afterLogin)) {
      console.warn('WARN: role chip text not found in post-login body; continuing.');
    }

    // --- Claims list + open first claim (read-only) ---
    const claimsNav = page.getByRole('button', { name: /^Claims/i }).first();
    if ((await claimsNav.count()) > 0) {
      await claimsNav.click();
      await page.waitForTimeout(800);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    }

    const claimRow = page.locator('[class*="claim"], tr, [data-claim-id], a, button').filter({
      hasText: /\d{4}-\d{4}-SDLG-PFR|SDLG-PFR/,
    });
    const claimCount = await claimRow.count();
    if (claimCount === 0) {
      console.warn('WARN: no claim id pattern visible; skipping claim-detail step.');
    } else {
      // Click the first visible claim identifier
      const first = claimRow.first();
      await first.click({ timeout: 10000 }).catch(async () => {
        // Fallback: click parent row
        const parent = first.locator('xpath=ancestor::*[self::tr or contains(@class,"claim")][1]');
        if ((await parent.count()) > 0) await parent.first().click();
      });
      await page.waitForTimeout(1200);
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

      const detailText = (await page.locator('body').innerText()).trim();
      const onDetail =
        /claim detail|warranty assessment|warranty engine|serial|failure|customer|causing part/i.test(
          detailText
        ) || /\d{4}-\d{4}-SDLG-PFR/.test(detailText);
      if (!onDetail) {
        console.warn('WARN: claim detail surface not clearly detected after click.');
      } else {
        console.log('AUTH E2E: claim detail surface reached (read-only).');
      }

      // Soft-check warranty panel / export (non-fatal if missing)
      if (/Warranty Assessment|Warranty Engine|IN WARRANTY|OUT OF WARRANTY|ROUTE:/i.test(detailText)) {
        console.log('AUTH E2E: warranty assessment markers present.');
      } else {
        console.warn('WARN: warranty assessment panel not visible yet (may still be loading).');
      }
    }

    // Export button presence on claims surface
    const exportBtn = page.getByRole('button', { name: /Export/i }).first();
    if ((await exportBtn.count()) > 0) {
      console.log('AUTH E2E: Export affordance present.');
    }

    // --- Authenticated mobile regression ---
    const storageState = await page.context().storageState();
    const mobileContext = await page.context().browser().newContext({
      storageState,
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 1,
      isMobile: true,
    });
    const mobilePage = await mobileContext.newPage();
    try {
      const mobileResponse = await mobilePage.goto(baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      if (!mobileResponse || !mobileResponse.ok()) {
        fail(`Authenticated mobile page returned ${mobileResponse?.status() ?? 'no response'}`);
      }
      await mobilePage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

      const commonMobile = await mobilePage.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const bodyWidth = document.body.scrollWidth;
        const topbar = document.querySelector('.topbar');
        const pageEl = document.querySelector('.page');
        return {
          horizontalOverflow: bodyWidth > viewportWidth + 2,
          bodyWidth,
          viewportWidth,
          topbarBottom: topbar?.getBoundingClientRect().bottom ?? null,
          pageTop: pageEl?.getBoundingClientRect().top ?? null,
          loginVisible: !!document.querySelector('.login-screen'),
        };
      });
      if (commonMobile.horizontalOverflow) {
        fail(
          `Authenticated mobile horizontal overflow: body=${commonMobile.bodyWidth}px viewport=${commonMobile.viewportWidth}px`
        );
      }
      if (commonMobile.loginVisible) {
        fail('Authenticated mobile storage state was not accepted; login shell is still visible');
      }
      if (
        commonMobile.topbarBottom !== null &&
        commonMobile.pageTop !== null &&
        commonMobile.pageTop < commonMobile.topbarBottom - 2
      ) {
        fail(
          `Mobile page begins under sticky header: pageTop=${commonMobile.pageTop}, topbarBottom=${commonMobile.topbarBottom}`
        );
      }

      const mClaimsNav = mobilePage.getByRole('button', { name: /^Claims/i }).first();
      if ((await mClaimsNav.count()) > 0) {
        await mClaimsNav.click();
        await mobilePage.waitForTimeout(300);
      }

      const inputNav = mobilePage.getByRole('button', { name: 'SDLG Input', exact: true }).first();
      if ((await inputNav.count()) > 0) {
        await inputNav.click();
        await mobilePage.waitForTimeout(300);
        const inputResult = await mobilePage.evaluate(() => {
          const root = document.querySelector('.page[data-sdlg-input-helper]');
          if (!root) return { root: false, gridColumns: [], copyOverlaps: 0 };
          const grids = Array.from(
            root.querySelectorAll('[style*="grid-template-columns"], [style*="gridTemplateColumns"]')
          );
          const gridColumns = grids.map((el) => getComputedStyle(el).gridTemplateColumns);
          let copyOverlaps = 0;
          root.querySelectorAll('[data-sdlg-copy]').forEach((copy) => {
            const parent = copy.parentElement;
            const label = parent?.querySelector('label');
            if (!parent || !label) return;
            const a = label.getBoundingClientRect();
            const b = copy.getBoundingClientRect();
            const verticalOverlap = a.bottom > b.top && b.bottom > a.top;
            const horizontalOverlap = a.right > b.left && b.right > a.left;
            if (verticalOverlap && horizontalOverlap) copyOverlaps += 1;
          });
          return { root: true, gridColumns, copyOverlaps };
        });
        if (!inputResult.root) {
          console.warn('WARN: SDLG Input helper root missing after mobile nav.');
        } else {
          if (inputResult.gridColumns.some((columns) => columns.trim().split(/\s+/).length > 1)) {
            fail(`SDLG Input mobile grid did not collapse to one column: ${inputResult.gridColumns.join(' | ')}`);
          }
          if (inputResult.copyOverlaps > 0) {
            fail(`SDLG Input mobile Copy/label overlap detected in ${inputResult.copyOverlaps} field(s)`);
          }
        }
      } else {
        console.warn('WARN: SDLG Input nav button not found for this role.');
      }

      console.log('AUTH MOBILE PASS: responsive surfaces verified at 412x915.');
    } finally {
      await mobileContext.close();
    }

    // --- Logout ---
    await page.bringToFront();
    const logoutBtn = page.getByRole('button', { name: /Logout|Sign out|Keluar/i }).first();
    if ((await logoutBtn.count()) > 0) {
      await logoutBtn.click();
      await page.waitForTimeout(1500);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const afterLogout = (await page.locator('body').innerText()).trim();
      const backToLogin =
        (await page.locator('.login-screen').count()) > 0 ||
        /masuk ke dashboard|sign in|selamat datang kembali/i.test(afterLogout);
      if (!backToLogin) {
        console.warn('WARN: login shell not clearly restored after logout.');
      } else {
        console.log('AUTH E2E: logout returned to login shell.');
      }
    } else {
      console.warn('WARN: Logout control not found.');
    }

    if (pageErrors.length > 0) {
      fail(`Browser pageerror after login: ${pageErrors.join(' | ')}`);
    }

    console.log(`AUTH E2E PASS: ${baseUrl}`);
    console.log(
      'Journey covered: login, claims, claim-detail (soft), mobile, logout. Expand CRUD mutations only with isolated fixture data.'
    );
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  fail(error.message || String(error));
});
