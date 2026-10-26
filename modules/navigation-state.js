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
    try { h = decodeURIComponent(String(window.location.hash || '').replace(/^#\/?/, '')); } catch (_) { return null; }
    var match = h.match(/^claims\/([A-Za-z0-9._:-]{4,80})\/?$/i) || h.match(/^claim\/([A-Za-z0-9._:-]{4,80})\/?$/i);
    if (match) return { tab:'list', detailId:normalizeDetailId(match[1]) };
    var portal = h.match(/^sdlg-input\/([A-Za-z0-9._:-]{4,80})\/?$/i);
    if (portal) return { tab:'sdlginput', detailId:null, portalClaimId:normalizeDetailId(portal[1]) };
    for (var tab in TAB_ROUTES) if (h.toLowerCase() === TAB_ROUTES[tab]) return { tab:tab, detailId:null };
    if (h === 'dashboard') return { tab:'dashboard', detailId:null };
    if (h === 'list') return { tab:'list', detailId:null };
    return null;
  }
  function syncRoute(tab, detailId) {
    try {
      var id = normalizeDetailId(detailId);
      var existing = routeFromHash();
      var next = id && tab === 'list' ? '#/claims/' + encodeURIComponent(id)
        : tab === 'sdlginput' && existing?.tab === 'sdlginput' && existing.portalClaimId ? '#/sdlg-input/' + encodeURIComponent(existing.portalClaimId)
        : '#/' + (TAB_ROUTES[tab] || 'claims');
      if (window.location.hash !== next) window.history.replaceState(null, '', window.location.pathname + window.location.search + next);
    } catch (_) {}
  }

  window.SDLGNavState = {
    validTabs: Array.from(VALID_TABS),
    normalize: normalizeTab,
    routeFromHash: routeFromHash,
    setPortalClaimId: function (id) {
      var claimId = normalizeDetailId(id);
      var next = '#/sdlg-input' + (claimId ? '/' + encodeURIComponent(claimId) : '');
      try { if (window.location.hash !== next) window.history.replaceState(null, '', window.location.pathname + window.location.search + next); } catch (_) {}
    },
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

  // React owns navigation and claim identity. Never simulate row clicks or
  // infer routes from button text: those mechanisms caused cross-claim jumps.
  window.SDLGNavClaimRestore = Object.freeze({
    version: '2026-10-26-url-authoritative',
    restore: function () { return routeFromHash(); },
    isDetail: function () { var r = routeFromHash(); return !!(r && r.tab === 'list' && r.detailId); }
  });
})();
