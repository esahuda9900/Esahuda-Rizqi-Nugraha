/**
 * Navigation state — emergency stable (2026-10-22)
 * Hang fix: no absolute /modules/ loads, no full-document MutationObserver storm.
 * Restored behavior aligned with v12 stable path-resolve + claim restore on list only.
 */
(function () {
  'use strict';
  if (window.__SDLG_NAV_STATE_EMERGENCY__) return;
  window.__SDLG_NAV_STATE_EMERGENCY__ = true;

  var PREFIX = 'sdlg-warranty:nav:v2';
  var LEGACY_TAB = 'sdlg-warranty:last-tab:v1';
  var CLAIM_KEY = 'sdlg-warranty:last-claim:v1';
  var SKIP_KEY = 'sdlg-warranty:skip-claim-restore:v1';
  var VALID_TABS = new Set(['dashboard', 'list', 'paste', 'sdlginput', 'masters', 'quality', 'unit360']);

  function normalizeTab(value, fallback) {
    var next = String(value || '').trim();
    return VALID_TABS.has(next) ? next : (fallback || 'list');
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
  // Canonical hash routes. GitHub Pages serves one app.html, so paths live after #.
  var TAB_ROUTES = { dashboard:'overview', list:'claims', paste:'new-claim', sdlginput:'sdlg-input', masters:'master-data', quality:'data-quality', unit360:'unit360' };
  function routeFromHash() {
    var h = '';
    try { h = decodeURIComponent(String(window.location.hash || '').replace(/^#\\/?/, '')); } catch (_) { return null; }
    var match = h.match(/^claims\\/([A-Za-z0-9._:-]{4,80})\\/?$/i) || h.match(/^claim\\/([A-Za-z0-9._:-]{4,80})\\/?$/i);
    if (match) return { tab:'list', detailId:normalizeDetailId(match[1]) };
    for (var tab in TAB_ROUTES) if (h.toLowerCase() === TAB_ROUTES[tab]) return { tab:tab, detailId:null };
    if (h === 'dashboard') return { tab:'dashboard', detailId:null };
    if (h === 'list') return { tab:'list', detailId:null };
    return null;
  }
  function syncRoute(tab, detailId) {
    try {
      var id = normalizeDetailId(detailId);
      var next = id && tab === 'list' ? '#/claims/' + encodeURIComponent(id) : '#/' + (TAB_ROUTES[tab] || 'claims');
      if (window.location.hash !== next) window.history.replaceState(null, '', window.location.pathname + window.location.search + next);
    } catch (_) {}
  }

  window.SDLGNavState = {
    validTabs: Array.from(VALID_TABS),
    normalize: normalizeTab,
    routeFromHash: routeFromHash,
    restore: function (fallback, user) {
      var route = routeFromHash();
      return route ? route.tab : normalizeTab(readState(user).tab, fallback || 'list');
    },
    restoreDetailId: function (user) {
      var route = routeFromHash();
      return route ? route.detailId : null;
    },
    persist: function (tab, user, detailId) {
      // React calls persist(tab) and persist(tab,null,detailId). Keep route authoritative.
      var id = arguments.length >= 3 ? detailId : (routeFromHash()?.tab === 'list' && tab === 'list' ? routeFromHash().detailId : null);
      if (tab !== 'list') id = null;
      writeState(tab, id, user);
      if (!id) try { window.localStorage.removeItem(CLAIM_KEY); } catch (_) {}
      syncRoute(tab, id);
    },
    persistDetailId: function (detailId, user) {
      writeState('list', detailId, user);
      syncRoute('list', detailId);
    },
    clearDetail: function (user) {
      writeState('list', null, user);
      try { window.localStorage.removeItem(CLAIM_KEY); } catch (_) {}
      syncRoute('list', null);
    }
  };

  // Claim restore — list only, no progressive absolute /modules loader
  var restoring = false;
  function claimIdFromText(text) {
    var m = String(text || '').match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/i);
    return m ? m[1].toUpperCase() : '';
  }
  function isDetailPage() {
    return !!document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
  }
  function findClaimRow(claimId) {
    var nodes = document.querySelectorAll('.claim-row, .claims-table-shell tbody tr, table tbody tr');
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].textContent || '').indexOf(claimId) >= 0) return nodes[i];
    }
    return null;
  }
  function attemptRestore() {
    // Only a deep link may restore a detail. Never auto-click a stale claim
    // when the user explicitly selected Overview, New Claim or another module.
    var route = routeFromHash();
    if (!route || route.tab !== 'list' || !route.detailId || restoring || isDetailPage()) return;
    var row = findClaimRow(route.detailId);
    if (!row) return;
    restoring = true;
    try { row.click(); } catch (_) {}
    setTimeout(function () { restoring = false; }, 800);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('button, a, .nav-btn, [data-tab]');
    if (btn) {
      var label = String(btn.textContent || btn.getAttribute('data-tab') || '').toLowerCase();
      if (/kembali|back to list|semua klaim/i.test(label) || /quality|unit\s*360|master|input|overview|dashboard/i.test(label)) {
        try { window.localStorage.setItem(SKIP_KEY, '1'); } catch (_) {}
        window.SDLGNavState.clearDetail(null);
      }
    }
    var row = t.closest('.claim-row, .claims-table-shell tr');
    if (row && !isDetailPage()) {
      var cid = claimIdFromText(row.textContent || '');
      if (cid) {
        try { window.localStorage.removeItem(SKIP_KEY); } catch (_) {}
        window.SDLGNavState.persistDetailId(cid, null);
      }
    }
  }, true);

  function boot() {
    // Delayed, limited restore only — no MutationObserver on documentElement
    setTimeout(attemptRestore, 600);
    setTimeout(attemptRestore, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGNavClaimRestore = {
    version: '2026-10-22-emergency',
    restore: attemptRestore,
    isDetail: isDetailPage
  };
})();
