// Regression for the observer -> error panel -> observer feedback loop.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const listeners = {}, timers = new Map(), observers = [];
let nextTimer = 0, writes = 0;
const panel = { style: {} };
const text = { value: '', get textContent() { return this.value; }, set textContent(v) { writes++; this.value = v; } };
const body = { nodeType: 1, closest: () => null, querySelectorAll: () => [], insertBefore() {} };
const document = {
  readyState: 'complete', body, head: { appendChild() {} },
  getElementById: id => id === 'sdlg-boot-error' ? panel : id === 'sdlg-boot-error-text' ? text : null,
  querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
  createElement: () => ({ setAttribute() {}, style: {} })
};
const context = {
  document, console, location: { hash: '' }, localStorage: { getItem: () => null },
  setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); },
  addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
  dispatchEvent(e) { for (const fn of listeners[e.type] || []) fn(e); },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'modules/sdlg-input-claim-sync.js'), 'utf8'), context);
// Boot's delayed hash sync previously throws ReferenceError here.
for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
assert.equal(observers.length, 1);
timers.clear();
const diagnostic = { nodeType: 1, closest: selector => selector === '#sdlg-boot-error' ? panel : null };
observers[0]([{ target: diagnostic, type: 'childList', addedNodes: [{}], removedNodes: [] }]);
assert.equal(timers.size, 0, 'diagnostics must not schedule claim checks');
observers[0]([{ target: body, type: 'childList', addedNodes: [{}], removedNodes: [] }]);
assert.equal(timers.size, 1, 'real page changes still schedule checks');
observers[0]([{ target: body, type: 'childList', addedNodes: [{}], removedNodes: [] }]);
assert.equal(timers.size, 1, 'successive mutations must debounce');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const handler = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m => m[1].includes('function showSDLGStartupError'));
assert.ok(handler, 'startup error handler exists');
vm.runInContext(handler[1], context);
const error = { message: 'test startup failure' };
context.dispatchEvent({ type: 'error', ...error });
context.dispatchEvent({ type: 'error', ...error });
assert.equal(writes, 1, 'repeated errors must not rewrite the DOM');
context.dispatchEvent({ type: 'error', message: 'different failure' });
assert.equal(writes, 2, 'new errors must remain visible');
console.log('LOGIN FREEZE REGRESSION: PASS (boot, debounce, diagnostics isolation, repeated/new errors)');

// Both entrypoints must bypass an older cached registry, not just version its child.
for (const file of ['index.html', 'app.html']) {
  const entry = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(entry, /src="\.\/modules\/claim-fields\.js\?v=20261026-session-v24"/);
}
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /location\.replace\('\.\/app\.html\?v=20261026-session-v24'\)/);
console.log('ENTRYPOINT CACHE REGRESSION: PASS');
