#!/usr/bin/env node

/**
 * Read-only Cloudflare deployment audit for SDLG Warranty Claim.
 *
 * Outputs:
 *   production-verify/cloudflare-audit.json
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *
 * Optional env:
 *   CLOUDFLARE_SCRIPT_NAME (default: sdlg-warranty-backup)
 *   LIVE_URL (default: https://sdlg-warranty-backup.esahuda9900.workers.dev/)
 *
 * The script never mutates Cloudflare resources.
 * Audit trigger marker: 2026-09-22.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const API_BASE = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const SCRIPT_NAME = process.env.CLOUDFLARE_SCRIPT_NAME || "sdlg-warranty-backup";
const LIVE_URL = (process.env.LIVE_URL || "https://sdlg-warranty-backup.esahuda9900.workers.dev/").replace(/\/$/, "/");
const OUTPUT_DIR = path.join(process.cwd(), "production-verify");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "cloudflare-audit.json");

if (!TOKEN) {
  throw new Error("Missing CLOUDFLARE_API_TOKEN.");
}
if (!ACCOUNT_ID) {
  throw new Error("Missing CLOUDFLARE_ACCOUNT_ID.");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safe(value) {
  if (value === undefined) return null;
  return value;
}

async function cfGet(endpoint) {
  const url = API_BASE + endpoint;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      "User-Agent": "sdlg-warranty-cloudflare-audit/1.0",
    },
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    endpoint,
    httpStatus: response.status,
    ok: response.ok && json?.success !== false,
    success: json?.success ?? null,
    errors: Array.isArray(json?.errors) ? json.errors : [],
    messages: Array.isArray(json?.messages) ? json.messages : [],
    result: json?.result ?? null,
  };
}

async function fetchLive() {
  const response = await fetch(LIVE_URL, {
    method: "GET",
    headers: {
      Accept: "text/html,*/*;q=0.8",
      "User-Agent": "sdlg-warranty-cloudflare-audit/1.0",
      "Cache-Control": "no-cache",
    },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    httpStatus: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    cfCacheStatus: response.headers.get("cf-cache-status"),
    age: response.headers.get("age"),
    etag: response.headers.get("etag"),
    sha256: sha256(buffer),
    byteLength: buffer.length,
    body: buffer,
  };
}

function gitIndexContentMatch(liveBuffer, maxCommits = 100) {
  const result = {
    exactCommit: null,
    normalizedCommit: null,
    checkedCommits: 0,
  };

  const liveSha = sha256(liveBuffer);
  const normalize = (buffer) =>
    buffer.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const liveNormalized = normalize(liveBuffer);

  let commits = [];
  try {
    commits = execFileSync(
      "git",
      ["log", "--format=%H", "-n", String(maxCommits), "--", "index.html"],
      { encoding: "utf8" }
    )
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return result;
  }

  result.checkedCommits = commits.length;

  for (const commit of commits) {
    try {
      const candidate = execFileSync("git", ["show", `${commit}:index.html`]);
      if (!result.exactCommit && sha256(candidate) === liveSha) {
        result.exactCommit = commit;
        continue;
      }
      if (!result.normalizedCommit && normalize(candidate) === liveNormalized) {
        result.normalizedCommit = commit;
      }
    } catch {
      // Ignore commits whose index.html cannot be read.
    }
  }

  return result;
}

function pickActiveDeployment(deploymentsResponse) {
  const deployments = Array.isArray(deploymentsResponse?.result?.deployments)
    ? deploymentsResponse.result.deployments
    : Array.isArray(deploymentsResponse?.result)
      ? deploymentsResponse.result
      : [];

  return {
    all: deployments,
    latest: deployments[0] || null,
    note:
      deployments.length > 0
        ? "Cloudflare documents the first deployment as the latest deployment actively serving traffic."
        : "No deployment records returned.",
  };
}

