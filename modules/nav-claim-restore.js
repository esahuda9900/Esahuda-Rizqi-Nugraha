/**
 * Nav claim restore v1.0
 * Production index still resets detailId=null on refresh.
 * This module persists the open claim and re-opens it after reload without React wiring.
 */
(function () {
  'use strict';
  if (window.__SDLG_NAV_CLAIM_RESTORE__) return;
  window.__SDLG_NAV_CLAIM_RESTORE__ = true;

  var KEY = 'sdlg-warranty:last-claim:v1';
  var SKIP_KEY = 'sdlg-warranty:skip-claim-restore:v1';
  var restoring = false;
  var lastSaved = '';

  function claimIdPattern(text) {
    var m = String(text || '').match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/i);
    return m ? m[1] : '';
  }

  function readStored() {
    try {
      var fromHash = '';
      var h = String(window.location.hash || '').replace(/^#/, '');
      var hm = h.match(/^claim\/([^/?#]+)/i);
      if (hm) fromHash = decodeURIComponent(hm[1]);
      if (/^\d{4}-\d{4}-SDLG-PFR$/i.test(fromHash)) return fromHash;
      var s = window.localStorage.getItem(KEY) || '';
      if (/^\d{4}-\d{4}-SDLG-PFR$/i.test(s)) return s;
    } catch (_) {}
    return '';
  }

  function writeStored(id) {
    try {
      if (!id) return;
      window.localStorage.setItem(KEY, id);
      window.localStorage.removeItem(SKIP_KEY);
      var next = '#claim/' + encodeURIComponent(id);
      if (String(window.location.hash || '') !== next) {
        window.history.replaceState(null, '', next);
      }
      lastSaved = id;
    } catch (_) {}
  }

  function markSkipRestore() {
    try {
      window.localStorage.setItem(SKIP_KEY, '1');
      // keep last claim id for later, but skip one automatic restore
      if (window.location.hash && /claim\//i.test(window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (_) {}
  }

  function shouldSkip() {
    try { return window.localStorage.getItem(SKIP_KEY) === '1'; } catch (_) { return false; }
  }

  function isDetail() {
    return !!document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
  }

  function detailClaimId() {
    var root = document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
    if (!root) return '';
    return claimIdPattern(root.innerText || '');
  }

  function findClaimRow(claimId) {
    var rows = document.querySelectorAll('.claim-row');
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i].textContent || '';
      if (t.indexOf(claimId) >= 0) return rows[i];
    }
    // table rows fallback
    var trs = document.querySelectorAll('.claims-table-shell tbody tr, table tbody tr');
    for (var j = 0; j < trs.length; j++) {
      var tt = trs[j].textContent || '';
      if (tt.indexOf(claimId) >= 0) return trs[j];
    }
    return null;
  }

  function tryRestore() {
    if (restoring) return;
    if (isDetail()) return;
    if (shouldSkip()) return;
    var id = readStored();
    if (!id) return;
    var row = findClaimRow(id);
    if (!row) return;
    restoring = true;
    try {
      row.click();
    } catch (_) {}
    setTimeout(function () {
      restoring = false;
      // if still not on detail, allow retry later
    }, 800);
  }

  function onMaybeNavigate() {
    if (isDetail()) {
      var id = detailClaimId();
      if (id && id !== lastSaved) writeStored(id);
      return;
    }
    // On list: attempt restore soon after rows appear
    tryRestore();
  }

  // Explicit back / list navigation → don't force-reopen claim this session
  document.addEventListener(
    'click',
    function (e) {
      if (!e.target) return;
      var t = e.target;
      var label = String((t.closest('button,a,.nav-btn') && (t.closest('button,a,.nav-btn').textContent || '')) || '');
      if (/kembali|back to list|semua klaim|claims/i.test(label) && isDetail()) {
        markSkipRestore();
      }
      // Clicking another claim row updates storage after navigation
      var row = t.closest('.claim-row, tr');
      if (row && !isDetail()) {
        var cid = claimIdPattern(row.textContent || '');
        if (cid) {
          try { window.localStorage.removeItem(SKIP_KEY); } catch (_) {}
          writeStored(cid);
        }
      }
    },
    true
  );

  var timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(onMaybeNavigate, 120);
  }

  if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Boot retries while claims list loads
  var tries = 0;
  (function bootLoop() {
    onMaybeNavigate();
    if (!isDetail() && readStored() && !shouldSkip() && tries < 40) {
      tries += 1;
      setTimeout(bootLoop, 250);
    }
  })();

  window.SDLGNavClaimRestore = {
    version: '1.0',
    get: readStored,
    save: writeStored,
    clear: markSkipRestore,
    restore: tryRestore
  };
})();
