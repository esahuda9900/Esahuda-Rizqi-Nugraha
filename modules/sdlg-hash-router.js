/**
 * SDLG Hash Router — hierarchical routes for GitHub Pages
 * #/overview #/login #/claims #/claim/:id #/sdlg-input #/master-data #/unit360 #/data-quality #/new-claim
 */
(function (root) {
  'use strict';
  if (root.__SDLG_HASH_ROUTER_V21__) return;
  root.__SDLG_HASH_ROUTER_V21__ = true;

  var ROUTE_KEY = 'sdlg-warranty:last-route:v1';
  var CLAIM_KEY = 'sdlg-warranty:last-claim:v1';
  var INPUT_KEY = 'sdlg-warranty:last-sdlginput-claim:v1';

  var PAGE_BY_TAB = {
    dashboard: 'overview', login: 'login', list: 'claims', paste: 'new-claim',
    sdlginput: 'sdlg-input', masters: 'master-data', quality: 'data-quality', unit360: 'unit360'
  };

  function normClaim(id) {
    return String(id == null ? '' : id).trim();
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
    if (head === 'login' || head === 'signin' || head === 'auth') return { page: 'login', params: {}, subTab: '', tab: 'login' };
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
    if (page === 'login') return '#/login';
    if (page === 'overview') return '#/overview';
    if (page === 'claims') return params.year ? '#/claims/' + params.year : '#/claims';
    if (page === 'claim') {
      var id = normClaim(params.claimId);
      if (!id) return '#/claims';
      var st = String(subTab || '').toLowerCase();
      if (st === 'input') return '#/claim/' + encodeURIComponent(id) + '/input';
      if (st === 'assessment') return '#/claim/' + encodeURIComponent(id) + '/assessment';
      return '#/claim/' + encodeURIComponent(id);
    }
    if (page === 'new-claim') return '#/new-claim';
    if (page === 'sdlg-input') {
      var cid = normClaim(params.claimId);
      return cid ? '#/sdlg-input/' + encodeURIComponent(cid) : '#/sdlg-input';
    }
    if (page === 'master-data') return '#/master-data/' + (params.type || 'customers');
    if (page === 'unit360') return params.serial ? '#/unit360/' + encodeURIComponent(params.serial) : '#/unit360';
    if (page === 'data-quality') return '#/data-quality';
    return '#/overview';
  }

  function navigate(pageOrHash, params, opts) {
    opts = opts || {};
    var hash;
    if (typeof pageOrHash === 'string' && pageOrHash.charAt(0) === '#') hash = pageOrHash;
    else hash = build(pageOrHash, params, opts.subTab);
    if (opts.replace) root.location.replace(root.location.pathname + root.location.search + hash);
    else root.location.hash = hash.replace(/^#/, '#');
    try {
      var route = parse();
      root.localStorage.setItem(ROUTE_KEY, JSON.stringify({ page: route.page, params: route.params || {}, subTab: route.subTab || '' }));
      if (route.params && route.params.claimId) root.localStorage.setItem(CLAIM_KEY, route.params.claimId);
      if (route.page === 'sdlg-input' && route.params && route.params.claimId) root.localStorage.setItem(INPUT_KEY, route.params.claimId);
      try { root.dispatchEvent(new CustomEvent('sdlg-route', { detail: route })); } catch (_) {}
    } catch (_) {}
    return hash;
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

  function wireClicks() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) {
        var href = a.getAttribute('href') || '';
        if (href.indexOf('#/') === 0) return;
      }
      var btn = e.target.closest && e.target.closest('button, a, [role="tab"]');
      if (!btn || btn.classList && btn.classList.contains('nav-btn')) return;
      var label = String(btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
      var m = String(btn.getAttribute('data-claim-id') || btn.getAttribute('data-id') || '').match(/(\d{3,4}-\d{4}-SDLG-PFR)/i);
      if (m) setTimeout(function () { navigate('claim', { claimId: m[1] }, { subTab: 'overview' }); }, 0);
      if (/kembali|back to list|semua klaim/.test(label)) setTimeout(function () { navigate('claims'); }, 0);
    }, true);
  }

  root.SDLGHashRouter = {
    version: '2.1.0',
    parse: parse,
    get: parse,
    build: build,
    navigate: navigate,
    setFromTab: setFromTab,
    claimId: function () { var r = parse(); return (r.params && r.params.claimId) || ''; },
    tabForRoute: function () { return parse().tab; },
    restore: function (opts) {
      opts = opts || {};
      if (opts.mode === 'sdlginput' || opts.tab === 'sdlginput') return navigate('sdlg-input', { claimId: opts.claimId }, { replace: !!opts.replace });
      if (opts.mode === 'detail' || opts.claimId) return navigate('claim', { claimId: opts.claimId }, { subTab: 'overview', replace: !!opts.replace });
      if (opts.tab) return setFromTab(opts.tab, opts.claimId, { replace: !!opts.replace });
      return navigate(opts.page || 'overview', opts.params || {}, opts);
    }
  };

  // NavState bridge
  if (!root.SDLGNavState) root.SDLGNavState = {};
  root.SDLGNavState.setSdlgInputClaim = function (id) { navigate('sdlg-input', { claimId: id }, { replace: true }); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireClicks, { once: true });
  else wireClicks();
})(window);
