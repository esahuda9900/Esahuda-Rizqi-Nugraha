/**
 * Fast-path for Warranty Assessment panel + boot nav-claim-restore.
 * Paths are relative so GitHub Project Pages resolves under /repo/.
 * v1.4: always pin canonical helper to v126 — never re-inject pathfix.
 */
(function () {
  'use strict';
  if (window.__SDLG_HELPER_FASTPATH_V14__) return;
  window.__SDLG_HELPER_FASTPATH_V14__ = true;
  window.__SDLG_HELPER_FASTPATH__ = true;

  var FAST_HELPER = './canonical-warranty-helper.js?v=20261012-v126';

  function loadScript(src, marker) {
    if (document.querySelector('script[' + marker + ']')) return;
    var base = src.split('?')[0];
    var existing = document.querySelectorAll('script[src]');
    for (var i = 0; i < existing.length; i++) {
      if ((existing[i].getAttribute('src') || '').indexOf(base) >= 0) return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute(marker, '1');
    (document.head || document.documentElement).appendChild(s);
  }

  loadScript('./modules/nav-claim-restore.js?v=20261012-v14', 'data-sdlg-nav-claim-restore');

  function ensureFastHelperScript() {
    try {
      // If ANY canonical helper already present (any version), do NOT inject another.
      if (document.querySelector('script[src*="canonical-warranty-helper"]')) return;
      if (window.__SDLG_CANONICAL_HELPER_BOOTED__) return;
      var s = document.createElement('script');
      s.src = FAST_HELPER;
      s.async = true;
      s.setAttribute('data-sdlg-helper-fast', '1');
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {}
  }

  function findRoot() {
    return document.querySelector('.page.claim-detail-page[data-sdlg-claim-detail="1"]')
      || document.querySelector('[data-sdlg-claim-detail="1"]')
      || document.querySelector('.page.claim-detail-page');
  }

  function claimIdFromDom() {
    var root = findRoot();
    if (!root) return '';
    var m = (root.innerText || '').match(/\b\d{3,4}-\d{4}-SDLG-PFR\b/);
    return m ? m[0] : '';
  }

  function ensureShell() {
    if (!findRoot()) return;
    if (document.querySelector('[data-sdlg-warranty-routing]:not([data-sdlg-loading="1"])')) return;
    var claimId = claimIdFromDom();
    if (!claimId) return;
    var existing = document.querySelector('[data-sdlg-warranty-routing][data-sdlg-loading="1"]');
    if (existing) return;
    var panel = document.createElement('div');
    panel.setAttribute('data-sdlg-warranty-routing', '1');
    panel.setAttribute('data-sdlg-loading', '1');
    panel.style.cssText = 'margin:12px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff';
    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
      '<div><div style="font-size:10px;font-weight:850;color:#6366f1;text-transform:uppercase">Warranty Engine · Live DB</div>' +
      '<div style="font-size:16px;font-weight:850;color:#0f172a;margin-top:2px">Warranty Assessment</div></div>' +
      '<div style="padding:6px 12px;border-radius:999px;background:#fffbeb;border:1px solid #fde68a;font-size:12px;font-weight:850;color:#b45309">LOADING</div></div>' +
      '<div style="margin-top:12px;font-size:12px;color:#64748b">Menghitung FINAL ROUTE & matrix (RPC)\u2026 <b>' + claimId + '</b></div>';
    var root = findRoot();
    var before = root.children && root.children.length > 1 ? root.children[1] : root.firstChild;
    root.insertBefore(panel, before);
  }

  function kickHelper() {
    try {
      var root = findRoot();
      if (!root) return;
      root.setAttribute('data-sdlg-fastpath-tick', String(Date.now()));
    } catch (_) {}
  }

  function onMaybeDetail() {
    ensureFastHelperScript();
    if (!findRoot()) return;
    ensureShell();
    kickHelper();
  }

  var t = null;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(onMaybeDetail, 50);
  }

  ensureFastHelperScript();

  document.addEventListener('click', function (e) {
    if (!e.target) return;
    if (e.target.closest('.claim-row') || e.target.closest('tr') || e.target.closest('a') || e.target.closest('.nav-btn')) {
      setTimeout(schedule, 20);
    }
  }, true);

  if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(function () {
      if (document.querySelector('[data-sdlg-warranty-routing]:not([data-sdlg-loading="1"])')) return;
      schedule();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  window.SDLGHelperFastpath = { version: '1.4.0', refresh: onMaybeDetail };
})();
