/**
 * Navigation state + claim restore after refresh + progressive module loader.
 * v11: claim-restore only on Claims list; nav tabs skip restore (fix Data Quality hijack).
 * Claim-restore is embedded here because CF may not serve brand-new module files.
 */
(function () {
  'use strict';

  var PREFIX = 'sdlg-warranty:nav:v2';
  var LEGACY_TAB = 'sdlg-warranty:last-tab:v1';
  var CLAIM_KEY = 'sdlg-warranty:last-claim:v1';
  var SKIP_KEY = 'sdlg-warranty:skip-claim-restore:v1';
  var VALID_TABS = new Set(['dashboard', 'list', 'paste', 'sdlginput', 'masters', 'quality', 'unit360']);

  function normalizeTab(value, fallback) {
    var next = String(value || '').trim();
    return VALID_TABS.has(next) ? next : fallback || 'list';
  }

  function normalizeDetailId(value) {
    var id = String(value || '').trim();
    if (!id) return null;
    if (/^\d{4}-\d{4}-SDLG-PFR$/i.test(id)) return id;
    if (/^[A-Za-z0-9._:-]{4,80}$/.test(id)) return id;
    return null;
  }

  function keyFor(user) {
    var identity = String((user && (user.id || user.email)) || 'guest').trim().toLowerCase() || 'guest';
    return PREFIX + ':' + identity;
  }

  function readRaw(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeRaw(key, value) {
    try { window.localStorage.setItem(key, value); } catch (_) {}
  }

  function readState(user) {
    var raw = user ? readRaw(keyFor(user)) : null;
    if (!raw) raw = readRaw(keyFor(null));
    if (!raw) {
      var legacy = readRaw(LEGACY_TAB + ':guest') || readRaw(LEGACY_TAB);
      if (legacy) return { tab: normalizeTab(legacy, 'list'), detailId: null };
      return { tab: 'list', detailId: null };
    }
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { tab: normalizeTab(parsed.tab, 'list'), detailId: normalizeDetailId(parsed.detailId) };
      }
    } catch (_) {
      return { tab: normalizeTab(raw, 'list'), detailId: null };
    }
    return { tab: 'list', detailId: null };
  }

  function writeState(tab, detailId, user) {
    var payload = JSON.stringify({ tab: normalizeTab(tab, 'list'), detailId: normalizeDetailId(detailId), at: Date.now() });
    writeRaw(keyFor(null), payload);
    if (user) writeRaw(keyFor(user), payload);
    writeRaw(LEGACY_TAB + ':guest', normalizeTab(tab, 'list'));
    if (detailId) writeRaw(CLAIM_KEY, String(detailId));
  }

  function hashDetailId() {
    try {
      var h = String(window.location.hash || '').replace(/^#/, '');
      var m = h.match(/^claim\/([^/?#]+)/i);
      if (m) return normalizeDetailId(decodeURIComponent(m[1]));
      m = h.match(/^(\d{4}-\d{4}-SDLG-PFR)$/i);
      if (m) return normalizeDetailId(m[1]);
    } catch (_) {}
    return null;
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
    restore: function (fallback, user) {
      return normalizeTab(readState(user).tab, fallback || 'list');
    },
    restoreDetailId: function (user) {
      var fromHash = hashDetailId();
      if (fromHash) return fromHash;
      var fromClaim = normalizeDetailId(readRaw(CLAIM_KEY));
      if (fromClaim) return fromClaim;
      return readState(user).detailId;
    },
    persist: function (tab, user, detailId) {
      var id = arguments.length >= 3 ? detailId : readState(user).detailId;
      writeState(tab, id, user);
      syncHash(id);
    },
    persistDetailId: function (detailId, user) {
      writeState(readState(user).tab, detailId, user);
      syncHash(detailId);
    },
    clearDetail: function (user) {
      writeState(readState(user).tab, null, user);
      try { window.localStorage.removeItem(CLAIM_KEY); } catch (_) {}
      syncHash(null);
    }
  };

  if (!window.__SDLG_NAV_CLAIM_RESTORE__) {
    window.__SDLG_NAV_CLAIM_RESTORE__ = true;
    var restoring = false;
    var lastSaved = '';
    var searchFilledFor = '';

    function claimIdFromText(text) {
      var m = String(text || '').match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/i);
      return m ? m[1] : '';
    }

    function readStoredClaim() {
      var fromHash = hashDetailId();
      if (fromHash) return fromHash;
      return normalizeDetailId(readRaw(CLAIM_KEY)) || '';
    }

    function writeStoredClaim(id) {
      if (!id) return;
      writeRaw(CLAIM_KEY, id);
      try { window.localStorage.removeItem(SKIP_KEY); } catch (_) {}
      syncHash(id);
      lastSaved = id;
      try { writeState(readState(null).tab || 'list', id, null); } catch (_) {}
    }

    function markSkipRestore() {
      writeRaw(SKIP_KEY, '1');
      try {
        if (window.location.hash && /claim\//i.test(window.location.hash)) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch (_) {}
    }

    function shouldSkip() { return readRaw(SKIP_KEY) === '1'; }
    function isDetail() { return !!document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]'); }
    function detailClaimId() {
      var root = document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
      return root ? claimIdFromText(root.innerText || '') : '';
    }

    function isClaimsListContext() {
      try {
        if (isDetail()) return false;
        var page = document.querySelector('.page');
        var title = '';
        if (page) {
          var pt = page.querySelector('.page-title, h1, h2');
          title = String((pt && pt.textContent) || page.getAttribute('data-page') || '').toLowerCase();
        }
        if (/data quality|unmatched|unit\s*360|master data|sdlg input|new claim|overview|dashboard|paste|quality/.test(title)) {
          return false;
        }
        var nav = document.querySelector('.nav-btn.active, [data-tab].active, button[aria-current="page"]');
        var navLabel = String((nav && (nav.getAttribute('data-tab') || nav.textContent)) || '').toLowerCase();
        if (/quality|unit\s*360|360|master|sdlg\s*input|input helper|new claim|overview|dashboard|paste/.test(navLabel)) {
          return false;
        }
        if (/claims|klaim|list/.test(navLabel)) return true;
        if (document.querySelector('.claims-table-shell, .claims-list, table.claims-table')) return true;
        if (/claims|klaim/.test(title)) return true;
        return false;
      } catch (_) {
        return false;
      }
    }

    function isTopNavTabClick(el) {
      if (!el) return false;
      var btn = el.closest('.nav-btn, [data-tab], header button, nav button');
      if (!btn) return false;
      var label = String(btn.getAttribute('data-tab') || btn.textContent || '').toLowerCase().replace(/\s+/g, ' ');
      if (/data quality|quality|unit\s*360|\b360\b|master data|masters|sdlg input|input helper|new claim|overview|dashboard|paste|dealer portal/.test(label)) {
        return true;
      }
      return false;
    }

    function findClaimRow(claimId) {
      var rows = document.querySelectorAll('.claim-row');
      for (var i = 0; i < rows.length; i++) {
        if ((rows[i].textContent || '').indexOf(claimId) >= 0) return rows[i];
      }
      var shell = document.querySelector('.claims-table-shell');
      if (!shell) return null;
      var trs = shell.querySelectorAll('tbody tr');
      for (var j = 0; j < trs.length; j++) {
        if ((trs[j].textContent || '').indexOf(claimId) >= 0) return trs[j];
      }
      return null;
    }

    function fillSearch(id) {
      if (searchFilledFor === id) return false;
      if (!isClaimsListContext()) return false;
      var inputs = document.querySelectorAll('input[placeholder], input[type="search"], input[type="text"]');
      var target = null;
      for (var i = 0; i < inputs.length; i++) {
        var ph = String(inputs[i].getAttribute('placeholder') || '').toLowerCase();
        if (/cari|search|claim|serial|customer/.test(ph)) { target = inputs[i]; break; }
      }
      if (!target) return false;
      try {
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(target, id);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        searchFilledFor = id;
        return true;
      } catch (_) {
        try {
          target.value = id;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          searchFilledFor = id;
          return true;
        } catch (e2) { return false; }
      }
    }

    function tryRestore() {
      if (restoring || isDetail() || shouldSkip()) return;
      if (!isClaimsListContext()) return;
      var id = readStoredClaim();
      if (!id) return;
      var row = findClaimRow(id);
      if (!row) {
        fillSearch(id);
        row = findClaimRow(id);
      }
      if (!row) return;
      restoring = true;
      try { row.click(); } catch (_) {}
      setTimeout(function () { restoring = false; }, 1200);
    }

    function onTick() {
      if (isDetail()) {
        var id = detailClaimId();
        if (id && id !== lastSaved) writeStoredClaim(id);
        return;
      }
      if (!isClaimsListContext()) return;
      tryRestore();
    }

    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var btn = e.target.closest('button,a,.nav-btn,[data-tab]');
      var label = btn ? String(btn.textContent || btn.getAttribute('data-tab') || '') : '';
      if (/kembali|back to list|semua klaim/i.test(label) && isDetail()) markSkipRestore();
      if (isTopNavTabClick(e.target) || (/kembali|back to list|semua klaim/i.test(label))) {
        markSkipRestore();
        try {
          if (window.SDLGNavState && typeof window.SDLGNavState.clearDetail === 'function') {
            window.SDLGNavState.clearDetail(null);
          } else {
            writeRaw(CLAIM_KEY, '');
            try { window.localStorage.removeItem(CLAIM_KEY); } catch (_e) {}
            syncHash(null);
          }
        } catch (_) {}
      }
      var row = e.target.closest('.claim-row, .claims-table-shell tr');
      if (row && !isDetail() && isClaimsListContext()) {
        var cid = claimIdFromText(row.textContent || '');
        if (cid) {
          try { window.localStorage.removeItem(SKIP_KEY); } catch (_) {}
          writeStoredClaim(cid);
        }
      }
    }, true);

    var timer = null;
    function schedule() { clearTimeout(timer); timer = setTimeout(onTick, 100); }

    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    }

    var tries = 0;
    (function bootLoop() {
      onTick();
      if (!isDetail() && isClaimsListContext() && readStoredClaim() && !shouldSkip() && tries < 60) {
        tries += 1;
        setTimeout(bootLoop, 200);
      }
    })();

    window.SDLGNavClaimRestore = { version: '1.3-nav-guard', get: readStoredClaim, save: writeStoredClaim, clear: markSkipRestore, restore: tryRestore, isClaimsListContext: isClaimsListContext };
  }

  function loadScript(src, marker) {
    if (typeof document === 'undefined') return;
    if (document.querySelector('script[' + marker + ']')) return;
    var existing = document.querySelectorAll('script[src]');
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getAttribute('src') === src) return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute(marker, '1');
    (document.head || document.documentElement).appendChild(s);
  }

  function loadStylesheet(href, marker) {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[' + marker + ']')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    (document.head || document.documentElement).appendChild(link);
  }

  function whenIdle(fn, timeoutMs) {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(function () { fn(); }, { timeout: timeoutMs || 2500 });
    else setTimeout(fn, Math.min(timeoutMs || 2500, 1200));
  }

  function detectContext() {
    var page = document.querySelector('.page');
    var title = '';
    var pageText = '';
    try { title = String((page && page.querySelector('.page-title') && page.querySelector('.page-title').textContent) || '').toLowerCase(); } catch (_) {}
    try { pageText = String((page && page.textContent) || '').slice(0, 800).toLowerCase(); } catch (_) {}

    var activeNav = '';
    try {
      var nav = document.querySelector('.nav-btn.active, [data-tab].active, button[aria-current="page"]');
      activeNav = String((nav && (nav.getAttribute('data-tab') || nav.textContent)) || '').toLowerCase();
    } catch (_) {}

    var sdlgInput =
      (/sdlg/.test(title) && /input|helper|portal|dealer/.test(title)) ||
      /sdlginput|sdlg input|input helper|dealer portal/.test(activeNav) ||
      !!(page && page.getAttribute('data-sdlg-input-helper') === '1') ||
      /warranty claim input helper|dealer portal input|sdlg input helper/.test(pageText) ||
      !!document.querySelector('[data-sdlg-field], #sdlg-input-portal-extras, #sdlg-input-selected-bar');

    return {
      claimDetail: !!(page && page.classList && page.classList.contains('claim-detail-page')),
      claimsList: !!document.querySelector('.claims-list, .claims-table-shell'),
      sdlgInput: sdlgInput,
      quality: /data quality|unmatched|quality/.test(title) || /quality/.test(activeNav),
      unit360: /unit 360|360/.test(title) || /unit.?360|360/.test(activeNav),
      masters: /master/.test(title) || /master/.test(activeNav)
    };
  }

  loadStylesheet('/styles/sdlg-alive-recolor-v1.css?v=1', 'data-sdlg-alive-recolor');
  loadStylesheet('/styles/sdlg-claim-detail-clean-v2.css?v=3', 'data-sdlg-claim-detail-clean');

  loadScript('/modules/perf-runtime.js', 'data-sdlg-perf-runtime');
  loadScript('/modules/warranty-helper-fastpath.js', 'data-sdlg-helper-fastpath');

  function loadCoreEnhancements() {
    loadScript('/modules/ops-clean-ui.js', 'data-sdlg-ops-clean');
    loadScript('/modules/claim-detail-layout-fix.js', 'data-sdlg-claim-detail-layout');
    loadScript('/modules/policy-runtime-fix.js', 'data-sdlg-policy-runtime-fix');
    loadScript('/modules/mobile-layout-fix.js', 'data-sdlg-mobile-layout');
    loadScript('/modules/feedback-person-fix.js', 'data-sdlg-feedback-person');
    loadScript('/modules/sdlg-input-helper-ux.js', 'data-sdlg-input-helper');
    loadScript('/modules/machine-360.js', 'data-sdlg-machine-360');
    loadScript('/modules/unmatched-wo-queue.js', 'data-sdlg-unmatched-wo');
    loadScript('/modules/warranty-tracking-ux.js', 'data-sdlg-warranty-tracking');
    loadScript('/modules/warranty-assessment-ux.js', 'data-sdlg-warranty-assessment');
  }

  function loadContextual() {
    var ctx = detectContext();
    if (ctx.claimDetail || ctx.claimsList) {
      loadScript('/modules/warranty-tracking-ux.js', 'data-sdlg-warranty-tracking');
      loadScript('/modules/warranty-assessment-ux.js', 'data-sdlg-warranty-assessment');
      loadScript('/modules/claim-detail-layout-fix.js', 'data-sdlg-claim-detail-layout');
    }
    if (ctx.sdlgInput) loadScript('/modules/sdlg-input-helper-ux.js', 'data-sdlg-input-helper');
    if (ctx.quality) loadScript('/modules/unmatched-wo-queue.js', 'data-sdlg-unmatched-wo');
    if (ctx.unit360) loadScript('/modules/machine-360.js', 'data-sdlg-machine-360');
  }

  function scheduleAll() {
    whenIdle(function () { loadCoreEnhancements(); loadContextual(); }, 800);
    whenIdle(function () { loadScript('/modules/self-signup.js', 'data-sdlg-self-signup'); }, 4000);
    setTimeout(loadContextual, 1500);
    setTimeout(loadContextual, 3000);
  }

  function bindNav() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var hit = e.target.closest('.nav-btn') || e.target.closest('[data-tab]') || e.target.closest('a') || e.target.closest('.claim-row') || e.target.closest('tr');
      if (!hit) return;

      var label = String(hit.getAttribute('data-tab') || hit.textContent || '').toLowerCase();

      loadScript('/modules/warranty-helper-fastpath.js', 'data-sdlg-helper-fastpath');
      loadScript('/modules/warranty-assessment-ux.js', 'data-sdlg-warranty-assessment');
      loadScript('/modules/warranty-tracking-ux.js', 'data-sdlg-warranty-tracking');

      if (/sdlginput|sdlg input|input helper|dealer portal|portal/.test(label)) {
        loadScript('/modules/sdlg-input-helper-ux.js', 'data-sdlg-input-helper');
      }
      if (/quality|unmatched/.test(label)) {
        loadScript('/modules/unmatched-wo-queue.js', 'data-sdlg-unmatched-wo');
      }
      if (/unit.?360|360/.test(label)) {
        loadScript('/modules/machine-360.js', 'data-sdlg-machine-360');
      }

      setTimeout(loadContextual, 80);
      setTimeout(loadContextual, 250);
      setTimeout(loadContextual, 600);
      setTimeout(loadContextual, 1200);
    }, true);
  }

  function bindSpaRouteWatch() {
    if (window.__SDLG_SPA_ROUTE_WATCH__) return;
    window.__SDLG_SPA_ROUTE_WATCH__ = true;
    var lastSig = '';
    function tick() {
      try {
        var page = document.querySelector('.page');
        var title = page && page.querySelector('.page-title') ? String(page.querySelector('.page-title').textContent || '') : '';
        var cls = page ? String(page.className || '') : '';
        var sig = cls + '|' + title.slice(0, 80);
        if (sig !== lastSig) {
          lastSig = sig;
          loadContextual();
        }
      } catch (_) {}
    }
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () {
        clearTimeout(window.__sdlgSpaRouteTimer);
        window.__sdlgSpaRouteTimer = setTimeout(tick, 120);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    setInterval(tick, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scheduleAll(); bindNav(); bindSpaRouteWatch(); }, { once: true });
  } else {
    scheduleAll();
    bindNav();
    bindSpaRouteWatch();
  }
})();
