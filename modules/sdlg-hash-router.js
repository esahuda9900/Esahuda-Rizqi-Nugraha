/**
 * SDLG Hash Router v1.0 — GitHub Pages–safe routing
 * Formats:
 *   #/list | #/dashboard | #/paste | #/masters | #/quality | #/unit360
 *   #/claim/0250-2026-SDLG-PFR
 *   #/sdlginput/0250-2026-SDLG-PFR
 * Legacy: #claim/ID
 */
(function (root) {
  'use strict';
  if (root.__SDLG_HASH_ROUTER_V1__) return;
  root.__SDLG_HASH_ROUTER_V1__ = true;

  var CLAIM_KEY = 'sdlg-warranty:last-claim:v1';
  var TAB_KEY = 'sdlg-warranty:last-tab:v1:guest';
  var INPUT_KEY = 'sdlg-warranty:last-sdlginput-claim:v1';
  var VALID_TABS = {
    dashboard: true, list: true, claims: true, paste: true,
    sdlginput: true, masters: true, quality: true, unit360: true
  };

  function normClaim(id) {
    id = String(id || '').trim();
    if (/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(id)) return id;
    return '';
  }

  function normTab(t) {
    t = String(t || '').trim().toLowerCase();
    if (t === 'claims') t = 'list';
    return VALID_TABS[t] ? t : '';
  }

  function parseHash() {
    var h = String(root.location.hash || '').replace(/^#/, '');
    if (!h) return { tab: '', claimId: '', mode: '' };
    var m = h.match(/^\/?(sdlginput|claim)\/([^/?#]+)/i);
    if (m) {
      return {
        tab: m[1].toLowerCase() === 'sdlginput' ? 'sdlginput' : 'list',
        claimId: normClaim(decodeURIComponent(m[2])),
        mode: m[1].toLowerCase() === 'sdlginput' ? 'sdlginput' : 'detail'
      };
    }
    m = h.match(/^\/?([a-z0-9_-]+)\/?$/i);
    if (m && normTab(m[1])) {
      return { tab: normTab(m[1]), claimId: '', mode: 'tab' };
    }
    m = h.match(/^\/?(\d{3,4}-\d{4}-SDLG-PFR)$/i);
    if (m) return { tab: 'list', claimId: normClaim(m[1]), mode: 'detail' };
    return { tab: '', claimId: '', mode: '' };
  }

  function buildHash(tab, claimId, mode) {
    claimId = normClaim(claimId);
    tab = normTab(tab) || 'list';
    if (mode === 'sdlginput' || tab === 'sdlginput') {
      return claimId ? '#/sdlginput/' + encodeURIComponent(claimId) : '#/sdlginput';
    }
    if (mode === 'detail' || (claimId && tab === 'list')) {
      return claimId ? '#/claim/' + encodeURIComponent(claimId) : '#/list';
    }
    if (tab === 'claims') tab = 'list';
    return '#/' + tab;
  }

  function applyHash(hash, replace) {
    try {
      var path = String(root.location.pathname || '/') + String(root.location.search || '');
      var full = path + (hash || '');
      var cur = path + String(root.location.hash || '');
      if (cur === full) return;
      if (replace) root.history.replaceState(null, '', full);
      else root.history.pushState(null, '', full);
    } catch (_) {
      try { root.location.hash = String(hash || '').replace(/^#/, ''); } catch (_e) {}
    }
  }

  function persistLocal(tab, claimId, mode) {
    try {
      if (tab) root.localStorage.setItem(TAB_KEY, normTab(tab) || 'list');
      if (claimId) root.localStorage.setItem(CLAIM_KEY, claimId);
      if (mode === 'sdlginput' && claimId) root.localStorage.setItem(INPUT_KEY, claimId);
      if (mode === 'detail' && claimId) root.localStorage.setItem(CLAIM_KEY, claimId);
    } catch (_) {}
  }

  function readLocalClaim() {
    try { return normClaim(root.localStorage.getItem(CLAIM_KEY) || root.localStorage.getItem(INPUT_KEY) || ''); }
    catch (_) { return ''; }
  }

  function readLocalInputClaim() {
    try {
      return normClaim(root.localStorage.getItem(INPUT_KEY) || root.localStorage.getItem(CLAIM_KEY) || '');
    } catch (_) { return ''; }
  }

  function setRoute(opts) {
    opts = opts || {};
    var tab = normTab(opts.tab) || 'list';
    var claimId = normClaim(opts.claimId);
    var mode = opts.mode || (tab === 'sdlginput' ? 'sdlginput' : (claimId ? 'detail' : 'tab'));
    var replace = !!opts.replace;
    persistLocal(tab, claimId, mode);
    applyHash(buildHash(tab, claimId, mode), replace);
    try {
      if (root.SDLGNavState && typeof root.SDLGNavState.persist === 'function') {
        root.SDLGNavState.persist(
          tab === 'sdlginput' ? 'sdlginput' : tab,
          null,
          claimId || null
        );
      }
    } catch (_) {}
    try {
      root.dispatchEvent(new CustomEvent('sdlg-route', { detail: parseHash() }));
    } catch (_) {}
  }

  function getRoute() {
    var p = parseHash();
    if (!p.claimId && !p.tab) {
      p.claimId = readLocalClaim();
      p.tab = 'list';
      if (p.claimId) p.mode = 'detail';
    }
    if (p.tab === 'sdlginput' && !p.claimId) p.claimId = readLocalInputClaim();
    return p;
  }

  function patchNavState() {
    if (!root.SDLGNavState) return;
    var orig = root.SDLGNavState.persistDetailId;
    root.SDLGNavState.persistDetailId = function (detailId, user) {
      if (typeof orig === 'function') orig(detailId, user);
      var id = normClaim(detailId);
      if (id) applyHash(buildHash('list', id, 'detail'), true);
      else applyHash('#/list', true);
    };
    root.SDLGNavState.restoreSdlgInputClaimId = function () {
      var p = parseHash();
      if (p.mode === 'sdlginput' && p.claimId) return p.claimId;
      if (p.claimId) return p.claimId;
      return readLocalInputClaim();
    };
    root.SDLGNavState.setSdlgInputClaim = function (id) {
      setRoute({ tab: 'sdlginput', claimId: id, mode: 'sdlginput', replace: true });
    };
  }

  function wireClicks() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var row = e.target.closest('.claim-row, .claims-table-shell tbody tr');
      if (row) {
        var m = String(row.textContent || '').match(/\b(\d{3,4}-\d{4}-SDLG-PFR)\b/i);
        if (m) setRoute({ tab: 'list', claimId: m[1], mode: 'detail', replace: false });
      }
      var btn = e.target.closest('button, a, .nav-btn, [data-tab]');
      if (btn) {
        var label = String(btn.textContent || btn.getAttribute('data-tab') || '').toLowerCase();
        if (/sdlg input|input helper/.test(label)) {
          var cid = readLocalClaim() || readLocalInputClaim();
          setTimeout(function () {
            setRoute({ tab: 'sdlginput', claimId: cid, mode: 'sdlginput', replace: true });
          }, 0);
        }
        if (/^claims$|^klaim$|semua klaim|back to list|kembali/.test(label.trim())) {
          setRoute({ tab: 'list', claimId: '', mode: 'tab', replace: true });
        }
      }
    }, true);

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'SELECT') return;
      var v = normClaim(el.value);
      if (!v) return;
      if (document.querySelector('[data-sdlg-input-helper]')) {
        setRoute({ tab: 'sdlginput', claimId: v, mode: 'sdlginput', replace: true });
      }
    }, true);
  }

  function boot() {
    patchNavState();
    wireClicks();
    var p = parseHash();
    if (p.claimId) persistLocal(p.tab || 'list', p.claimId, p.mode || 'detail');
    root.addEventListener('hashchange', function () {
      var r = parseHash();
      if (r.claimId) persistLocal(r.tab || 'list', r.claimId, r.mode || 'detail');
      try { root.dispatchEvent(new CustomEvent('sdlg-route', { detail: r })); } catch (_) {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGHashRouter = {
    version: '1.0.0',
    parse: parseHash,
    get: getRoute,
    set: setRoute,
    claimId: function () { return getRoute().claimId; },
    build: buildHash
  };
})(window);
