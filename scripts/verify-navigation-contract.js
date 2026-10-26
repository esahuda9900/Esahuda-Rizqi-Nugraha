'use strict';
// Read-only navigation regression suite. Runs without credentials or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../modules/navigation-state.js'), 'utf8');
function environment(hash) {
  const storage = new Map();
  const location = { pathname:'/Esahuda-Rizqi-Nugraha/app.html', search:'', hash };
  const window = {
    location,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    history:{replaceState:(_a,_b,url)=>{location.hash = url.slice(url.indexOf('#'));}},
  };
  const document = { addEventListener:()=>{}, readyState:'loading' };
  vm.runInNewContext(source,{window,document,Set,JSON,Date,encodeURIComponent,decodeURIComponent}, {timeout:2000});
  return {nav:window.SDLGNavState,location};
}
{
  const {nav,location}=environment('#/sdlg-input/0258-2026-SDLG-PFR');
  assert.equal(nav.restore('list'),'sdlginput');
  assert.equal(nav.routeFromHash().portalClaimId,'0258-2026-SDLG-PFR');
  nav.persist('sdlginput',null,null);
  assert.equal(location.hash,'#/sdlg-input/0258-2026-SDLG-PFR','persist must preserve SDLG claim identity');
  nav.setPortalClaimId('0262-2026-SDLG-PFR');
  assert.equal(location.hash,'#/sdlg-input/0262-2026-SDLG-PFR');
  nav.setPortalClaimId('');
  assert.equal(location.hash,'#/sdlg-input','missing identity must not silently choose another claim');
}
{
  const {nav,location}=environment('#/claims/0258-2026-SDLG-PFR');
  assert.equal(nav.restoreDetailId(),'0258-2026-SDLG-PFR');
  nav.persist('list',null,'0258-2026-SDLG-PFR');
  assert.equal(location.hash,'#/claims/0258-2026-SDLG-PFR');
  nav.persist('list',null,null);
  assert.equal(location.hash,'#/claims');
}
{
  const {nav,location}=environment('#/overview');
  nav.persist('list',null,null);
  assert.equal(location.hash,'#/claims','normal menu navigation must still work');
}
{
  const {nav}=environment('#/sdlg-input/not a valid id');
  assert.equal(nav.routeFromHash(),null,'bad claim identity must not be accepted');
}
console.log('NAVIGATION CONTRACT PASS: explicit identity survives reload, claim switching, Back/Forward routes, and empty selection');