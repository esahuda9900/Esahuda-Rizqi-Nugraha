#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const repoRoot = process.cwd();
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const indexPath = path.join(repoRoot, "index.html");
const baselineIndex = fs.readFileSync(indexPath);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  });
}

function restoreBaseline() {
  fs.writeFileSync(indexPath, baselineIndex);
}

function capture(label) {
  const buffer = fs.readFileSync(indexPath);
  return { label, sha256: sha256(buffer), byteLength: buffer.length };
}

const report = {
  sourceCommit,
  node: process.version,
  npmVersion: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
};

try {
  console.log("=== NPM BUILD ===");
  run("npm", ["install", "--no-audit", "--no-fund"]);
  run("npm", ["run", "build"]);
  report.npm = capture("npm");

  restoreBaseline();
  fs.rmSync(path.join(repoRoot, "node_modules"), { recursive: true, force: true });

  console.log("=== PNPM BUILD ===");
  const pnpmVersion = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
  report.pnpmVersion = pnpmVersion;
  run("pnpm", ["install", "--no-frozen-lockfile"]);
  run("npm", ["run", "build"]);
  report.pnpm = capture("pnpm");

  report.comparison = {
    deterministic:
      report.npm.sha256 === report.pnpm.sha256 &&
      report.npm.byteLength === report.pnpm.byteLength,
    npmSha256: report.npm.sha256,
    pnpmSha256: report.pnpm.sha256,
    npmByteLength: report.npm.byteLength,
    pnpmByteLength: report.pnpm.byteLength,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.comparison.deterministic ? 0 : 2);
} finally {
  restoreBaseline();
}
