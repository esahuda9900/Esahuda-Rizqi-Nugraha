/**
 * SDLG Hash Router v2.0 — hierarchical routes for GitHub Pages
 * #/overview #/claims #/claim/:id #/sdlg-input #/master-data #/unit360 #/data-quality #/new-claim
 */
(function (root) {
  'use strict';
  if (root.__SDLG_HASH_ROUTER_V2__) return;
  root.__SDLG_HASH_ROUTER_V2__ = true;

  var CLAIM_KEY = 'sdlg-warranty:last-claim:v1';
  var TAB_KEY = 'sdlg-warranty:last-tab:v1:guest';
  var INPUT_KEY = 'sdlg-warranty:last-sdlginput-claim:v1';
  var ROUTE_KEY = 'sdlg-warranty:last-route:v2';

  var PAGE_BY_TAB = {
    dashboard: 'overview', list: 'claims', paste: 'new-claim',
    sdlginput: 'sdlg-input', masters: 'master-data', quality: 'data-quality', unit360: 'unit360'
  };

  function normClaim(id) {
    id = String(id || '').trim();
    return /^\d{3,4}-\d{4}-SDLG-PFR$/i.test(id) ? id : '';
  }

  function parse() {
    var raw = String(root.location.hash || '').replace(/^#/, '');
    if (!raw || raw === '/') return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' };

    var leg = raw.match(/^\/?claim\/([^/?#]+)(?:\/(assessment|input|overview))?$/i);
    if (leg) {
      var cid = normClaim(decodeURIComponent(leg[1]));
      var sub = (leg[2] || 'overview').toLowerCase();
      if (sub === 'input') return { page: 'sdlg-input', params: { claimId: cid }, subTab: 'input', tab: 'sdlginput' };
      return { page: 'claim', params: { claimId: cid }, subTab: sub, tab: 'list' };
    }
    leg = raw.match(/^\/?sdlginput(?:\/([^/?#]+))?$/i);
    if (leg) return { page: 'sdlg-input', params: { claimId: normClaim(leg[1] ? decodeURIComponent(leg[1]) : '') }, subTab: '', tab: 'sdlginput' };

    var parts = raw.replace(/^\//, '').split('/').filter(Boolean);
    var head = (parts[0] || 'overview').toLowerCase();
    if (head === 'overview') return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' };
    if (head === 'claims') {
      var year = parts[1] && /^\d{4}$/.test(parts[1]) ? parts[1] : '';
      return { page: 'claims', params: { year: year }, subTab: '', tab: 'list' };
    }
    if (head === 'new-claim' || head === 'paste') return { page: 'new-claim', params: {}, subTab: '', tab: 'paste' };
    if (head === 'sdlg-input') {
      return { page: 'sdlg-input', params: { claimId: parts[1] ? normClaim(decodeURIComponent(parts[1])) : '' }, subTab: '', tab: 'sdlginput' };
    }
    if (head === 'master-data' || head === 'masters') {
      return { page: 'master-data', params: { type: (parts[1] || 'customers').toLowerCase() }, subTab: (parts[1] || 'customers').toLowerCase(), tab: 'masters' };
    }
    if (head === 'unit360' || head === 'unit-360') {
      return { page: 'unit360', params: { serial: parts[1] ? decodeURIComponent(parts[1]) : '' }, subTab: '', tab: 'unit360' };
    }
    if (head === 'data-quality' || head === 'quality') return { page: 'data-quality', params: {}, subTab: '', tab: 'quality' };
    return { page: 'overview', params: {}, subTab: '', tab: 'dashboard', invalid: true, raw: raw };
  }

  function build(page, params, subTab) {
    params = params || {};
    page = String(page || 'overview').toLowerCase();
    if (page === 'overview') return '#/overview';
    if (page === 'claims') return params.year ? '#/claims/' + params.year : '#/claims';
    if (page === 'claim') {
      var id = normClaim(params.claimId);
      if (!id) return '#/claims';
      var st = (subTab || params.subTab || 'overview').toLowerCase();
      if (st === 'input') return '#/claim/' + encodeURIComponent(id) + '/input';
      if (st === 'assessment') return '#/claim/' + encodeURIComponent(id) + '/assessment';
      return '#/claim/' + encodeURIComponent(id);
    }
    if (page === 'new-claim') return '#/new-claim';
    if (page === 'sdlg-input') {
      var cid = normClaim(params.claimId);
      return cid ? '#/sdlg-input/' + encodeURIComponent(cid) : '#/sdlg-input';
    }
    if (page === 'master-data') return '#/master-data/' + encodeURIComponent((params.type || subTab || 'customers').toLowerCase());
    if (page === 'unit360') return params.serial ? '#/unit360/' + encodeURIComponent(params.serial) : '#/unit360';
    if (page === 'data-quality') return '#/data-quality';
    return '#/overview';
  }

  function apply(hash, replace) {
    try {
      var path = String(root.location.pathname || '/') + String(root.location.search || '');
      var full = path + (hash || '');
      if (path + String(root.location.hash || '') === full) return;
      if (replace) root.history.replaceState(null, '', full);
      else root.history.pushState(null, '', full);
    } catch (_) {
      try { root.location.hash = String(hash || '').replace(/^#/, ''); } catch (_e) {}
    }
  }

  function persist(route) {
    try {
      root.localStorage.setItem(ROUTE_KEY, JSON.stringify({ page: route.page, params: route.params, subTab: route.subTab, tab: route.tab, at: Date.now() }));
      root.localStorage.setItem(TAB_KEY, route.tab || 'dashboard');
      if (route.params && route.params.claimId) {
        root.localStorage.setItem(CLAIM_KEY, route.params.claimId);
        if (route.page === 'sdlg-input' || route.subTab === 'input') root.localStorage.setItem(INPUT_KEY, route.params.claimId);
      }
    } catch (_) {}
  }

  function showBottomTaskbar(route) {
    route = route || parse();
    if (route.page === 'sdlg-input') return true;
    if (route.page === 'claim' && route.subTab === 'input') return true;
    try {
      var page = document.querySelector('.page');
      if (!page) return false;
      var title = String((page.querySelector('.page-title') || {}).textContent || '').toLowerCase();
      if (/warranty claim input helper|sdlg input helper/.test(title)) return true;
    } catch (_) {}
    return false;
  }

  function navigate(pageOrHash, params, opts) {
    opts = opts || {};
    var hash;
    if (String(pageOrHash || '').charAt(0) === '#') hash = pageOrHash;
    else if (String(pageOrHash || '').charAt(0) === '/') hash = '#' + pageOrHash;
    else hash = build(pageOrHash, params || {}, opts.subTab);
    apply(hash, !!opts.replace);
    var route = parse();
    persist(route);
    try { root.dispatchEvent(new CustomEvent('sdlg-route', { detail: route })); } catch (_) {}
    return route;
  }

  function setFromTab(tab, detailId, extra) {
    extra = extra || {};
    tab = String(tab || 'dashboard');
    if (tab === 'list' && detailId) return navigate('claim', { claimId: detailId }, { subTab: extra.subTab || 'overview', replace: !!extra.replace });
    if (tab === 'sdlginput') return navigate('sdlg-input', { claimId: detailId || extra.claimId || '' }, { replace: !!extra.replace });
    if (tab === 'masters') return navigate('master-data', { type: extra.type || 'customers' }, { replace: !!extra.replace });
    if (tab === 'unit360') return navigate('unit360', { serial: extra.serial || '' }, { replace: !!extra.replace });
    if (tab === 'list' && extra.year) return navigate('claims', { year: extra.year }, { replace: !!extra.replace });
    return navigate(PAGE_BY_TAB[tab] || 'overview', {}, { replace: !!extra.replace });
  }

  (function seed() {
    try {
      var r = parse();
      persist(r);
      var h = String(root.location.hash || '');
      if (/^#claim\//i.test(h)) apply('#/' + h.replace(/^#/, ''), true);
    } catch (_) {}
  })();

  function wireNavClicks() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var row = e.target.closest('.claim-row, .claims-table-shell tbody tr');
      if (row) {
        var m = String(row.textContent || '').match(/\b(\d{3,4}-\d{4}-SDLG-PFR)\b/i);
        if (m) setTimeout(function () { navigate('claim', { claimId: m[1] }, { subTab: 'overview' }); }, 0);
      }
      var btn = e.target.closest('.nav-btn, [data-tab], button, a');
      if (!btn) return;
      var label = String(btn.getAttribute('data-tab') || btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (btn.classList.contains('nav-btn') || btn.hasAttribute('data-tab')) {
        var tab = btn.getAttribute('data-tab');
        if (!tab) {
          if (/^overview$/.test(label)) tab = 'dashboard';
          else if (/^claims/.test(label)) tab = 'list';
          else if (/new claim/.test(label)) tab = 'paste';
          else if (/sdlg input/.test(label)) tab = 'sdlginput';
          else if (/master data/.test(label)) tab = 'masters';
          else if (/data quality/.test(label)) tab = 'quality';
          else if (/unit\s*360|360/.test(label)) tab = 'unit360';
        }
        if (tab) setTimeout(function () { setFromTab(tab, null, {}); }, 0);
      }
      if (/kembali|back to list|semua klaim/.test(label)) setTimeout(function () { navigate('claims'); }, 0);
    }, true);

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'SELECT') return;
      var v = normClaim(el.value);
      if (v && document.querySelector('[data-sdlg-input-helper="1"]')) navigate('sdlg-input', { claimId: v }, { replace: true });
    }, true);
  }

  function enforceTaskbarVisibility() {
    if (showBottomTaskbar()) return;
    var bar = document.getElementById('sdlg-portal-sticky-bar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    document.documentElement.classList.remove('sdlg-has-portal-sticky');
    try {
      document.querySelectorAll('[data-sdlg-input-helper]').forEach(function (n) {
        var title = String((n.querySelector && n.querySelector('.page-title') || {}).textContent || '').toLowerCase();
        if (!/warranty claim input helper|sdlg input helper/.test(title)) n.removeAttribute('data-sdlg-input-helper');
      });
    } catch (_) {}
  }

  function boot() {
    wireNavClicks();
    enforceTaskbarVisibility();
    root.addEventListener('hashchange', function () {
      var r = parse();
      persist(r);
      try { root.dispatchEvent(new CustomEvent('sdlg-route', { detail: r })); } catch (_) {}
      enforceTaskbarVisibility();
    });
    setInterval(enforceTaskbarVisibility, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGHashRouter = {
    version: '2.0.0',
    parse: parse,
    get: parse,
    set: function (opts) {
      opts = opts || {};
      if (opts.mode === 'sdlginput' || opts.tab === 'sdlginput') return navigate('sdlg-input', { claimId: opts.claimId }, { replace: !!opts.replace });
      if (opts.mode === 'detail' || opts.claimId) return navigate('claim', { claimId: opts.claimId }, { subTab: 'overview', replace: !!opts.replace });
      if (opts.tab) return setFromTab(opts.tab, opts.claimId, { replace: !!opts.replace });
      return navigate(opts.page || 'overview', opts.params || {}, opts);
    },
    navigate: navigate,
    setFromTab: setFromTab,
    build: build,
    claimId: function () { var r = parse(); return (r.params && r.params.claimId) || ''; },
    showBottomTaskbar: showBottomTaskbar,
    tabForRoute: function () { return parse().tab; }
  };

  function patchNav() {
    if (!root.SDLGNavState) return;
    root.SDLGNavState.restoreSdlgInputClaimId = function () {
      var r = parse();
      if (r.params && r.params.claimId) return r.params.claimId;
      try { return normClaim(root.localStorage.getItem(INPUT_KEY) || root.localStorage.getItem(CLAIM_KEY) || ''); } catch (_) { return ''; }
    };
    root.SDLGNavState.setSdlgInputClaim = function (id) { navigate('sdlg-input', { claimId: id }, { replace: true }); };
  }
  patchNav();
  setTimeout(patchNav, 500);
  setTimeout(patchNav, 2000);
})(window);
