/**
 * Hash ↔ Tab bridge (FINAL)
 * Keeps URL hash and top-nav tab in sync without fighting React state.
 * - Applies hash → tab only when hash changes (not on every click)
 * - Never overrides claim-detail hashes (#/claim/...)
 * - Uses history.replaceState for tab → hash to avoid reload loops
 */
(function () {
  'use strict';

  var applying = false;
  var lastAppliedHash = '';

  function currentHash() {
    return String(window.location.hash || '');
  }

  function isClaimDetailHash(h) {
    h = String(h || '').replace(/^#/, '');
    return /^\/?claim\//i.test(h) || /^\/?claims\/[^/]+/i.test(h) && !/^\/?claims\/\d{4}$/i.test(h);
  }

  function tabFromHash(h) {
    h = String(h || '').replace(/^#\/?/, '').toLowerCase();
    if (!h || h === 'overview' || h === 'dashboard') return 'dashboard';
    if (h.indexOf('claims') === 0 || h.indexOf('list') === 0) return 'list';
    if (h.indexOf('new-claim') === 0 || h.indexOf('paste') === 0) return 'paste';
    if (h.indexOf('sdlg-input') === 0 || h.indexOf('sdlginput') === 0) return 'sdlginput';
    if (h.indexOf('master') === 0) return 'masters';
    if (h.indexOf('data-quality') === 0 || h.indexOf('quality') === 0) return 'quality';
    if (h.indexOf('unit360') === 0 || h.indexOf('unit') === 0) return 'unit360';
    return '';
  }

  function clickNavTab(tab) {
    if (!tab || tab === 'login') return;
    var labels = {
      dashboard: /^overview/i,
      list: /^claims/i,
      paste: /new claim/i,
      sdlginput: /sdlg input/i,
      masters: /master data/i,
      quality: /data quality/i,
      unit360: /unit 360/i
    };
    var re = labels[tab];
    if (!re) return;
    var btns = document.querySelectorAll('button.nav-btn');
    for (var i = 0; i < btns.length; i++) {
      var t = String(btns[i].textContent || '').trim();
      if (re.test(t)) {
        btns[i].click();
        return;
      }
    }
  }

  function applyHashToTab() {
    if (applying) return;
    var h = currentHash();
    if (h === lastAppliedHash) return;
    if (isClaimDetailHash(h)) return;
    var tab = tabFromHash(h);
    if (!tab) return;
    applying = true;
    lastAppliedHash = h;
    try {
      clickNavTab(tab);
    } finally {
      setTimeout(function () { applying = false; }, 80);
    }
  }

  function setHashFromTab(tab) {
    if (applying) return;
    var map = {
      dashboard: '#/overview',
      list: '#/claims',
      paste: '#/new-claim',
      sdlginput: '#/sdlg-input',
      masters: '#/master-data',
      quality: '#/data-quality',
      unit360: '#/unit360'
    };
    var next = map[tab];
    if (!next) return;
    if (currentHash() === next) return;
    applying = true;
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + next);
      } else {
        window.location.hash = next.replace(/^#/, '');
      }
      lastAppliedHash = next;
    } finally {
      setTimeout(function () { applying = false; }, 80);
    }
  }

  function onNavClick(e) {
    var btn = e.target && e.target.closest && e.target.closest('button.nav-btn');
    if (!btn) return;
    var label = String(btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
    var tab = '';
    if (/^overview/.test(label)) tab = 'dashboard';
    else if (/^claims/.test(label)) tab = 'list';
    else if (/new claim/.test(label)) tab = 'paste';
    else if (/sdlg input/.test(label)) tab = 'sdlginput';
    else if (/master data/.test(label)) tab = 'masters';
    else if (/data quality/.test(label)) tab = 'quality';
    else if (/unit/.test(label)) tab = 'unit360';
    if (tab) setHashFromTab(tab);
  }

  function boot() {
    window.addEventListener('hashchange', applyHashToTab);
    document.addEventListener('click', onNavClick, true);
    setTimeout(applyHashToTab, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGHashTabBridge = {
    version: 'stable-soft-restore',
    apply: applyHashToTab,
    setHashFromTab: setHashFromTab
  };
})();
