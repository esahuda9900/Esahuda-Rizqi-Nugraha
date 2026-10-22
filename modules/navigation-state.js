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
    if (restoring || isDetailPage()) return;
    try { if (window.localStorage.getItem(SKIP_KEY) === '1') return; } catch (_) {}
    var id = window.SDLGNavState.restoreDetailId(null);
    if (!id) return;
    var row = findClaimRow(id);
    if (!row) return;
    restoring = true;
    try {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (_) {
      try { row.click(); } catch (__) {}
    }
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
