#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const PROD = process.env.SDLG_PROD_URL || 'https://sdlg-warranty-backup.esahuda9900.workers.dev';
const CRITICAL = ['index.html','modules/sdlg-core.js','modules/navigation-state.js','modules/warranty-tracking-ux.js','modules/sdlg-input-helper-ux.js','modules/wo-claim-policy.js'];
function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
async function fetchText(url){const r=await fetch(url);if(!r.ok)throw new Error(r.status+' '+url);return Buffer.from(await r.arrayBuffer());}
(async()=>{
  let failed=0;
  for(const rel of CRITICAL){
    const lp=path.join(process.cwd(),rel);
    if(!fs.existsSync(lp)){console.error('MISSING',rel);failed++;continue;}
    const local=sha256(fs.readFileSync(lp));
    let remote;
    try{remote=sha256(await fetchText(PROD.replace(/\/$/,'')+'/'+rel));}catch(e){console.error('FETCH',rel,e.message);failed++;continue;}
    if(local===remote)console.log('OK',rel,local.slice(0,12));
    else{console.error('MISMATCH',rel);failed++;}
  }
  process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
