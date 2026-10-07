#!/usr/bin/env node

const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");

const REPRO_COMMIT="93dcc91d8d78b52e3849468bad9e910e5f5e0c51";
const EXPECTED_LIVE_SHA="89054b359a146a28b160218f2e4a053e275368b79e1621e449513be04ba2499e";
const WORKTREE="/tmp/sdlg-cloudflare-build-repro";

function sha256(file){
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function run(cmd,args,cwd=WORKTREE){
  console.log(`> ${cmd} ${args.join(" ")}`);
  execFileSync(cmd,args,{cwd,stdio:"inherit",env:{...process.env,SUPABASE_URL:"",SUPABASE_ANON_KEY:"",SUPABASE_SERVICE_ROLE_KEY:""}});
}
try{
  execFileSync("git",["worktree","remove","--force",WORKTREE],{stdio:"ignore"});
}catch(_){}
run("git",["worktree","add","--detach",WORKTREE,REPRO_COMMIT],process.cwd());
try{
  const node=process.version;
  const pnpm=execFileSync("pnpm",["--version"],{cwd:WORKTREE,encoding:"utf8"}).trim();
  if (pnpm !== "10.11.1") throw new Error("Expected pnpm 10.11.1, got " + pnpm);
  const npm=execFileSync("npm",["--version"],{cwd:WORKTREE,encoding:"utf8"}).trim();
  run("pnpm",["install","--no-frozen-lockfile"]);
  run("npm",["run","build"]);
  const builtSha=sha256(path.join(WORKTREE,"index.html"));
  const builtBytes=fs.statSync(path.join(WORKTREE,"index.html")).size;
  const report={
    sourceCommit:REPRO_COMMIT,
    node,
    npmVersion:npm,
    pnpmVersion:pnpm,
    cloudflareObserved:{
      nodeMajor:"22",
      documentedDefaultPnpm:"10.11.1",
      sourceCommit:REPRO_COMMIT,
      liveShaAtThatDeployment:EXPECTED_LIVE_SHA,
    },
    reproduction:{
      sha256:builtSha,
      byteLength:builtBytes,
    },
    comparison:{
      matchesRecordedCloudflareLive:builtSha===EXPECTED_LIVE_SHA,
      expectedLiveSha:EXPECTED_LIVE_SHA,
      reproducedSha:builtSha,
    },
  };
  console.log(JSON.stringify(report,null,2));
  process.exit(report.comparison.matchesRecordedCloudflareLive?0:2);
}finally{
  try{execFileSync("git",["worktree","remove","--force",WORKTREE],{cwd:process.cwd(),stdio:"inherit"});}catch(_){}
}