function compactBuild(buildEntry) {
  if (!buildEntry || typeof buildEntry !== "object") return null;
  return {
    build_uuid: safe(buildEntry.build_uuid),
    build_outcome: safe(buildEntry.build_outcome),
    status: safe(buildEntry.status),
    created_on: safe(buildEntry.created_on),
    modified_on: safe(buildEntry.modified_on),
    trigger: buildEntry.trigger
      ? {
          trigger_uuid: safe(buildEntry.trigger.trigger_uuid),
          trigger_name: safe(buildEntry.trigger.trigger_name),
          external_script_id: safe(buildEntry.trigger.external_script_id),
          provider_type: safe(buildEntry.trigger.repo_connection?.provider_type),
          repo_name: safe(buildEntry.trigger.repo_connection?.repo_name),
          provider_account_name: safe(buildEntry.trigger.repo_connection?.provider_account_name),
          branch_includes: safe(buildEntry.trigger.branch_includes),
          path_includes: safe(buildEntry.trigger.path_includes),
          build_command: safe(buildEntry.trigger.build_command),
          deploy_command: safe(buildEntry.trigger.deploy_command),
        }
      : null,
    build_trigger_metadata: buildEntry.build_trigger_metadata
      ? {
          author: safe(buildEntry.build_trigger_metadata.author),
          branch: safe(buildEntry.build_trigger_metadata.branch),
          build_trigger_source: safe(buildEntry.build_trigger_metadata.build_trigger_source),
          commit_hash: safe(buildEntry.build_trigger_metadata.commit_hash),
          commit_message: safe(buildEntry.build_trigger_metadata.commit_message),
          provider_type: safe(buildEntry.build_trigger_metadata.provider_type),
          repo_name: safe(buildEntry.build_trigger_metadata.repo_name),
          provider_account_name: safe(buildEntry.build_trigger_metadata.provider_account_name),
          build_command: safe(buildEntry.build_trigger_metadata.build_command),
          deploy_command: safe(buildEntry.build_trigger_metadata.deploy_command),
          root_directory: safe(buildEntry.build_trigger_metadata.root_directory),
        }
      : null,
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const endpoints = {
    scripts: await cfGet(`/accounts/${ACCOUNT_ID}/workers/scripts`),
    deployments: await cfGet(
      `/accounts/${ACCOUNT_ID}/workers/scripts/${encodeURIComponent(SCRIPT_NAME)}/deployments?per_page=100`
    ),
    buildTriggers: null,
    services: await cfGet(`/accounts/${ACCOUNT_ID}/workers/services`),
    accountSubdomain: await cfGet(`/accounts/${ACCOUNT_ID}/workers/subdomain`),
  };

  const scriptList = Array.isArray(endpoints.scripts.result) ? endpoints.scripts.result : [];
  const worker = scriptList.find((script) => String(script?.id || "") === SCRIPT_NAME);
  const workerTag = worker?.tag || null;

  endpoints.buildTriggers = workerTag
    ? await cfGet(
        `/accounts/${ACCOUNT_ID}/builds/workers/${encodeURIComponent(workerTag)}/triggers`
      )
    : {
        endpoint: null,
        httpStatus: null,
        ok: false,
        success: null,
        errors: [],
        messages: ["Worker tag not found for build-trigger lookup."],
        result: null,
      };

  const deploymentInfo = pickActiveDeployment(endpoints.deployments);
  const latestDeployment = deploymentInfo.latest;

  const versionIds = [
    ...(latestDeployment?.versions || []).map((v) => v?.version_id).filter(Boolean),
  ];

  const versionDetails = [];
  for (const versionId of versionIds.slice(0, 10)) {
    const response = await cfGet(
      `/accounts/${ACCOUNT_ID}/workers/scripts/${encodeURIComponent(SCRIPT_NAME)}/versions/${encodeURIComponent(versionId)}`
    );
    versionDetails.push({
      versionId,
      response,
    });
  }

  const buildsByVersion = {};
  const uniqueVersionIds = [...new Set(versionIds)].slice(0, 20);
  if (uniqueVersionIds.length) {
    const response = await cfGet(
      `/accounts/${ACCOUNT_ID}/builds/builds?version_ids=${uniqueVersionIds.map(encodeURIComponent).join(",")}`
    );
    buildsByVersion.response = response;
    buildsByVersion.entries = Object.entries(response.result?.builds || {}).map(
      ([key, value]) => ({
        key,
        ...compactBuild(value),
      })
    );
  } else {
    buildsByVersion.response = {
      endpoint: null,
      httpStatus: null,
      ok: false,
      success: null,
      errors: [],
      messages: ["No active deployment version_id available for build lookup."],
      result: null,
    };
    buildsByVersion.entries = [];
  }

  const live = await fetchLive();
  const gitMatch = gitIndexContentMatch(live.body);

  const triggerList = Array.isArray(endpoints.buildTriggers.result)
    ? endpoints.buildTriggers.result
    : Array.isArray(endpoints.buildTriggers.result?.triggers)
      ? endpoints.buildTriggers.result.triggers
      : [];
  const productionTrigger =
    triggerList.find((trigger) => Array.isArray(trigger?.branch_includes) && trigger.branch_includes.includes("main")) ||
    triggerList.find((trigger) => /production/i.test(String(trigger?.trigger_name || ""))) ||
    triggerList[0] ||
    null;
  const buildEnvironmentResponse = productionTrigger?.trigger_uuid
    ? await cfGet(`/accounts/${ACCOUNT_ID}/builds/triggers/${encodeURIComponent(productionTrigger.trigger_uuid)}/environment_variables`)
    : null;

  const latestVersionDetail =
    versionDetails.find((x) => x.versionId === versionIds[0])?.response?.result || null;

  const latestBuild =
    buildsByVersion.entries
      .filter((x) => x.build_trigger_metadata || x.build_uuid)
      .sort((a, b) =>
        String(b.created_on || "").localeCompare(String(a.created_on || ""))
      )[0] || null;

  const deploymentAnnotation = latestDeployment?.annotations || {};
  const versionMeta = latestVersionDetail?.metadata || {};
  const versionScript = latestVersionDetail?.resources?.script || {};

  const cloudflareCommit =
    latestBuild?.build_trigger_metadata?.commit_hash ||
    deploymentAnnotation["workers/commit"] ||
    null;

  const inferredDeploySource = {
    version_source: safe(versionMeta.source),
    version_author_email: safe(versionMeta.author_email),
    version_author_id: safe(versionMeta.author_id),
    last_deployed_from: safe(versionScript.last_deployed_from),
    deployment_triggered_by: safe(deploymentAnnotation["workers/triggered_by"]),
    deployment_message: safe(deploymentAnnotation["workers/message"]),
    workers_build_trigger_source: safe(
      latestBuild?.build_trigger_metadata?.build_trigger_source
    ),
    workers_build_provider_type: safe(
      latestBuild?.build_trigger_metadata?.provider_type
    ),
    workers_build_author: safe(latestBuild?.build_trigger_metadata?.author),
    workers_build_repo_name: safe(latestBuild?.build_trigger_metadata?.repo_name),
    workers_build_branch: safe(latestBuild?.build_trigger_metadata?.branch),
    workers_build_commit_hash: safe(
      latestBuild?.build_trigger_metadata?.commit_hash
    ),
    workers_build_commit_message: safe(
      latestBuild?.build_trigger_metadata?.commit_message
    ),
  };

  let whyMainDidNotReachProduction = "NOT_VERIFIED";
  const evidence = [];

  if (live.ok && live.sha256 && gitMatch.exactCommit) {
    whyMainDidNotReachProduction =
      "Live HTML exactly matches a historical Git index.html commit, so production is serving a different repository snapshot than current main.";
    evidence.push("Exact live index.html content matched a historical Git commit.");
  } else if (live.ok && live.sha256 && gitMatch.normalizedCommit) {
    whyMainDidNotReachProduction =
      "Live HTML normalized content matches a historical Git index.html commit, so production is serving a different repository snapshot than current main.";
    evidence.push("Normalized live index.html content matched a historical Git commit.");
  } else if (latestBuild?.build_trigger_metadata?.commit_hash) {
    const buildCommit = latestBuild.build_trigger_metadata.commit_hash;
    const headCommit = process.env.GITHUB_SHA || null;
    if (headCommit && buildCommit !== headCommit) {
      whyMainDidNotReachProduction =
        "Cloudflare Workers Builds shows a deployment built from a different Git commit than the audit run/main commit.";
      evidence.push(`Cloudflare build commit ${buildCommit} differs from GitHub audit commit ${headCommit}.`);
    } else {
      whyMainDidNotReachProduction =
        "Cloudflare Workers Builds reports the same commit as the audit run; no deployment-content divergence is proven by the build metadata.";
    }
  } else if (
    inferredDeploySource.version_source === "dash" ||
    inferredDeploySource.version_source === "cf_cli"
  ) {
    whyMainDidNotReachProduction =
      "The active Cloudflare version was uploaded from a dashboard/Cloudflare CLI source rather than a Workers Builds Git integration commit, so GitHub main is not the direct deployment authority for the live version.";
    evidence.push(`Cloudflare version source = ${inferredDeploySource.version_source}.`);
  } else if (inferredDeploySource.version_source === "wrangler") {
    whyMainDidNotReachProduction =
      "The active Cloudflare version was uploaded by Wrangler; GitHub main does not prove it was the source of that deployment.";
    evidence.push("Cloudflare version source = wrangler.");
  } else if (inferredDeploySource.version_source === "integration") {
    whyMainDidNotReachProduction =
      "Cloudflare identifies the version source as an integration, but the connected build metadata did not expose a commit hash in this audit.";
    evidence.push("Cloudflare version source = integration.");
  }

  const report = {
    timestamp: new Date().toISOString(),
    audit: {
      script_name: SCRIPT_NAME,
      live_url: LIVE_URL,
      account_id_suffix: ACCOUNT_ID.slice(-6),
      github_sha: process.env.GITHUB_SHA || null,
      github_run_id: process.env.GITHUB_RUN_ID || null,
      github_run_number: process.env.GITHUB_RUN_NUMBER || null,
      github_workflow: process.env.GITHUB_WORKFLOW || null,
    },
    requestedEndpoints: {
      scripts: endpoints.scripts,
      deployments: endpoints.deployments,
      services: endpoints.services,
      accountSubdomain: endpoints.accountSubdomain,
      buildTriggers: endpoints.buildTriggers,
    },
    deploymentHistory: {
      count: deploymentInfo.all.length,
      note: deploymentInfo.note,
      latest: latestDeployment,
    },
    activeVersions: {
      versionIds,
      details: versionDetails,
    },
    workersBuilds: {
      ...buildsByVersion,
      productionTrigger: productionTrigger
        ? {
            trigger_uuid: productionTrigger.trigger_uuid || null,
            trigger_name: productionTrigger.trigger_name || null,
            branch_includes: productionTrigger.branch_includes || null,
            build_command: productionTrigger.build_command || null,
            deploy_command: productionTrigger.deploy_command || null,
          }
        : null,
      buildEnvironment: buildEnvironmentResponse?.result || null,
    },
    liveSurface: {
      httpStatus: live.httpStatus,
      ok: live.ok,
      contentType: live.contentType,
      cfCacheStatus: live.cfCacheStatus,
      age: live.age,
      etag: live.etag,
      sha256: live.sha256,
      byteLength: live.byteLength,
    },
    gitContentMatch: gitMatch,
    attribution: {
      who_deployed_last: {
        author_email: inferredDeploySource.version_author_email,
        author_id: inferredDeploySource.version_author_id,
        build_author: inferredDeploySource.workers_build_author,
        source: inferredDeploySource.version_source,
      },
      trigger: {
        version_source: inferredDeploySource.version_source,
        last_deployed_from: inferredDeploySource.last_deployed_from,
        deployment_triggered_by: inferredDeploySource.deployment_triggered_by,
        workers_build_trigger_source: inferredDeploySource.workers_build_trigger_source,
        provider_type: inferredDeploySource.workers_build_provider_type,
        repository: inferredDeploySource.workers_build_repo_name,
        branch: inferredDeploySource.workers_build_branch,
      },
      live_commit_sha: cloudflareCommit || gitMatch.exactCommit || gitMatch.normalizedCommit || null,
      build_commit_sha: inferredDeploySource.workers_build_commit_hash,
      audit_github_sha: process.env.GITHUB_SHA || null,
    },
    diagnosis: {
      why_main_did_not_reach_production: whyMainDidNotReachProduction,
      evidence,
      confidence:
        cloudflareCommit || gitMatch.exactCommit || gitMatch.normalizedCommit
          ? "HIGH"
          : "LOW",
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    output: OUTPUT_FILE,
    latestDeploymentId: latestDeployment?.id || null,
    activeVersionIds: versionIds,
    who: report.attribution.who_deployed_last,
    trigger: report.attribution.trigger,
    liveCommitSha: report.attribution.live_commit_sha,
    buildCommitSha: report.attribution.build_commit_sha,
    auditGithubSha: report.attribution.audit_github_sha,
    diagnosis: report.diagnosis,
    requestedEndpointStatus: Object.fromEntries(
      Object.entries(endpoints).map(([k, v]) => [k, { httpStatus: v.httpStatus, ok: v.ok }])
    ),
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
