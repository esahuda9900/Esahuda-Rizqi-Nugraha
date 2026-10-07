/**
 * Inject claim-restore runtime INLINE into index.html.
 * CF modules/ bundle is frozen; only index.html apply-* patches reach production.
 */
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
const MARKER = 'SDLG_INLINE_CLAIM_RESTORE_V1';
if (source.includes(MARKER)) {
  console.log('[inline-claim-restore] already present');
  process.exit(0);
}

const snippet = [
  '<script>',
  '/* ' + MARKER + ' */',
  "(function () {",
  "  'use strict';",
  "  if (window.__SDLG_INLINE_CLAIM_RESTORE__) return;",
  "  window.__SDLG_INLINE_CLAIM_RESTORE__ = true;",
  "  var CLAIM_KEY = 'sdlg-warranty:last-claim:v1';",
  "  var SKIP_KEY = 'sdlg-warranty:skip-claim-restore:v1';",
  "  var restoring = false, lastSaved = '', searchFilledFor = '', tries = 0;",
  "  function read(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }",
  "  function write(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }",
  "  function remove(k) { try { localStorage.removeItem(k); } catch (_) {} }",
  "  function claimIdFromText(text) {",
  "    var m = String(text || '').match(/\\b(\\d{4}-\\d{4}-SDLG-PFR)\\b/i);",
  "    return m ? m[1] : '';",
  "  }",
  "  function fromHash() {",
  "    try {",
  "      var h = String(location.hash || '').replace(/^#/, '');",
  "      var m = h.match(/^claim\\/([^/?#]+)/i);",
  "      if (m) { var id = decodeURIComponent(m[1]); if (/^\\d{4}-\\d{4}-SDLG-PFR$/i.test(id)) return id; }",
  "    } catch (_) {}",
  "    return '';",
  "  }",
  "  function readStored() {",
  "    var h = fromHash(); if (h) return h;",
  "    var s = read(CLAIM_KEY) || '';",
  "    return /^\\d{4}-\\d{4}-SDLG-PFR$/i.test(s) ? s : '';",
  "  }",
  "  function writeStored(id) {",
  "    if (!id) return; write(CLAIM_KEY, id); remove(SKIP_KEY); lastSaved = id;",
  "    try { var next = '#claim/' + encodeURIComponent(id); if (String(location.hash || '') !== next) history.replaceState(null, '', next); } catch (_) {}",
  "  }",
  "  function markSkip() {",
  "    write(SKIP_KEY, '1');",
  "    try { if (location.hash && /claim\\//i.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch (_) {}",
  "  }",
  "  function shouldSkip() { return read(SKIP_KEY) === '1'; }",
  "  function isDetail() { return !!document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail=\"1\"]'); }",
  "  function detailId() { var root = document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail=\"1\"]'); return root ? claimIdFromText(root.innerText || '') : ''; }",
  "  function findRow(id) {",
  "    var nodes = document.querySelectorAll('.claim-row, .claims-table-shell tbody tr, table tbody tr');",
  "    for (var i = 0; i < nodes.length; i++) { if ((nodes[i].textContent || '').indexOf(id) >= 0) return nodes[i]; }",
  "    return null;",
  "  }",
  "  function fillSearch(id) {",
  "    if (searchFilledFor === id) return;",
  "    var inputs = document.querySelectorAll('input[placeholder], input[type=\"search\"], input[type=\"text\"]');",
  "    var target = null;",
  "    for (var i = 0; i < inputs.length; i++) {",
  "      var ph = String(inputs[i].getAttribute('placeholder') || '').toLowerCase();",
  "      if (/cari|search|claim|serial|customer/.test(ph)) { target = inputs[i]; break; }",
  "    }",
  "    if (!target) return;",
  "    try {",
  "      var desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');",
  "      if (desc && desc.set) desc.set.call(target, id); else target.value = id;",
  "      target.dispatchEvent(new Event('input', { bubbles: true }));",
  "      target.dispatchEvent(new Event('change', { bubbles: true }));",
  "      searchFilledFor = id;",
  "    } catch (_) {}",
  "  }",
  "  function tryRestore() {",
  "    if (restoring || isDetail() || shouldSkip()) return;",
  "    var id = readStored(); if (!id) return;",
  "    var row = findRow(id);",
  "    if (!row) { fillSearch(id); row = findRow(id); }",
  "    if (!row) return;",
  "    restoring = true;",
  "    try { row.click(); } catch (_) {}",
  "    setTimeout(function () { restoring = false; }, 1200);",
  "  }",
  "  function onTick() {",
  "    if (isDetail()) { var id = detailId(); if (id && id !== lastSaved) writeStored(id); return; }",
  "    tryRestore();",
  "  }",
  "  document.addEventListener('click', function (e) {",
  "    if (!e.target) return;",
  "    var btn = e.target.closest('button,a,.nav-btn');",
  "    var label = btn ? String(btn.textContent || '') : '';",
  "    if (/kembali|back to list|semua klaim/i.test(label) && isDetail()) markSkip();",
  "    var row = e.target.closest('.claim-row, tr');",
  "    if (row && !isDetail()) { var cid = claimIdFromText(row.textContent || ''); if (cid) { remove(SKIP_KEY); writeStored(cid); } }",
  "  }, true);",
  "  var timer = null;",
  "  function schedule() { clearTimeout(timer); timer = setTimeout(onTick, 80); }",
  "  if (typeof MutationObserver !== 'undefined') {",
  "    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });",
  "  }",
  "  (function boot() {",
  "    onTick();",
  "    if (!isDetail() && readStored() && !shouldSkip() && tries < 80) { tries += 1; setTimeout(boot, 150); }",
  "  })();",
  "  window.SDLGNavClaimRestore = { version: 'inline-v1', get: readStored, save: writeStored, clear: markSkip, restore: tryRestore };",
  "})();",
  '</script>'
].join('\n');

if (source.includes('</body>')) {
  source = source.replace('</body>', snippet + '\n</body>');
} else if (source.includes('</head>')) {
  source = source.replace('</head>', snippet + '\n</head>');
} else {
  console.warn('[inline-claim-restore] no insertion point');
  process.exit(1);
}

fs.writeFileSync(file, source);
console.log('[inline-claim-restore] injected into index.html');
