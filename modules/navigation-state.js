/**
 * SDLG Navigation State + Smart Core Router — V2.0
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO POLLING: Hapus setInterval & bootLoop 60x.
 * ✅ PROMISE QUEUE: File JS di-load berurutan (Anti-Race Condition).
 * ✅ SAFE CLICK: Pakai dispatchEvent biar React pasti nangkep.
 * ✅ DEBOUNCED OBSERVER: Cuma ngawasin area klaim (bukan seluruh DOM).
 * ✅ MODULAR: Pecah logika jadi NavState, Restore, dan Loader.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_NAV_STATE_V2__) return;
  window.__SDLG_NAV_STATE_V2__ = true;

  // ─────────────────────────────────────────────────────────
  // KONFIGURASI
  // ─────────────────────────────────────────────────────────
  var PREFIX = 'sdlg-warranty:nav:v2';
  var CLAIM_KEY = 'sdlg-warranty:last-claim:v2';
  var SKIP_KEY = 'sdlg-warranty:skip-claim-restore:v2';
  var VALID_TABS = new Set(['dashboard', 'list', 'paste', 'sdlginput', 'masters', 'quality', 'unit360']);
  var CLAIM_REGEX = /\b(\d{3,4}-\d{4}-SDLG(?:-PFR)?)\b/i;

  // ─────────────────────────────────────────────────────────
  // BAGIAN 1: NAVIGATION STATE (Sama persis, tapi lebih aman)
  // ─────────────────────────────────────────────────────────
  function normalizeTab(value, fallback) {
    var next = String(value || '').trim();
    return VALID_TABS.has(next) ? next : fallback || 'list';
  }

  function normalizeDetailId(value) {
    var id = String(value || '').trim();
    if (!id) return null;
    if (/^\d{4}-\d{4}-SDLG-PFR$/i.test(id) || /^[A-Za-z0-9._:-]{4,80}$/.test(id)) return id;
    return null;
  }

  function getKey(user) {
    var identity = String((user && (user.id || user.email)) || 'guest').trim().toLowerCase() || 'guest';
    return PREFIX + ':' + identity;
  }

  function readJSON(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }

  function writeJSON(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }

  function getState(user) {
    var raw = readJSON(getKey(user)) || readJSON(getKey(null)) || { tab: 'list', detailId: null };
    return { tab: normalizeTab(raw.tab, 'list'), detailId: normalizeDetailId(raw.detailId) };
  }

  function setState(tab, detailId, user) {
    var payload = { tab: normalizeTab(tab, 'list'), detailId: normalizeDetailId(detailId), at: Date.now() };
    writeJSON(getKey(null), payload);
    if (user) writeJSON(getKey(user), payload);
    
    if (detailId) {
      try { window.localStorage.setItem(CLAIM_KEY, detailId); } catch (_) {}
      syncHash(detailId);
    } else {
      try { window.localStorage.removeItem(CLAIM_KEY); } catch (_) {}
      syncHash(null);
    }
  }

  function syncHash(detailId) {
    try {
      var id = normalizeDetailId(detailId);
      var next = id ? ('#claim/' + encodeURIComponent(id)) : '';
      if (String(window.location.hash || '') === next) return;
      if (next) window.history.replaceState(null, '', next);
      else if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (_) {}
  }

  window.SDLGNavState = {
    validTabs: Array.from(VALID_TABS),
    normalize: normalizeTab,
    restore: function (fallback, user) { return getState(user).tab || fallback || 'list'; },
    restoreDetailId: function (user) {
      var hashM = String(window.location.hash || '').match(/^#claim\/([^/?#]+)/i);
      if (hashM) return normalizeDetailId(decodeURIComponent(hashM[1]));
      try {
        var stored = window.localStorage.getItem(CLAIM_KEY);
        if (stored) return normalizeDetailId(stored);
      } catch (_) {}
      return getState(user).detailId;
    },
    persist: function (tab, user, detailId) {
      var id = arguments.length >= 3 ? detailId : getState(user).detailId;
      setState(tab, id, user);
    },
    persistDetailId: function (detailId, user) { setState(getState(user).tab, detailId, user); },
    clearDetail: function (user) {
      setState(getState(user).tab, null, user);
      try { window.localStorage.removeItem(CLAIM_KEY); } catch (_) {}
      try { window.localStorage.setItem(SKIP_KEY, '1'); } catch (_) {}
    }
  };

  // ─────────────────────────────────────────────────────────
  // BAGIAN 2: CLAIM RESTORE (Event-Driven, No Polling)
  // ─────────────────────────────────────────────────────────
  function isDetailPage() { return !!document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]'); }
  function extractClaimId(text) { var m = String(text || '').match(CLAIM_REGEX); return m ? m[1].toUpperCase() : ''; }

  function findClaimRow(claimId) {
    var rows = document.querySelectorAll('.claim-row');
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i].textContent || '').indexOf(claimId) >= 0) return rows[i];
    }
    var trs = document.querySelectorAll('.claims-table-shell tbody tr, table tbody tr');
    for (var j = 0; j < trs.length; j++) {
      if ((trs[j].textContent || '').indexOf(claimId) >= 0) return trs[j];
    }
    return null;
  }

  var isRestoring = false;
  function attemptRestore() {
    if (isRestoring || isDetailPage()) return;
    try { if (window.localStorage.getItem(SKIP_KEY) === '1') return; } catch (_) {}

    var id = window.SDLGNavState.restoreDetailId(null);
    if (!id) return;
    
    var row = findClaimRow(id);
    if (!row) return; // Kalau row belum muncul, observer bakal nangkep nanti

    isRestoring = true;
    if (window.SDLGNotify) window.SDLGNotify.info('Memulihkan Klaim', 'Kembali ke: ' + id);

    try {
      // Gunakan MouseEvent biar React SyntheticEvent nangkep
      row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (_) { row.click(); }

    setTimeout(function () { isRestoring = false; }, 1000);
  }

  // Event Listener (Back button / Tab click)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button, a, .nav-btn, [data-tab]');
    if (btn) {
      var label = String(btn.textContent || btn.getAttribute('data-tab') || '').toLowerCase();
      if (/kembali|back to list|semua klaim/i.test(label) || /quality|unit\s*360|master|input|overview|dashboard/i.test(label)) {
        try { window.localStorage.setItem(SKIP_KEY, '1'); } catch (_) {}
        window.SDLGNavState.clearDetail(null);
      }
    }
    var row = e.target.closest('.claim-row, .claims-table-shell tr');
    if (row && !isDetailPage()) {
      var cid = extractClaimId(row.textContent || '');
      if (cid) {
        try { window.localStorage.removeItem(SKIP_KEY); } catch (_) {}
        window.SDLGNavState.persistDetailId(cid, null);
      }
    }
  }, true);

  // Observer pintar (Cuma ngawasin list)
  function setupRestoreObserver() {
    var container = document.querySelector('.claims-list, .claims-table-shell');
    if (!container) return;
    
    var debounce;
    var obs = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(attemptRestore, 150);
    });
    obs.observe(container, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────
  // BAGIAN 3: SMART MODULE LOADER (Anti-Race Condition)
  // ─────────────────────────────────────────────────────────
  function resolveAsset(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path)) return path;
    try {
      var host = String(location.hostname || '');
      if (/github\.io$/i.test(host)) {
        var parts = String(location.pathname || '').split('/').filter(Boolean);
        if (parts.length >= 1 && parts[0].indexOf('.') < 0) {
          return '/' + parts[0] + (path.charAt(0) === '/' ? path : '/' + path);
        }
      }
    } catch (_) {}
    return path;
  }

  var loadedModules = new Set();
  function loadScript(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve();
      var src = resolveAsset(url);
      if (loadedModules.has(src) || document.querySelector('script[src="' + src + '"]')) return resolve();

      var s = document.createElement('script');
      s.src = src;
      s.async = false; // WAJIB: Biar urutan gak kacau
      s.onload = function () { loadedModules.add(src); resolve(); };
      s.onerror = function () { console.warn('[SDLG Loader] Gagal:', src); resolve(); }; // Tetep lanjut walau gagal
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function loadStylesheet(href) {
    if (!href) return;
    var src = resolveAsset(href);
    if (document.querySelector('link[href="' + src + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = src;
    (document.head || document.documentElement).appendChild(l);
  }

  // ─────────────────────────────────────────────────────────
  // BAGIAN 4: ORCHESTRATOR (Eksekusi Load)
  // ─────────────────────────────────────────────────────────
  function detectContext() {
    var page = document.querySelector('.page');
    var title = String((page && page.querySelector('.page-title')?.textContent) || '').toLowerCase();
    var activeNav = String((document.querySelector('.nav-btn.active, [data-tab].active')?.textContent) || '').toLowerCase();
    
    return {
      claimDetail: !!document.querySelector('.page.claim-detail-page'),
      claimsList: !!document.querySelector('.claims-list, .claims-table-shell'),
      sdlgInput: /sdlg/.test(title) || /sdlginput|input helper/.test(activeNav) || !!document.querySelector('[data-sdlg-field]'),
      quality: /quality|unmatched/.test(title) || /quality/.test(activeNav),
      unit360: /unit 360|360/.test(title) || /unit.?360/.test(activeNav)
    };
  }

  // File yang WAJIB ada (Loading berurutan)
  var BASE_MODULES = [
    '/modules/perf-runtime.js',
    '/modules/warranty-helper-fastpath.js',
    '/modules/claim-detail-layout-fix.js',
    '/modules/mobile-layout-fix.js',
    '/modules/feedback-person-fix.js',
    '/modules/sdlg-input-helper-ux.js',
    '/modules/machine-360.js',
    '/modules/unmatched-wo-queue.js',
    '/modules/warranty-tracking-ux.js',
    '/modules/warranty-assessment-ux.js'
  ];

  function loadContextModules() {
    var ctx = detectContext();
    if (ctx.claimDetail || ctx.claimsList) {
      loadScript('/modules/warranty-tracking-ux.js');
      loadScript('/modules/warranty-assessment-ux.js');
      loadScript('/modules/claim-detail-layout-fix.js');
    }
    if (ctx.sdlgInput) loadScript('/modules/sdlg-input-helper-ux.js');
    if (ctx.quality) loadScript('/modules/unmatched-wo-queue.js');
    if (ctx.unit360) loadScript('/modules/machine-360.js');
  }

  function boot() {
    loadStylesheet('/styles/sdlg-alive-recolor-v1.css?v=1');
    loadStylesheet('/styles/sdlg-claim-detail-clean-v2.css?v=3');

    // 1. Load base modules secara berurutan
    BASE_MODULES.reduce(function (chain, src) {
      return chain.then(function () { return loadScript(src); });
    }, Promise.resolve()).then(function () {
      console.log('[SDLG Loader] ✅ Base modules siap.');
      loadContextModules();
    });

    // 2. Claim Restore & Observer
    attemptRestore();
    setupRestoreObserver();
    
    // 3. Fallback observer (Kalau list dirender super lama)
    setTimeout(attemptRestore, 1000);
    setTimeout(attemptRestore, 2500);
  }

  // SPA Route Watcher (Event-driven, tanpa setInterval)
  function watchSPARoute() {
    var lastSig = '';
    function checkRoute() {
      var page = document.querySelector('.page');
      var sig = (page ? page.className : '') + '|' + String((page && page.querySelector('.page-title')?.textContent) || '').slice(0, 50);
      if (sig !== lastSig) {
        lastSig = sig;
        loadContextModules();
      }
    }
    
    if (window.MutationObserver) {
      var obs = new MutationObserver(function () {
        clearTimeout(window.__sdlgSpaTimer);
        window.__sdlgSpaTimer = setTimeout(checkRoute, 150);
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
    window.addEventListener('popstate', checkRoute);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot();
      watchSPARoute();
    }, { once: true });
  } else {
    boot();
    watchSPARoute();
  }

  // Export API untuk backward compatibility
  window.SDLGNavClaimRestore = {
    version: '2.0.0',
    restore: attemptRestore,
    isDetail: isDetailPage
  };
})();