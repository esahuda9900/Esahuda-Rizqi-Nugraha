const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
const mock = `
export const fixture = { mode: 'anon', listener: null, signedOut: false };
const session = { access_token: 'fixture-only', user: { id: 'fixture-user', email: 'operator@example.test' } };
function query(table) {
 const q = { then(resolve) { return Promise.resolve({ data: table === 'app_user_roles' ? { user_id:'fixture-user', role:'viewer', is_active:true } : table === 'claims' ? [{claim_id:'0001-2026-SDLG-PFR', customer:'Fixture Customer', claim_status:'SDLG Audit', model:'L936H', serial_no:'FIXTURE', last_updated:'2026-10-26'}] : [], error:null }).then(resolve); } };
 for (const method of ['select','eq','is','order','limit','maybeSingle','range','overrideTypes']) q[method] = () => q;
 return q;
}
const sb = { from:query, auth: {
 onAuthStateChange(fn) { fixture.listener=fn; return { data: { subscription: { unsubscribe(){fixture.listener=null;} } } }; },
 async getSession(){ if(fixture.mode==='offline') throw new Error('Fixture network unavailable'); return { data: { session: fixture.mode==='signed' ? session : null }, error:null }; },
 async signInWithPassword(){ return { error: new Error('Email atau password tidak sesuai') }; },
 async signOut(){fixture.signedOut=true; fixture.listener?.('SIGNED_OUT',null);return {error:null};}
} };
export const getSupabase = () => sb;
`;
async function bundle() {
 const result = await build({absWorkingDir:project,stdin:{contents:`export { App } from './src/app/App'; export { createRoot } from 'react-dom/client'; export { act, createElement, StrictMode } from 'react'; export { fixture } from '@test/backend'; export { withDeadline, boundedFetch } from './src/lib/request';`,resolveDir:project,loader:'tsx'},bundle:true,write:false,format:'iife',globalName:'TestApp',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','import.meta.env.BASE_URL':'"/Esahuda-Rizqi-Nugraha/preview/"'},alias:{'@':path.join(project,'src')},plugins:[{name:'fixture-backend',setup(b){b.onResolve({filter:/^(@test\/backend|@\/lib\/supabase|\.\.?\/supabase)$/},()=>({path:'backend',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js'}));}}]});
 return result.outputFiles[0].text;
}
(async()=>{
 const source=await bundle();
 async function scenario(mode,check){
  const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/Esahuda-Rizqi-Nugraha/preview/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;w.IS_REACT_ACT_ENVIRONMENT=true;w.MessageChannel=class {constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};}};w.Request=Request;w.Response=Response;w.fetch=()=>{throw new Error('Unexpected real network call')};w.eval(source);
  const api=w.TestApp;api.fixture.mode=mode;
  const root=api.createRoot(w.document.getElementById('root'));
  try { await api.act(async()=>{root.render(api.createElement(api.StrictMode, null, api.createElement(api.App)));await new Promise(r=>setTimeout(r,30));});await check(w,api);assert.deepEqual(errors,[]); }
  finally {await api.act(async()=>root.unmount());w.close();}
 }
 await scenario('anon',async(w,api)=>{
  const doc=w.document;assert.match(doc.body.textContent,/Selamat datang kembali/);
  assert.equal(doc.querySelector('button[type="submit"]').disabled,false);
  await api.act(async()=>doc.querySelector('.password-field button').click());assert.equal(doc.querySelector('input[autocomplete="current-password"]').type,'text');
  await api.act(async()=>doc.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})));
  assert.match(doc.querySelector('[role="alert"]').textContent,/Email atau password/);
  assert.equal(doc.querySelector('button[type="submit"]').disabled,false);
  assert.equal(api.fixture.signedOut,false);
 });
 await scenario('offline',async(w,api)=>{
  assert.match(w.document.body.textContent,/Fixture network unavailable/);
  assert.ok(w.document.querySelector('button'),'retry available');
  api.fixture.mode='anon';await api.act(async()=>w.document.querySelector('button').click());
  assert.match(w.document.body.textContent,/Selamat datang kembali/);
 });
 await scenario('signed',async(w,api)=>{
  await api.act(async()=>{await new Promise(r=>setTimeout(r,100));});
  assert.match(w.document.body.textContent,/Fixture Customer/);assert.match(w.document.body.textContent,/0001-2026-SDLG-PFR/);
  assert.equal([...w.document.querySelectorAll('a')].some(a=>a.textContent.includes('Admin Center')),false);
  const exit=[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Keluar akun'));
  assert.ok(exit);await api.act(async()=>exit.click());assert.equal(api.fixture.signedOut,true);
  assert.match(w.document.body.textContent,/Selamat datang kembali/);
 });
 await scenario('anon',async(w,api)=>{
  assert.equal(await api.withDeadline(Promise.resolve('ok'),20),'ok');
  await assert.rejects(api.withDeadline(new Promise(()=>{}),5),/Koneksi terlalu lama/);
  const cancel=new w.AbortController();cancel.abort();let sawAbort=false;
  w.fetch=async(_input,init)=>{sawAbort=init.signal.aborted;throw new Error('cancelled');};
  await assert.rejects(api.boundedFetch('https://example.test',{signal:cancel.signal}),/cancelled/);assert.equal(sawAbort,true);
 });
 console.log('WORKSPACE TESTS PASS: anonymous login, invalid credentials, session failure/retry, authenticated dashboard, viewer navigation, logout, request deadlines/cancellation (mock backend; no production writes).');
})().catch(e=>{console.error(e);process.exitCode=1;});
