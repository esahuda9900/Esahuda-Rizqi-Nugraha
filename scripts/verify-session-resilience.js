// Execute the production singleton with controlled Auth, storage and timers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const KEY = 'sb-frqvelcreczmnofldrga-auth-token';
const OTHER = 'sb-other-project-auth-token';
const source = fs.readFileSync(path.join(root, 'modules/supabase-client.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(getSession, refreshSession = async () => ({ data: { session: null } }), ownToken = true) {
  const data = new Map([[OTHER, 'other-token']]); if (ownToken) data.set(KEY, 'saved-token');
  const timers = new Map(); let id = 0, listener, signOuts = 0, refreshes = 0, emitted = 0;
  const client = { from() {}, rpc() {}, auth: { getSession,
    refreshSession() { refreshes++; return refreshSession(); },
    signOut() { signOuts++; return Promise.resolve({ error: null }); },
    onAuthStateChange(fn) { listener = fn; }
  } };
  const context = { console: { info() {}, warn() {} }, Promise,
    localStorage: { getItem: k => data.get(k) || null, removeItem: k => data.delete(k), key: n => [...data.keys()][n], get length() { return data.size; } },
    supabase: { createClient: () => client },
    setTimeout(fn, ms) { const key = ++id; timers.set(key, { fn, ms }); return key; }, clearTimeout(key) { timers.delete(key); },
    dispatchEvent() { emitted++; }, CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts.detail; } }
  };
  context.window = context; vm.createContext(context); vm.runInContext(source, context);
  return { context, client, data, timers, event: (e,s) => listener(e,s), counts: () => ({signOuts,refreshes,emitted}),
    tick(ms) { for (const [key, t] of [...timers]) if (t.ms === ms) { timers.delete(key); t.fn(); } } };
}
(async () => {
  const slow = setup(() => new Promise(() => {}));
  slow.tick(4000); await flush(); await slow.context.waitForSupabaseReady();
  assert.equal(slow.data.get(KEY), 'saved-token'); assert.equal(slow.data.get(OTHER), 'other-token'); assert.equal(slow.counts().signOuts, 0);
  const rejected = setup(async () => { throw new Error('network offline'); });
  await flush(); await rejected.context.waitForSupabaseReady();
  assert.equal(rejected.data.get(KEY), 'saved-token'); assert.equal(rejected.counts().signOuts, 0);
  const refresh = setup(async () => ({ data: { session: null } }), async () => ({ data: { session: null }, error: new Error('temporary failure') }));
  await flush(); await refresh.context.waitForSupabaseReady();
  assert.equal(refresh.counts().refreshes, 1); assert.equal(refresh.data.get(KEY), 'saved-token'); assert.equal(refresh.counts().signOuts, 0);
  const foreign = setup(async () => ({ data: { session: null } }), undefined, false);
  await flush(); await foreign.context.waitForSupabaseReady(); assert.equal(foreign.counts().refreshes, 0);
  refresh.context.sdlgClearAuthStorage(); assert.equal(refresh.data.has(KEY), false); assert.equal(refresh.data.get(OTHER), 'other-token');
  let complete;
  const race = setup(() => new Promise(resolve => { complete = resolve; }));
  const session = { access_token: 'fixture-token', user: { id: 'fixture-user' } };
  race.event('SIGNED_IN', session); assert.equal(race.counts().emitted, 0, 'session-ready must not run inside auth callback');
  complete({ data: { session: null } }); await flush();
  assert.equal(race.client.__SDLG_LAST_SESSION__, session, 'late session lookup must not overwrite sign-in');
  race.tick(0); assert.equal(race.counts().emitted, 1);
  race.event('TOKEN_REFRESHED', session); race.event('SIGNED_OUT', null); race.tick(0);
  assert.equal(race.counts().emitted, 1, 'stale queued session-ready suppressed after logout');
  const guard = setup(async () => ({ data: { session } }));
  await flush();
  Object.assign(guard.context, {
    document: { readyState: 'complete', hidden: false, addEventListener() {} },
    location: { hash: '#/claims', pathname: '/app.html', search: '' },
    addEventListener() {}, setInterval() { return 1; }, clearInterval() {},
    fetch: async () => ({ status: 401 })
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'modules/sdlg-auth-route-guard.js'), 'utf8'), guard.context);
  await guard.context.fetch('https://frqvelcreczmnofldrga.supabase.co/rest/v1/claims');
  assert.equal(guard.data.get(KEY), 'saved-token', 'API 401 must not erase the session');
  assert.equal(guard.data.get(OTHER), 'other-token'); assert.equal(guard.counts().signOuts, 0);
  guard.context.SDLGAuthRouteGuard.clearAllSbKeys();
  assert.equal(guard.data.has(KEY), false); assert.equal(guard.data.get(OTHER), 'other-token');
  console.log('SESSION RESILIENCE: PASS (timeout, offline, refresh rejection, storage isolation, auth race and deferred notifications)');
})().catch(e => { console.error(e); process.exitCode = 1; });
