/**
 * SDLG Hash Router — V3.0 (Enterprise Router)
 * Hierarchical routes for GitHub Pages & Cloudflare.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ DATA-DRIVEN ROUTES: Parse function jauh lebih bersih.
 * ✅ SAFE CLICK WIRE: Cuma intercept elemen spesifik.
 * ✅ AUTO TITLE: document.title update otomatis.
 * ✅ AUTO SCROLL: Scroll ke atas tiap pindah halaman.
 * ✅ DEBOUNCED STORAGE: Hemat write localStorage.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_HASH_ROUTER_V3__) return;
  root.__SDLG_HASH_ROUTER_V3__ = true;
  root.__SDLG_HASH_ROUTER_V221__ = true; // Backward compat

  var ROUTE_KEY = 'sdlg-warranty:last-route:v2';
  var CLAIM_KEY = 'sdlg-warranty:last-claim:v2';
  var INPUT_KEY = 'sdlg-warranty:last-sdlginput-claim:v2';

  var PAGE_BY_TAB = {
    dashboard: 'overview', login: 'login', list: 'claims', paste: 'new-claim',
    sdlginput: 'sdlg-input', masters: 'master-data', quality: 'data-quality', unit360: 'unit360'
  };

  // Pre-compiled Regex
  var RE_LEGACY = /^\/claim\/([^/?#]+)(?:\/(assessment|input|overview))?$/i;
  var RE_INPUT = /^\/sdlginput(?:\/([^/?#]+))?$/i;
  var RE_YEAR = /^\d{4}$/;
  var RE_CLAIM_ID = /SDLG-PFR/i;
  var RE_CLAIM_GEN = /\d{3,4}-\d{4}/;

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES
  // ─────────────────────────────────────────────────────────
  function normClaim(id) { return String(id == null ? '' : id).trim(); }
  function isYear(s) { return RE_YEAR.test(String(s || '')); }
  
  function isClaimId(s) {
    s = String(s || '').trim();
    if (!s || isYear(s)) return false;
    return RE_CLAIM_ID.test(s) || RE_CLAIM_GEN.test(s) || s.length > 6;
  }

  // Deferred Save ke localStorage (anti-blocking)
  function saveState(route) {
    var doSave = function() {
      try {
        root.localStorage.setItem(ROUTE_KEY, JSON.stringify({ page: route.page, params: route.params, subTab: route.subTab }));
        if (route.params && route.params.claimId) root.localStorage.setItem(CLAIM_KEY, route.params.claimId);
        if (route.page === 'sdlg-input' && route.params && route.params.claimId) root.localStorage.setItem(INPUT_KEY, route.params.claimId);
      } catch (_) {}
    };
    
    if (root.requestIdleCallback) root.requestIdleCallback(doSave);
    else setTimeout(doSave, 50);
  }

  // Update document title
  function updateTitle(route) {
    var title = 'SDLG Warranty';
    if (route.page === 'claim') title = 'Klaim ' + (route.params.claimId || '') + ' · SDLG';
    else if (route.page === 'claims') title = 'Daftar Klaim · SDLG';
    else if (route.page === 'login') title = 'Login · SDLG';
    else if (route.page === 'sdlg-input') title = 'Input Helper · SDLG';
    else if (route.page === 'unit360') title = 'Unit 360 · SDLG';
    else if (route.page === 'data-quality') title = 'Data Quality · SDLG';
    else if (route.page === 'master-data') title = 'Master Data · SDLG';
    
    if (document.title !== title) document.title = title;
  }

  // ─────────────────────────────────────────────────────────
  // 2. PARSER (Data-Driven)
  // ─────────────────────────────────────────────────────────
  function parse() {
    var raw = String(root.location.hash || '').replace(/^#/, '');
    if (raw && raw.charAt(0) !== '/') raw = '/' + raw;
    
    // Default Route
    if (!raw || raw === '/') return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' };

    var m;

    // 1. Legacy Claim Route
    if ((m = raw.match(RE_LEGACY))) {
      var cid0 = normClaim(decodeURIComponent(m[1]));
      var sub0 = (m[2] || 'overview').toLowerCase();
      if (sub0 === 'input') return { page: 'sdlg-input', params: { claimId: cid0 }, subTab: 'input', tab: 'sdlginput' };
      return { page: 'claim', params: { claimId: cid0 }, subTab: sub0, tab: 'list' };
    }

    // 2. Input Route (Legacy)
    if ((m = raw.match(RE_INPUT))) {
      return {
        page: 'sdlg-input',
        params: { claimId: m[1] ? normClaim(decodeURIComponent(m[1])) : '' },
        subTab: '',
        tab: 'sdlginput'
      };
    }

    // 3. Standard Routes
    var parts = raw.replace(/^\//, '').split('/').filter(Boolean);
    var head = (parts[0] || 'overview').toLowerCase();

    if (head === 'login' || head === 'signin' || head === 'auth') {
      return { page: 'login', params: {}, subTab: '', tab: 'login' };
    }
    if (head === 'overview') {
      return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' };
    }

    if (head === 'claims') {
      var p1 = parts[1] ? decodeURIComponent(parts[1]) : '';
      var p2 = parts[2] ? String(parts[2]).toLowerCase() : '';
      
      if (p1 && isClaimId(p1)) {
        if (p2 === 'input') return { page: 'sdlg-input', params: { claimId: normClaim(p1) }, subTab: 'input', tab: 'sdlginput' };
        return { page: 'claim', params: { claimId: normClaim(p1) }, subTab: p2 === 'assessment' ? 'assessment' : 'overview', tab: 'list' };
      }
      if (p1 && isYear(p1)) return { page: 'claims', params: { year: p1 }, subTab: '', tab: 'list' };
      return { page: 'claims', params: {}, subTab: '', tab: 'list' };
    }

    if (head === 'new-claim' || head === 'paste') {
      return { page: 'new-claim', params: {}, subTab: '', tab: 'paste' };
    }
    if (head === 'sdlg-input') {
      return { page: 'sdlg-input', params: { claimId: parts[1] ? normClaim(decodeURIComponent(parts[1])) : '' }, subTab: '', tab: 'sdlginput' };
    }
    if (head === 'master-data' || head === 'masters') {
      return { page: 'master-data', params: { type: parts[1] || 'customers' }, subTab: '', tab: 'masters' };
    }
    if (head === 'data-quality' || head === 'quality') {
      return { page: 'data-quality', params: {}, subTab: '', tab: 'quality' };
    }
    if (head === 'unit360' || head === 'unit') {
      return { page: 'unit360', params: { serial: parts[1] ? decodeURIComponent(parts[1]) : '' }, subTab: '', tab: 'unit360' };
    }

    return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' };
  }

  // ─────────────────────────────────────────────────────────
  // 3. BUILDER & NAVIGATOR
  // ─────────────────────────────────────────────────────────
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
      if (st === 'input') return '#/sdlg-input/' + encodeURIComponent(id);
      if (st === 'assessment') return '#/claims/' + encodeURIComponent(id) + '/assessment';
      return '#/claims/' + encodeURIComponent(id);
    }
    
    if (page === 'new-claim') return '#/new-claim';
    if (page === 'sdlg-input') {
      var cid = normClaim(params.claimId);
      return cid ? '#/sdlg-input/' + encodeURIComponent(cid) : '#/sdlg-input';
    }
    if (page === 'master-data') return '#/master-data/' + encodeURIComponent(params.type || 'customers');
    if (page === 'data-quality') return '#/data-quality';
    if (page === 'unit360') return params.serial ? '#/unit360/' + encodeURIComponent(params.serial) : '#/unit360';
    
    return '#/overview';
  }

  function navigate(pageOrHash, params, opts) {
    opts = opts || {};
    var hash;
    
    if (typeof pageOrHash === 'string' && pageOrHash.charAt(0) === '#') {
      hash = pageOrHash;
      if (/^#claim\//i.test(hash)) hash = '#/' + hash.slice(1);
    } else {
      hash = build(pageOrHash, params, opts.subTab);
    }
    
    if (hash.charAt(0) === '#' && hash.charAt(1) !== '/') {
      hash = '#/' + hash.slice(1);
    }
    
    var target = root.location.pathname + root.location.search + hash;
    var current = root.location.pathname + root.location.search + String(root.location.hash || '');

    if (current === target) return; // Udah di halaman ini

    if (opts.replace) {
      root.location.replace(target);
    } else {
      root.location.hash = hash.replace(/^#/, '');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. EVENT HOOKS & WATCHERS
  // ─────────────────────────────────────────────────────────
  
  // Listener saat hash berubah
  function onRouteChange() {
    var route = parse();
    saveState(route);
    updateTitle(route);
    
    // Smooth scroll ke atas
    if (root.scrollTo) {
      try { root.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { root.scrollTo(0, 0); }
    }
    
    // Beritahu seluruh aplikasi
    try {
      root.dispatchEvent(new CustomEvent('sdlg-route-changed', { detail: route }));
    } catch (_) {}
  }

  // Safe Click Hijacking
  function wireClicks() {
    if (root.__SDLG_ROUTER_CLICKS__) return;
    root.__SDLG_ROUTER_CLICKS__ = true;

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-claim-id], [data-route], button, a');
      if (!el) return;

      // 1. Cek data-claim-id (paling aman)
      var claimId = el.getAttribute('data-claim-id');
      if (claimId) {
        e.preventDefault();
        navigate('claim', { claimId: claimId }, { subTab: 'overview' });
        return;
      }

      // 2. Cek data-route
      var route = el.getAttribute('data-route');
      if (route) {
        e.preventDefault();
        navigate(route);
        return;
      }

      // 3. Tombol Back / Kembali
      var label = String(el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (/kembali|back to list|semua klaim/.test(label)) {
        var currentRoute = parse();
        // Hanya hijack kalau sedang di halaman claim
        if (currentRoute.page === 'claim' || currentRoute.page === 'sdlg-input') {
          e.preventDefault();
          navigate('claims');
        }
      }
    }, false); // Ubah ke false (bubble phase) biar gak tabrakan React
  }

  // ─────────────────────────────────────────────────────────
  // 5. PUBLIC API (Backward Compatible)
  // ─────────────────────────────────────────────────────────
  root.SDLGHashRouter = Object.freeze({
    version: '3.0.0',
    parse: parse,
    get: parse,
    build: build,
    navigate: navigate,
    setFromTab: function (tab, detailId, extra) {
      extra = extra || {};
      if (tab === 'list' && detailId) return navigate('claim', { claimId: detailId }, { subTab: extra.subTab || 'overview', replace: !!extra.replace });
      if (tab === 'sdlginput') return navigate('sdlg-input', { claimId: detailId || extra.claimId || '' }, { replace: !!extra.replace });
      if (tab === 'masters') return navigate('master-data', { type: extra.type || 'customers' }, { replace: !!extra.replace });
      if (tab === 'unit360') return navigate('unit360', { serial: extra.serial || '' }, { replace: !!extra.replace });
      if (tab === 'list' && extra.year) return navigate('claims', { year: extra.year }, { replace: !!extra.replace });
      return navigate(PAGE_BY_TAB[tab] || 'overview', {}, { replace: !!extra.replace });
    },
    claimId: function () {
      var r = parse();
      return (r.params && r.params.claimId) || '';
    },
    tabForRoute: function () {
      return parse().tab;
    },
    restore: function (opts) {
      opts = opts || {};
      if (opts.mode === 'sdlginput' || opts.tab === 'sdlginput') return navigate('sdlg-input', { claimId: opts.claimId }, { replace: !!opts.replace });
      if (opts.mode === 'detail' || opts.claimId) return navigate('claim', { claimId: opts.claimId }, { subTab: 'overview', replace: !!opts.replace });
      if (opts.tab) return root.SDLGHashRouter.setFromTab(opts.tab, opts.claimId, { replace: !!opts.replace });
      return navigate(opts.page || 'overview', opts.params || {}, opts);
    }
  });

  // Fallback NavState
  if (!root.SDLGNavState) root.SDLGNavState = {};
  root.SDLGNavState.setSdlgInputClaim = function (id) {
    navigate('sdlg-input', { claimId: id }, { replace: true });
  };
  root.SDLGNavState.restoreDetailId = function () {
    try {
      var r = parse();
      if (r && r.page === 'claim' && r.params && r.params.claimId) return normClaim(r.params.claimId);
    } catch (_) {}
    return null;
  };
  root.SDLGNavState.persist = root.SDLGNavState.persist || function () {};

  // ─────────────────────────────────────────────────────────
  // 6. INIT
  // ─────────────────────────────────────────────────────────
  root.addEventListener('hashchange', onRouteChange);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      wireClicks();
      onRouteChange(); // Run initial parse
    }, { once: true });
  } else {
    wireClicks();
    onRouteChange();
  }

})(typeof window !== 'undefined' ? window : this);