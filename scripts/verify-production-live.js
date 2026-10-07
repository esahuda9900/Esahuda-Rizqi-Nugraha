/**
 * Live production verifier for the real Cloudflare production surface.
 *
 * Read-only by design:
 * - GETs the production HTML/assets
 * - optionally logs in with a dedicated E2E account when secrets exist
 * - never creates/edits/deletes claims
 * - writes only verification evidence under production-verify/
 *
 * The GitHub Actions workflow uploads these files as verification artifacts.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const BASE_URL = (process.env.BASE_URL || 'https://sdlg-warranty-backup.esahuda9900.workers.dev/').replace(/\/+$/, '/') ;
const OUTPUT_DIR = path.join(process.cwd(), 'production-verify');
const EMAIL = process.env.E2E_TEST_EMAIL || '';
const PASSWORD = process.env.E2E_TEST_PASSWORD || '';
const SOURCE_COMMIT = process.env.GITHUB_SHA || null;
const REPOSITORY = process.env.GITHUB_REPOSITORY || null;
const RUN_ID = process.env.GITHUB_RUN_ID || null;
const RUN_NUMBER = process.env.GITHUB_RUN_NUMBER || null;
const WORKFLOW = process.env.GITHUB_WORKFLOW || null;
const TARGET_CLAIM_ID = process.env.TARGET_CLAIM_ID || '0211-2026-SDLG-PFR';
const TARGET_WO = process.env.TARGET_WO || 'WO26043064';
const PRIME_CLAIM_ID = process.env.PRIME_CLAIM_ID || '0003-2026-SDLG-PFR';

const REQUIRED_POLICY_CODES = [
  'CLAIM_SUBMIT_TARGET_10D',
  'CLAIM_SUBMIT_MAX_90D',
  'PHYSICAL_CONCLUSION_30D',
  'SETTLEMENT_6M',
  'MANDATORY_MAINTENANCE_10BD',
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CLOUDFLARE_SCRIPT_NAME = process.env.CLOUDFLARE_SCRIPT_NAME || "sdlg-warranty-backup";
const EXPECTED_CLOUDFLARE_COMMIT = process.env.EXPECTED_CLOUDFLARE_COMMIT || null;
const BUILD_ONLY = String(process.env.BUILD_ONLY || "").toLowerCase() === "true";
const EXPECTED_NODE_MAJOR = "22";
const EXPECTED_PNPM_VERSION = "10.11.1";
const CLOUDFLARE_BUILD_WAIT_SECONDS = Number(process.env.CLOUDFLARE_BUILD_WAIT_SECONDS || 420);

function extractVersionMarker(html) {
  const matches = [...String(html || '').matchAll(/\bV\d+(?:\.\d+){1,3}\b/g)].map((m) => m[0]);
  return {
    first: matches[0] || null,
    last: matches[matches.length - 1] || null,
    all: [...new Set(matches)].slice(0, 25),
  };
}
function extractPolicyRuleCount(raw) {
  if (!raw || typeof raw !== 'object') return 0;
  if (Number.isFinite(raw?.meta?.rowCount)) return Number(raw.meta.rowCount);
  if (Array.isArray(raw?.data)) return raw.data.length;
  return 0;
}

function makeStringChecks(html, panelText) {
  return {
    fallbackTextFound: html.includes('Failure is within policy calendar'),
    placeholderTextFound: html.includes('5 t < T'),
    aaf0afaeFound: html.includes('aaf0afae'),
    parent55e7dc8fFound: html.includes('55e7dc8f'),
    panelFallbackTextFound: String(panelText || '').includes('Failure is within policy calendar'),
    panelFallbackPhraseFound: String(panelText || '').includes('Failure is within'),
  };
}

function cleanError(error) {
  if (!error) return null;
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null,
    stack: error?.stack || '',
  };
}
function nowIso() {
  return new Date().toISOString();
}

async function cloudflareGet(endpoint) {
  if (!CLOUDFLARE_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required for Cloudflare build verification.");
  }

  const response = await fetch(CLOUDFLARE_API_BASE + endpoint, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + CLOUDFLARE_TOKEN,
      Accept: "application/json",
      "User-Agent": "sdlg-warranty-live-verifier/2.0",
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok || json?.success === false) {
    const detail = Array.isArray(json?.errors) ? JSON.stringify(json.errors) : text;
    throw new Error("Cloudflare API GET failed (" + response.status + "): " + detail);
  }
  return json?.result ?? null;
}

function latestDeployment(deployments) {
  const list = Array.isArray(deployments?.deployments)
    ? deployments.deployments
    : Array.isArray(deployments)
      ? deployments
      : [];
  return list[0] || null;
}

function latestBuildFromResponse(response) {
  const map = response?.builds && typeof response.builds === "object" ? response.builds : {};
  return Object.values(map)
    .filter((entry) => entry && typeof entry === "object")
    .sort((a, b) => String(b.created_on || "").localeCompare(String(a.created_on || "")))[0] || null;
}

function pickProductionTrigger(triggers) {
  const list = Array.isArray(triggers)
    ? triggers
    : Array.isArray(triggers?.triggers)
      ? triggers.triggers
      : [];
  return (
    list.find((trigger) =>
      Array.isArray(trigger?.branch_includes) && trigger.branch_includes.includes("main")
    ) ||
    list.find((trigger) => /production/i.test(String(trigger?.trigger_name || ""))) ||
    list[0] ||
    null
  );
}

async function fetchActiveCloudflareBuild() {
  const deploymentsResult = await cloudflareGet(
    "/accounts/" + CLOUDFLARE_ACCOUNT_ID +
      "/workers/scripts/" + encodeURIComponent(CLOUDFLARE_SCRIPT_NAME) +
      "/deployments?per_page=100"
  );
  const deployment = latestDeployment(deploymentsResult);

  const scriptsResult = await cloudflareGet("/accounts/" + CLOUDFLARE_ACCOUNT_ID + "/workers/scripts");
  const scripts = Array.isArray(scriptsResult) ? scriptsResult : [];
  const worker = scripts.find((script) => String(script?.id || "") === CLOUDFLARE_SCRIPT_NAME);
  const workerTag = worker?.tag || null;
  if (!workerTag) throw new Error("Cloudflare Worker tag not found for " + CLOUDFLARE_SCRIPT_NAME + ".");
  const versionIds = [...new Set(
    (deployment?.versions || []).map((v) => v?.version_id).filter(Boolean)
  )];

  const triggerList = await cloudflareGet(
    "/accounts/" + CLOUDFLARE_ACCOUNT_ID +
      "/builds/workers/" + encodeURIComponent(workerTag) + "/triggers"
  );
  const trigger = pickProductionTrigger(triggerList);

  let environmentVariables = null;
  if (trigger?.trigger_uuid) {
    environmentVariables = await cloudflareGet(
      "/accounts/" + CLOUDFLARE_ACCOUNT_ID +
        "/builds/triggers/" + encodeURIComponent(trigger.trigger_uuid) +
        "/environment_variables"
    );
  }

  if (!versionIds.length) {
    return { deployment, versionIds: [], build: null, trigger, environmentVariables, workerTag };
  }

  const buildsResult = await cloudflareGet(
    "/accounts/" + CLOUDFLARE_ACCOUNT_ID +
      "/builds/workers/" + encodeURIComponent(workerTag) + "/builds?per_page=50"
  );
  const buildEntries = Array.isArray(buildsResult)
    ? buildsResult
    : Array.isArray(buildsResult?.builds)
      ? buildsResult.builds
      : Object.values(buildsResult?.builds || {});
  const successfulBuilds = buildEntries
    .filter((entry) => {
      const outcome = entry?.build_outcome || entry?.status || null;
      return outcome === null || outcome === "success";
    })
    .sort((a, b) =>
      String(b?.created_on || b?.created_at || "").localeCompare(String(a?.created_on || a?.created_at || ""))
    );
  const expectedCommit = EXPECTED_CLOUDFLARE_COMMIT;
  const build = (expectedCommit
    ? successfulBuilds.find((entry) => buildCommitOf(entry) === expectedCommit)
    : null) || successfulBuilds[0] || null;

  return { deployment, versionIds, build, trigger, environmentVariables, workerTag };
}

function buildCommitOf(entry) {
  return entry?.build_trigger_metadata?.commit_hash || entry?.commit_hash || null;
}

async function waitForActiveBuild() {
  const deadline = Date.now() + Math.max(1, CLOUDFLARE_BUILD_WAIT_SECONDS) * 1000;
  let last = null;
  let lastError = null;

  while (Date.now() <= deadline) {
    try {
      last = await fetchActiveCloudflareBuild();
      const commit = buildCommitOf(last?.build);
      const outcome = last?.build?.build_outcome || last?.build?.status || null;
      const isSuccessful = outcome === null || outcome === "success";

      if (commit && isSuccessful && (!EXPECTED_CLOUDFLARE_COMMIT || commit === EXPECTED_CLOUDFLARE_COMMIT)) {
        return last;
      }
      lastError = null;
    } catch (error) {
      lastError = error;
    }

    const remaining = Math.max(0, deadline - Date.now());
    if (remaining === 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(7000, remaining)));

  }

  const lastCommit = buildCommitOf(last?.build);
  const timeoutMessage =
    "Cloudflare active build did not reach the expected commit before timeout. " +
    "expected=" + (EXPECTED_CLOUDFLARE_COMMIT || "latest") +
    " actual=" + (lastCommit || "none");
  if (lastError) {
    throw new Error(timeoutMessage + " lastError=" + (lastError?.message || String(lastError)));
  }
  throw new Error(timeoutMessage);
}

function gitHasCommit(commit) {
  const { execFileSync } = require("node:child_process");
  try {
    execFileSync("git", ["cat-file", "-e", commit + "^{commit}"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureCommitAvailable(commit) {
  const { execFileSync } = require("node:child_process");
  if (gitHasCommit(commit)) return;
  execFileSync("git", ["fetch", "--no-tags", "origin", commit], { stdio: "inherit" });
  if (!gitHasCommit(commit)) {
    throw new Error("Exact Cloudflare build commit is not available locally: " + commit);
  }
}

function reproduceCloudflareBuild(commit) {
  const { execFileSync } = require("node:child_process");
  const fsLocal = require("node:fs");
  const pathLocal = require("node:path");
  const worktree = pathLocal.join("/tmp", "sdlg-cloudflare-live-verify-" + process.pid);

  try {
    execFileSync("git", ["worktree", "remove", "--force", worktree], { stdio: "ignore" });
  } catch (_) {}

  ensureCommitAvailable(commit);
  execFileSync("git", ["worktree", "add", "--detach", worktree, commit], { stdio: "inherit" });

  const env = {
    ...process.env,
    NODE_VERSION: EXPECTED_NODE_MAJOR,
    PNPM_VERSION: EXPECTED_PNPM_VERSION,
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    CI: "true",
  };

  try {

    const nodeVersion = process.version;
    const pnpmVersion = execFileSync("pnpm", ["--version"], {
      cwd: worktree,
      encoding: "utf8",
      env,
    }).trim();
    const npmVersion = execFileSync("npm", ["--version"], {
      cwd: worktree,
      encoding: "utf8",
      env,
    }).trim();

    execFileSync("pnpm", ["install", "--no-frozen-lockfile"], {
      cwd: worktree,
      stdio: "inherit",
      env,
    });
    execFileSync("npm", ["run", "build"], {
      cwd: worktree,
      stdio: "inherit",
      env,
    });

    const indexPath = pathLocal.join(worktree, "index.html");
    const output = fsLocal.readFileSync(indexPath);
    return {
      sha256: sha256(output),
      byteLength: output.length,
      nodeVersion,
      npmVersion,
      pnpmVersion,
    };
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", worktree], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
    } catch (_) {}
  }
}

async function verifyCloudflareBuildAgainstLive(liveBuffer) {
  const startedAt = nowIso();
  try {
    const active = await waitForActiveBuild();
    const build = active.build || {};
    const trigger = active.trigger || {};
    const variables = active.environmentVariables || {};

    const buildCommit = buildCommitOf(build);
    if (!buildCommit) throw new Error("Cloudflare active deployment has no build commit SHA.");

    const variableValues = {
      NODE_VERSION: variables?.NODE_VERSION?.value ?? null,
      PNPM_VERSION: variables?.PNPM_VERSION?.value ?? null,
    };

    const configurationMatches =
      variableValues.NODE_VERSION === EXPECTED_NODE_MAJOR &&
      variableValues.PNPM_VERSION === EXPECTED_PNPM_VERSION;

    const reproduction = reproduceCloudflareBuild(buildCommit);
    const deadline = Date.now() + Math.max(1, CLOUDFLARE_BUILD_WAIT_SECONDS) * 1000;
    const attempts = [];

    let currentBuffer = liveBuffer;
    let currentSha = sha256(currentBuffer);
    let currentStatus = null;

    while (Date.now() <= deadline) {
      attempts.push({
        at: nowIso(),
        sha256: currentSha,
        byteLength: currentBuffer.length,
        httpStatus: currentStatus,
      });

      if (currentSha === reproduction.sha256) break;

      const remaining = Math.max(0, deadline - Date.now());
      if (remaining === 0) break;

      await new Promise((resolve) => setTimeout(resolve, Math.min(7000, remaining)));

      const response = await fetch(BASE_URL, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "sdlg-warranty-live-verifier/3.0",
        },
        redirect: "follow",
      });
      currentStatus = response.status;
      currentBuffer = Buffer.from(await response.arrayBuffer());
      if (!response.ok) continue;
      currentSha = sha256(currentBuffer);
    }

    const matched = currentSha === reproduction.sha256;

    return {
      attempted: true,
      available: true,
      startedAt,
      completedAt: nowIso(),
      expectedCommit: EXPECTED_CLOUDFLARE_COMMIT,
      cloudflareDeploymentId: active.deployment?.id || null,
      cloudflareVersionIds: active.versionIds || [],
      cloudflareBuildUuid: build?.build_uuid || null,
      cloudflareBuildOutcome: build?.build_outcome || build?.status || null,
      cloudflareBuildCommitSha: buildCommit,
      cloudflareTriggerUuid: trigger?.trigger_uuid || build?.trigger?.trigger_uuid || null,
      buildCommand: build?.build_trigger_metadata?.build_command || build?.trigger?.build_command || "pnpm install --no-frozen-lockfile && npm run build",
      deployCommand: build?.build_trigger_metadata?.deploy_command || build?.trigger?.deploy_command || "npx wrangler deploy",
      environment: {
        required: {
          NODE_VERSION: EXPECTED_NODE_MAJOR,
          PNPM_VERSION: EXPECTED_PNPM_VERSION,
        },
        configured: variableValues,
        matches: configurationMatches,
      },
      reproduction,
      liveSha256: currentSha,
      liveByteLength: currentBuffer.length,
      liveMatchesBuildOutput: matched,
      livePollAttempts: attempts,
    };
  } catch (error) {
    const safeError = cleanError(error);
    console.error("[Cloudflare verifier] build verification failed:", JSON.stringify(safeError));
    return {
      attempted: true,
      available: false,
      startedAt,
      completedAt: nowIso(),
      expectedCommit: EXPECTED_CLOUDFLARE_COMMIT,
      environment: {
        required: {
          NODE_VERSION: EXPECTED_NODE_MAJOR,
          PNPM_VERSION: EXPECTED_PNPM_VERSION,
        },
        configured: {
          NODE_VERSION: null,
          PNPM_VERSION: null,
        },
        matches: false,
      },
      liveSha256: sha256(liveBuffer),
      liveByteLength: liveBuffer.length,
      liveMatchesBuildOutput: false,
      error: cleanError(error),
    };
  }
}

function classifyMismatch(evidence) {
  if (!evidence.liveReachable) return 'UNVERIFIED_PRODUCTION_UNREACHABLE';
  if (evidence.liveMatchesBuildOutput === false) return 'CLOUDFLARE_LIVE_BUILD_OUTPUT_MISMATCH';
  if (evidence.cloudflareBuildEnvironment?.available === false) return 'UNVERIFIED_CLOUDFLARE_BUILD_OUTPUT';

  if (!evidence.claimDetail?.reached || evidence.claimDetail?.targetClaimId !== TARGET_CLAIM_ID) {
    return 'UNVERIFIED_TARGET_CLAIM_NOT_REACHED';
  }

  if (evidence.carryOverDetected === true) {
    return 'UI_POLICY_SCOPE_CARRYOVER_CONFIRMED';
  }

  if (
    evidence.dbUiConsistency?.claimFound &&
    evidence.dbUiConsistency?.targetUiMatchesDbScope === false
  ) {
    return 'UI_POLICY_SCOPE_MISMATCH';
  }

  if (
    evidence.dbUiConsistency?.claimFound &&
    evidence.dbUiConsistency?.resolverUsesComplaintPhrase &&
    !evidence.dbUiConsistency?.panelShowsComplaintPhrase &&
    evidence.dbUiConsistency?.panelShowsSuspiciousSixTonScope
  ) {
    return 'UI_POLICY_SCOPE_MISMATCH';
  }

  return 'NO_CLOUDFLARE_BUILD_ARTIFACT_MISMATCH';
}

async function styleSnapshot(page) {
  return page.evaluate(() => {
    const read = (selector, fields = {}) => {
      const el = document.querySelector(selector);
      if (!el) return { found: false, selector };
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const out = {
        found: true,
        selector,
        padding: cs.padding,
        borderRadius: cs.borderRadius,
        fontSize: cs.fontSize,
        height: cs.height,
        rectHeight: rect.height,
        rectWidth: rect.width,
        display: cs.display,
      };
      for (const [key, property] of Object.entries(fields)) out[key] = cs[property];
      return out;
    };

    return {
      page: read('.page'),
      cardPad: read('.card-pad'),
      card: read('.card'),
      topbar: read('.topbar'),
      body: read('body'),
      root: read('#root'),
    };
  });
}

async function capturePanel(page) {
  let clickedPolicyToggle = false;
  let panelInnerText = '';
  let panelLocator = null;

  const toggleCandidates = [
    page.getByRole('button', { name: /Policy Decision/i }).first(),
    page.locator('button').filter({ hasText: /Policy Decision/i }).first(),
  ];

  for (const candidate of toggleCandidates) {
    try {
      if (await candidate.count() && await candidate.isVisible()) {
        const expanded = await candidate.getAttribute('aria-expanded');
        if (expanded === 'false' || expanded === null) {
          await candidate.click({ timeout: 5000 });
          clickedPolicyToggle = true;
          await page.waitForTimeout(350);
        }
        break;
      }
    } catch (_) {}
  }

  const locatorCandidates = [
    page.locator('.card').filter({ hasText: /Policy Decision/i }).first(),
    page.locator('.card-pad').filter({ hasText: /Policy Decision/i }).first(),
    page.locator('[role="dialog"]').filter({ hasText: /Policy Decision/i }).first(),
    page.getByText(/Policy Decision/i).first(),
  ];

  for (const candidate of locatorCandidates) {
    try {
      if (await candidate.count() && await candidate.isVisible()) {
        panelLocator = candidate;
        panelInnerText = (await candidate.innerText()).trim();
        break;
      }
    } catch (_) {}
  }

  let screenshot = null;
  if (panelLocator) {
    const filename = 'policy-decision-panel.png';
    await panelLocator.screenshot({
      path: path.join(OUTPUT_DIR, filename),
      animations: 'disabled',
      caret: 'hide',
    });
    screenshot = filename;
  }

  return {
    clickedPolicyToggle,
    found: Boolean(panelLocator),
    panelInnerText,
    screenshot,
  };
}

async function navigateToClaimDetail(page) {
  const result = {
    attempted: true,
    navClicked: false,
    searchUsed: false,
    exactClaimMatched: false,
    exactWoMatched: false,
    rowClicked: false,
    reached: false,
    method: null,
    visibleTextSnippet: '',
    error: null,
    targetClaimId: TARGET_CLAIM_ID,
    targetWo: TARGET_WO,
  };

  try {
    const claimsButtonCandidates = [
      page.getByRole('button', { name: /^Claims/i }).first(),
      page.locator('button').filter({ hasText: /^Claims/i }).first(),
      page.getByText(/^Claims$/i).first(),
    ];

    for (const candidate of claimsButtonCandidates) {
      try {
        if (await candidate.count() && await candidate.isVisible()) {
          await candidate.click({ timeout: 6000 });
          result.navClicked = true;
          result.method = 'Claims navigation';
          await page.waitForTimeout(600);
          break;
        }
      } catch (_) {}
    }

    // Prefer exact claim text. This avoids silently testing a different claim.
    const exactClaim = page.getByText(TARGET_CLAIM_ID, { exact: true }).first();
    if (await exactClaim.count() && await exactClaim.isVisible()) {
      result.exactClaimMatched = true;
      await exactClaim.click({ timeout: 8000 });
      result.rowClicked = true;
      result.method = (result.method ? result.method + ' + ' : '') + 'exact Claim ID';
      await page.waitForTimeout(900);
    } else {
      // Search inputs: use the first visible search-like input in the Claims surface.
      const searchInputs = page.locator(
        '.claims-searchbar input, input[placeholder*="Search" i], input[placeholder*="search" i], input[placeholder*="claim" i], input[aria-label*="search" i]'
      );
      const searchCount = await searchInputs.count();
      for (let i = 0; i < searchCount; i += 1) {
        const input = searchInputs.nth(i);
        try {
          if (await input.isVisible()) {
            await input.fill(TARGET_CLAIM_ID);
            await page.waitForTimeout(700);
            result.searchUsed = true;
            break;
          }
        } catch (_) {}
      }

      const filteredExactClaim = page.getByText(TARGET_CLAIM_ID, { exact: true }).first();
      if (await filteredExactClaim.count() && await filteredExactClaim.isVisible()) {
        result.exactClaimMatched = true;
        await filteredExactClaim.click({ timeout: 8000 });
        result.rowClicked = true;
        result.method = (result.method ? result.method + ' + ' : '') + 'exact Claim ID after search';
        await page.waitForTimeout(900);
      } else {
        // As a second exact target, try the WO directly.
        const exactWo = page.getByText(TARGET_WO, { exact: true }).first();
        if (await exactWo.count() && await exactWo.isVisible()) {
          result.exactWoMatched = true;
          await exactWo.click({ timeout: 8000 });
          result.rowClicked = true;
          result.method = (result.method ? result.method + ' + ' : '') + 'exact WO';
          await page.waitForTimeout(900);
        }
      }
    }

    const bodyText = (await page.locator('body').innerText()).trim();
    result.visibleTextSnippet = bodyText.slice(0, 7000);
    result.exactClaimMatched = result.exactClaimMatched || bodyText.includes(TARGET_CLAIM_ID);
    result.reached =
      result.exactClaimMatched &&
      (/Claim Detail/i.test(bodyText) ||
       /Policy Decision/i.test(bodyText) ||
       Boolean(await page.locator('.claim-detail,.claim-detail-panel,[data-claim-detail]').count()));

    if (!result.exactClaimMatched) {
      result.error = 'Target complaint claim was not located; verifier refuses to substitute another claim.';
    } else if (!result.reached) {
      result.error = 'Target complaint claim was located, but Claim Detail could not be proven.';
    }
  } catch (error) {
    result.error = cleanError(error);
  }

  return result;
}


async function navigateToClaimsList(page) {
  const candidates = [
    page.getByRole('button', { name: /^Claims/i }).first(),
    page.locator('button').filter({ hasText: /^Claims/i }).first(),
    page.getByText(/^Claims$/i).first(),
  ];

  for (const candidate of candidates) {
    try {
      if (await candidate.count() && await candidate.isVisible()) {
        await candidate.click({ timeout: 6000 });
        await page.waitForTimeout(700);
        const bodyText = (await page.locator('body').innerText()).trim();
        if (/Claims/i.test(bodyText)) return true;
      }
    } catch (_) {}
  }
  return false;
}

async function navigateExactClaim(page, claimId) {
  const result = {
    claimId,
    found: false,
    clicked: false,
    reached: false,
    method: null,
    error: null,
    bodyText: '',
  };

  try {
    const exact = page.getByText(claimId, { exact: true }).first();
    if (await exact.count() && await exact.isVisible()) {
      result.found = true;
      await exact.click({ timeout: 8000 });
      result.clicked = true;
      result.method = 'exact Claim ID';
    } else {
      const searchInputs = page.locator(
        '.claims-searchbar input, input[placeholder*="Search" i], input[placeholder*="search" i], input[placeholder*="claim" i], input[aria-label*="search" i]'
      );
      for (let i = 0; i < await searchInputs.count(); i += 1) {
        const input = searchInputs.nth(i);
        if (await input.isVisible().catch(() => false)) {
          await input.fill(claimId);
          await page.waitForTimeout(700);
          break;
        }
      }
      const filtered = page.getByText(claimId, { exact: true }).first();
      if (await filtered.count() && await filtered.isVisible()) {
        result.found = true;
        await filtered.click({ timeout: 8000 });
        result.clicked = true;
        result.method = 'exact Claim ID after search';
      }
    }

    await page.waitForTimeout(900);
    result.bodyText = (await page.locator('body').innerText()).trim();
    result.reached =
      result.bodyText.includes(claimId) &&
      (/Claim Detail/i.test(result.bodyText) ||
       /Policy Decision/i.test(result.bodyText) ||
       Boolean(await page.locator('.claim-detail,.claim-detail-panel,[data-sdlg-claim-detail]').count()));

    if (!result.found) result.error = 'Exact claim was not found; no substitution allowed.';
    else if (!result.reached) result.error = 'Exact claim opened but Claim Detail could not be proven.';
  } catch (error) {
    result.error = cleanError(error);
  }

  return result;
}

async function returnToClaims(page) {
  const candidates = [
    page.getByRole('button', { name: /Kembali/i }).first(),
    page.locator('button').filter({ hasText: /Kembali/i }).first(),
    page.locator('.claim-detail-page button').first(),
  ];

  for (const candidate of candidates) {
    try {
      if (await candidate.count() && await candidate.isVisible()) {
        await candidate.click({ timeout: 5000 });
        await page.waitForTimeout(700);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

async function capturePolicyScope(page, fileName) {
  const panel = page.locator('.card').filter({ hasText: /Policy Decision/i }).first();
  if (!(await panel.count()) || !(await panel.isVisible().catch(() => false))) {
    return {
      found: false,
      panelInnerText: '',
      renderedScope: null,
      screenshot: null,
      error: 'Policy Decision card not visible.',
    };
  }

  const panelInnerText = (await panel.innerText()).trim();
  const scopeTexts = await panel.locator('span').allTextContents();
  const renderedScope =
    scopeTexts.map((v) => String(v).trim()).find((v) =>
      /(?:^|\s)\d+(?:\.\d+)?\s*t\s*(?:<=|<|≥|>)\s*T\s*(?:<=|<|≥|>)\s*\d+(?:\.\d+)?\s*t/i.test(v)
    ) ||
    scopeTexts.map((v) => String(v).trim()).find((v) =>
      /\bT\s*(?:<=|<|≥|>)\s*\d+(?:\.\d+)?\s*t\b/i.test(v) ||
      /\b\d+(?:\.\d+)?\s*t\s*(?:<=|<|≥|>)\s*T\b/i.test(v)
    ) ||
    null;

  await panel.screenshot({
    path: path.join(OUTPUT_DIR, fileName),
    animations: 'disabled',
    caret: 'hide',
  });

  return {
    found: true,
    panelInnerText,
    renderedScope,
    screenshot: fileName,
  };
}

async function captureReactPolicyDiagnostics(page) {
  return page.evaluate(() => {
    const safe = (value, depth = 0, seen = new WeakSet()) => {
      if (depth > 5) return '[MAX_DEPTH]';
      if (value == null) return value;
      if (typeof value !== 'object') return typeof value === 'function' ? '[Function]' : value;
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.slice(0, 20).map((v) => safe(v, depth + 1, seen));
      const out = {};
      for (const [k, v] of Object.entries(value).slice(0, 60)) out[k] = safe(v, depth + 1, seen);
      return out;
    };

    const panel = [...document.querySelectorAll('.card')].find((el) => /Policy Decision/i.test(el.innerText || ''));
    if (!panel) return { found: false, reason: 'Policy Decision DOM node not found.' };

    const fiberKey = Object.keys(panel).find((key) => key.indexOf('__reactFiber') === 0);
    const fiber = fiberKey ? panel[fiberKey] : null;
    if (!fiber) return { found: false, reason: 'React fiber not exposed on Policy Decision DOM node.' };

    let current = fiber;
    while (current) {
      const type = current.elementType || current.type;
      const name = type?.displayName || type?.name || '';
      if (name === 'PolicyDecisionCard') {
        const props = current.memoizedProps || {};
        const hooks = [];
        let hook = current.memoizedState;
        let index = 0;
        while (hook && index < 20) {
          hooks.push({ index, memoizedState: safe(hook.memoizedState) });
          hook = hook.next;
          index += 1;
        }

        const claim = props.claim || {};
        return {
          found: true,
          componentName: name,
          props: {
            claim: {
              claim_id: claim.claim_id ?? null,
              dealer_wo_so: claim.dealer_wo_so ?? null,
              model: claim.model ?? null,
              serial_no: claim.serial_no ?? null,
              policy_model_scope: claim.policy_model_scope ?? null,
              policy_component_category: claim.policy_component_category ?? null,
              fault_description: claim.fault_description ?? null
            }
          },
          hooks
        };
      }
      current = current.return;
    }

    return { found: false, reason: 'PolicyDecisionCard fiber not found in parent chain.' };
  });
}

async function getPolicyQuery(page) {
  return page.evaluate(async () => {
    const q = window.SDLGPolicyRulesQuery;
    if (typeof q !== 'function') return { data: null, error: 'window.SDLGPolicyRulesQuery is not a function' };

    try {
      // Intentionally call with NO arguments: this is the exact production
      // probe needed to determine whether the bridge is available in the real browser.
      return await q();
    } catch (error) {
      return {
        data: null,
        error: {
          name: error?.name || 'Error',
          message: error?.message || String(error),
          stack: error?.stack || '',
        },
      };
    }
  });
}

async function getPolicyQueryDiagnostic(page) {
  return page.evaluate(async ({ ruleCodes, targetClaimId }) => {
    const q = window.SDLGPolicyRulesQuery;
    const client = window.sdlgSupabase;
    const result = {
      query: null,
      allRules: null,
      claimResolver: null,
      ruleTextMatches: [],
      error: null,
    };

    if (typeof q !== 'function') {
      result.error = 'window.SDLGPolicyRulesQuery is not a function';
      return result;
    }
    if (!client) {
      result.error = 'window.sdlgSupabase missing';
      return result;
    }

    try {
      result.query = await q(
        client,
        'rule_code,target_days,threshold_days,deadline_days,calculation,rule_text',
        ruleCodes
      );

      // Full policy-table evidence through the same authenticated runtime bridge.
      // Empty ruleCodes deliberately requests all 40 rows so a DB-originated
      // phrase cannot hide outside the small SLA subset.
      result.allRules = await q(
        client,
        'rule_code,section,topic,rule_type,applies_to,rule_text,calculation',
        []
      );

      const rows = Array.isArray(result.allRules?.data) ? result.allRules.data : [];
      result.ruleTextMatches = rows.filter((row) =>
        /Failure is within policy calendar|B\/L maximum|B\/L|ceiling/i.test(String(row?.rule_text || ''))
      );

      const resolved = await client.rpc('sdlg_warranty_resolve_claim', {
        p_claim_id: targetClaimId,
      });
      result.claimResolver = resolved && resolved.error
        ? {
            data: null,
            error: {
              message: resolved.error.message,
              code: resolved.error.code,
              details: resolved.error.details,
              hint: resolved.error.hint,
            },
          }
        : resolved?.data ?? null;
    } catch (error) {
      result.error = {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        stack: error?.stack || '',
      };
    }

    return result;
  }, { ruleCodes: REQUIRED_POLICY_CODES, targetClaimId: TARGET_CLAIM_ID });
}

async function main() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = {
    timestamp: nowIso(),
    url: BASE_URL,
    github: {
      repository: REPOSITORY,
      sourceCommit: SOURCE_COMMIT,
      runId: RUN_ID,
      runNumber: RUN_NUMBER,
      workflow: WORKFLOW,
    },
    liveReachable: false,
    httpStatus: null,
    responseHeaders: {},
    documentTitle: null,
    versionMarker: null,
    indexHtmlSha256: null,
    indexHtmlByteLength: null,
    repositoryIndexHtmlSha256: null,
    repositoryIndexHtmlByteLength: null,
    liveMatchesRepositoryIndex: null,
    diff: { notPerformed: true, reason: 'Live HTML is verified only against the exact Cloudflare build reproduction; main/index.html is not used as a release artifact comparator.' },
    buildOnly: BUILD_ONLY,
    liveMatchesBuildOutput: false,
    cloudflareBuildEnvironment: { available: false, matches: false, required: { NODE_VERSION: EXPECTED_NODE_MAJOR, PNPM_VERSION: EXPECTED_PNPM_VERSION } },
    buildVerification: null,
    stringChecks: {
      fallbackTextFound: false,
      placeholderTextFound: false,
      aaf0afaeFound: false,
      parent55e7dc8fFound: false,
      panelFallbackTextFound: false,
      panelFallbackPhraseFound: false,
    },
    fallbackTextFound: false,
    targetClaimId: TARGET_CLAIM_ID,
    targetWorkOrder: TARGET_WO,
    verifierContract: {
      complaintClaim: '0211-2026-SDLG-PFR',
      complaintWorkOrder: 'WO26043064',
      databaseExpectedWorkOrderNote: 'Verifier records both values because current DB linkage may differ from the reported WO.'
    },
    targetClaimDb: null,
    policyRuleTextMatches: [],
    policyAllRules: null,
    policyQueryRaw: null,
    policyQueryDiagnostic: null,
    policyRulesCount: 0,
    panelInnerText: '',
    prime: {
      claimId: PRIME_CLAIM_ID,
      navigation: null,
      policy: { found: false, renderedScope: null, panelInnerText: '', screenshot: null, error: null },
      react: null,
    },
    target: {
      claimId: TARGET_CLAIM_ID,
      navigation: null,
      policy: { found: false, renderedScope: null, panelInnerText: '', screenshot: null, error: null },
      settledPolicy: null,
      react: null,
    },
    carryOverDetected: null,
    carryOverReason: null,
    deployTrigger: 'Cloudflare Workers Builds (GitHub push integration)',
    deployCommit: null,
    deployCommitMatchType: null,
    liveSha: null,
    repoMainSha: null,
    cfCacheStatus: null,
    cacheAge: null,
    dbUiConsistency: {
      claimFound: false,
      databaseDealerWo: null,
      expectedDealerWo: TARGET_WO,
      dealerWoMatches: null,
      databaseModel: null,
      databaseProductFamily: null,
      databaseModelScope: null,
      databaseComponentCategory: null,
      resolverReasonOccurrences: 0,
      resolverUsesComplaintPhrase: false,
      panelShowsComplaintPhrase: false,
      panelShowsExpectedDbModelScope: null,
      panelShowsSuspiciousSixTonScope: false,
      primeUiScope: null,
      targetUiScope: null,
      targetSettledUiScope: null,
      targetUiMatchesDbScope: null,
      primeUiMatchesDbScope: null,
    },
    computedStyles: {},
    authSucceeded: false,
    auth: {
      credentialsConfigured: Boolean(EMAIL && PASSWORD),
      attempted: false,
      succeeded: false,
      reason: EMAIL && PASSWORD ? null : 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured; anonymous verification only.',
    },
    claimDetail: {
      attempted: false,
      navClicked: false,
      rowClicked: false,
      reached: false,
      method: null,
      visibleTextSnippet: '',
      error: null,
    },
    screenshots: [],
    pageErrors: [],
    consoleErrors: [],
    browserRuntime: {},
    panel: {
      found: false,
      clickedPolicyToggle: false,
      screenshot: null,
    },
    classification: null,
    fatalError: null,
  };

  let browser = null;

  try {
    if (BUILD_ONLY) {
      const deadline = Date.now() + Math.max(1, CLOUDFLARE_BUILD_WAIT_SECONDS) * 1000;
      let response = null;
      let bodyBytes = Buffer.alloc(0);
      let lastError = null;

      while (Date.now() <= deadline) {
        try {
          response = await fetch(BASE_URL, {
            method: "GET",
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "User-Agent": "sdlg-warranty-live-verifier-build-only/3.0",
            },
            redirect: "follow",
          });
          bodyBytes = Buffer.from(await response.arrayBuffer());
          if (response.ok) {
            lastError = null;
            break;
          }
          lastError = new Error("HTTP " + response.status);
        } catch (error) {
          response = null;
          bodyBytes = Buffer.alloc(0);
          lastError = error;
        }

        const remaining = Math.max(0, deadline - Date.now());
        if (remaining === 0) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(5000, remaining)));
      }

      if (!response || !response.ok) {
        throw new Error(
          "Production HTML did not become reachable within the configured wait window. " +
          (lastError?.message || "unknown error")
        );
      }

      report.liveReachable = true;
      report.httpStatus = response.status;
      report.responseHeaders = Object.fromEntries(response.headers.entries());

      report.indexHtmlSha256 = sha256(bodyBytes);
      report.indexHtmlByteLength = bodyBytes.length;
      report.liveSha = report.indexHtmlSha256;
      report.cfCacheStatus = report.responseHeaders["cf-cache-status"] || null;
      report.cacheAge = report.responseHeaders.age || null;

      report.buildVerification = await verifyCloudflareBuildAgainstLive(bodyBytes);
      report.liveMatchesBuildOutput = report.buildVerification.liveMatchesBuildOutput;
      report.cloudflareBuildEnvironment = {
        ...(report.buildVerification.environment || {}),
        available: report.buildVerification.available === true,
      };
      report.deployCommit = report.buildVerification.cloudflareBuildCommitSha || null;
      if (report.buildVerification.liveSha256) {
        report.liveSha = report.buildVerification.liveSha256;
        report.indexHtmlSha256 = report.buildVerification.liveSha256;
        report.indexHtmlByteLength = report.buildVerification.liveByteLength || report.indexHtmlByteLength;
      }

      const liveHtml = bodyBytes.toString("utf8");
      report.versionMarker = extractVersionMarker(liveHtml);
      report.stringChecks = makeStringChecks(liveHtml, "");
      report.fallbackTextFound = report.stringChecks.fallbackTextFound;
      report.classification = classifyMismatch(report);

      fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
      return;
    }

    browser = await chromium.launch({
      headless: true,
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      locale: 'en-US',
    });
    const page = await context.newPage();

    page.on('pageerror', (error) => {
      report.pageErrors.push({ message: error.message, stack: error.stack || '' });
    });
    page.on('console', (message) => {
      if (message.type() === 'error') report.consoleErrors.push(message.text());
    });

    const response = await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    if (!response) throw new Error('Production navigation returned no response.');

    report.liveReachable = response.ok();
    report.httpStatus = response.status();
    report.responseHeaders = Object.fromEntries(Object.entries(await response.allHeaders()));

    const bodyBytes = await response.body();
    report.indexHtmlSha256 = sha256(bodyBytes);
    report.indexHtmlByteLength = bodyBytes.length;
    report.liveSha = report.indexHtmlSha256;
    report.cfCacheStatus = report.responseHeaders['cf-cache-status'] || null;
    report.cacheAge = report.responseHeaders.age || null;

    report.buildVerification = await verifyCloudflareBuildAgainstLive(bodyBytes);
    report.liveMatchesBuildOutput = report.buildVerification.liveMatchesBuildOutput;
    report.cloudflareBuildEnvironment = {
      ...(report.buildVerification.environment || {}),
      available: report.buildVerification.available === true,
    };
    report.deployCommit = report.buildVerification.cloudflareBuildCommitSha || null;

    const liveHtml = bodyBytes.toString('utf8');
    report.documentTitle = await page.title();
    report.versionMarker = extractVersionMarker(liveHtml);

    report.stringChecks = makeStringChecks(liveHtml, '');
    report.fallbackTextFound = report.stringChecks.fallbackTextFound;

    report.screenshots.push('full-page-anonymous.png');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'full-page-anonymous.png'),
      fullPage: true,
      animations: 'disabled',
    });

    report.browserRuntime = await page.evaluate(() => ({
      react: Boolean(window.React),
      reactVersion: window.React?.version || null,
      reactDom: Boolean(window.ReactDOM),
      policyBridge: typeof window.SDLGPolicyRulesQuery === 'function',
      supabaseClient: Boolean(window.sdlgSupabase),
      href: location.href,
      pathname: location.pathname,
    }));

    if (!EMAIL || !PASSWORD) {
      report.auth.reason = 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured; anonymous verification completed.';
      report.classification = classifyMismatch(report);
      fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
      return;
    }

    report.auth.attempted = true;

    const loginScreen = page.locator('.login-screen').first();
    const scope = (await loginScreen.count()) > 0 ? loginScreen : page.locator('body');

    const emailInput = scope
      .locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[type="text"]')
      .first();
    const passwordInput = scope.locator('input[type="password"]').first();
    const submitButton = scope
      .locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Masuk")')
      .first();

    if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
      report.auth.reason = 'Login form inputs not found.';
      report.classification = classifyMismatch(report);
      fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
      return;
    }

    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);

    if ((await submitButton.count()) > 0) await submitButton.click();
    else await passwordInput.press('Enter');

    try {
      await loginScreen.waitFor({ state: 'hidden', timeout: 20000 });
    } catch (_) {
      await page.waitForTimeout(2000);
    }

    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    const afterLogin = (await page.locator('body').innerText()).trim();
    const stillLoginVisible =
      (await page.locator('.login-screen').count()) > 0 &&
      await page.locator('.login-screen').first().isVisible().catch(() => false);

    report.auth.succeeded = !stillLoginVisible && /dashboard|claim|warranty|command center|SDLG/i.test(afterLogin);
    report.authSucceeded = report.auth.succeeded;

    if (!report.auth.succeeded) {
      report.auth.reason = 'Credentials were supplied, but the production UI did not prove a successful authenticated shell.';
      report.classification = classifyMismatch(report);
      fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
      return;
    }

    report.auth.reason = 'Authenticated UI shell reached successfully.';
    report.browserRuntime = await page.evaluate(() => ({
      react: Boolean(window.React),
      reactVersion: window.React?.version || null,
      reactDom: Boolean(window.ReactDOM),
      policyBridge: typeof window.SDLGPolicyRulesQuery === 'function',
      supabaseClient: Boolean(window.sdlgSupabase),
      href: location.href,
      pathname: location.pathname,
    }));

    report.screenshots.push('full-page-authenticated.png');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'full-page-authenticated.png'),
      fullPage: true,
      animations: 'disabled',
    });

    report.computedStyles = await styleSnapshot(page);

    // PRIORITY 1: same browser page, PRIME -> TARGET, no reload.
    const claimsListOpened = await navigateToClaimsList(page);
    if (!claimsListOpened) throw new Error('Could not open Claims list for PRIME -> TARGET sequence.');

    report.prime.navigation = await navigateExactClaim(page, PRIME_CLAIM_ID, 900);
    if (!report.prime.navigation.reached) throw new Error('PRIME claim could not be reached exactly.');
    report.prime.policy = await capturePolicyScope(page, 'prime-policy-decision-panel.png');
    report.prime.react = await captureReactPolicyDiagnostics(page);
    if (report.prime.policy.screenshot) report.screenshots.push(report.prime.policy.screenshot);

    if (!(await returnToClaims(page))) throw new Error('Could not return to Claims list after PRIME.');

    // Deliberately no page.reload()/page.goto() here: TARGET reuses the same browser page.
    report.target.navigation = await navigateExactClaim(page, TARGET_CLAIM_ID, 250);
    if (!report.target.navigation.reached) throw new Error('TARGET claim could not be reached exactly.');
    report.target.policy = await capturePolicyScope(page, 'target-policy-decision-panel.png');
    report.target.react = await captureReactPolicyDiagnostics(page);
    if (report.target.policy.screenshot) report.screenshots.push(report.target.policy.screenshot);

    await page.waitForTimeout(1800);
    report.target.settledPolicy = await capturePolicyScope(page, 'target-policy-decision-panel-settled.png');
    if (report.target.settledPolicy.screenshot) report.screenshots.push(report.target.settledPolicy.screenshot);

    report.claimDetail = {
      attempted: true,
      navClicked: true,
      searchUsed: Boolean(report.target.navigation.method?.includes('search')),
      exactClaimMatched: report.target.navigation.found,
      exactWoMatched: false,
      rowClicked: report.target.navigation.clicked,
      reached: report.target.navigation.reached,
      method: 'Claims navigation + PRIME exact Claim ID + return to Claims + TARGET exact Claim ID (same page)',
      visibleTextSnippet: report.target.navigation.bodyText.slice(0, 7000),
      error: report.target.navigation.error,
      targetClaimId: TARGET_CLAIM_ID,
      targetWo: TARGET_WO,
    };

    report.policyQueryRaw = safeJson(await getPolicyQuery(page));
    report.policyQueryDiagnostic = safeJson(await getPolicyQueryDiagnostic(page));
    report.targetClaimDb = safeJson(report.policyQueryDiagnostic?.claimResolver ?? null);
    report.policyRuleTextMatches = safeJson(report.policyQueryDiagnostic?.ruleTextMatches ?? []);
    report.policyAllRules = safeJson(report.policyQueryDiagnostic?.allRules ?? null);

    const db = report.targetClaimDb || {};
    report.dbUiConsistency.claimFound = Boolean(db?.claim_id);
    report.dbUiConsistency.databaseDealerWo = db?.dealer_wo_so || null;
    report.dbUiConsistency.databaseModel = db?.model || null;
    report.dbUiConsistency.databaseProductFamily = db?.product_family || null;
    report.dbUiConsistency.databaseModelScope = db?.model_scope || null;
    report.dbUiConsistency.databaseComponentCategory = db?.component_category || null;
    report.dbUiConsistency.dealerWoMatches =
      db?.dealer_wo_so != null && String(db.dealer_wo_so) !== ''
        ? String(db.dealer_wo_so).trim().toUpperCase() === String(TARGET_WO).trim().toUpperCase()
        : false;
    const machinePolicies = Array.isArray(db?.machine_policies) ? db.machine_policies : [];
    report.dbUiConsistency.resolverReasonOccurrences = machinePolicies.filter((p) =>
      /Failure is within policy calendar and hour limits, including the B\/L maximum ceiling/i.test(String(p?.reason || ''))
    ).length;
    report.dbUiConsistency.resolverUsesComplaintPhrase = report.dbUiConsistency.resolverReasonOccurrences > 0;
    report.policyRulesCount =
      extractPolicyRuleCount(report.policyQueryRaw) ||
      extractPolicyRuleCount(report.policyQueryDiagnostic?.query);

    report.panel = await capturePanel(page);
    report.panelInnerText = report.panel.panelInnerText || '';

    const dbScope = report.targetClaimDb?.model_scope || null;
    const primeScope = report.prime.policy.renderedScope || null;
    const targetScope = report.target.policy.renderedScope || null;
    const settledTargetScope = report.target.settledPolicy?.renderedScope || null;

    if (primeScope && targetScope && dbScope) {
      if (targetScope === primeScope && targetScope !== dbScope) {
        report.carryOverDetected = true;
        report.carryOverReason =
          settledTargetScope === dbScope && settledTargetScope !== targetScope
            ? 'TARGET immediate renderedScope equals PRIME scope while DB expects a different scope; after the same-page wait, TARGET settled to DB scope. Direct evidence of PRIME state carry-over during the async refresh window.'
            : 'TARGET immediate renderedScope equals PRIME scope while DB expects a different scope. The same-browser navigation reproduced the PRIME carry-over signature.';
      } else {
        report.carryOverDetected = false;
        report.carryOverReason =
          targetScope === dbScope
            ? 'TARGET immediate renderedScope matches DB model_scope; PRIME scope did not carry into the captured TARGET render.'
            : settledTargetScope === dbScope
              ? 'TARGET immediate renderedScope differs from DB and does not equal PRIME; settled TARGET matches DB. PRIME carry-over was not reproduced.'
              : 'TARGET immediate renderedScope does not equal PRIME scope, so the specific PRIME carry-over signature was not reproduced.';
      }
    } else {
      report.carryOverDetected = false;
      report.carryOverReason =
        'Carry-over could not be evaluated because PRIME scope, TARGET scope, or DB model_scope was unavailable.';
    }

    report.dbUiConsistency.targetUiMatchesDbScope =
      targetScope != null && dbScope != null ? targetScope === dbScope : null;
    report.dbUiConsistency.primeUiMatchesDbScope =
      primeScope != null && dbScope != null ? primeScope === dbScope : null;
    report.dbUiConsistency.primeUiScope = primeScope;
    report.dbUiConsistency.targetUiScope = targetScope;
    report.dbUiConsistency.targetSettledUiScope = settledTargetScope;

    report.stringChecks = makeStringChecks(liveHtml, report.panelInnerText);
    report.fallbackTextFound = report.stringChecks.fallbackTextFound;

    report.screenshots.push('claim-detail.png');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'claim-detail.png'),
      fullPage: true,
      animations: 'disabled',
    });

    if (report.panel.screenshot) report.screenshots.push(report.panel.screenshot);

    const liveStorageSignals = await context.cookies().then((cookies) => ({
      cookieCount: cookies.length,
      cookieNames: cookies.map((cookie) => cookie.name).slice(0, 50),
    }));
    report.auth.storageSignals = liveStorageSignals;

    report.pageErrors = report.pageErrors.slice(0, 100);
    report.consoleErrors = report.consoleErrors.slice(0, 100);
    report.classification = classifyMismatch(report);

    await context.close();
  } catch (error) {
    report.fatalError = cleanError(error);
    report.classification = classifyMismatch(report);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (!report.timestamp) report.timestamp = nowIso();
    if (!report.classification) report.classification = classifyMismatch(report);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  const fallbackDir = path.join(process.cwd(), 'production-verify');
  fs.mkdirSync(fallbackDir, { recursive: true });
  fs.writeFileSync(
    path.join(fallbackDir, 'report.json'),
    JSON.stringify(
      {
        timestamp: nowIso(),
        url: BASE_URL,
        fatalError: cleanError(error),
        classification: 'VERIFIER_INTERNAL_FAILURE',
        screenshots: [],
      },
      null,
      2
    )
  );
  console.error(error);
  process.exitCode = 1;
});
