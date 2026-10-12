/**
 * SDLG Hash Router v2.2 — hierarchical routes for GitHub Pages
 *
 * Canonical:
 *   #/overview
 *   #/login
 *   #/claims
 *   #/claims/2026                         (year filter)
 *   #/claims/0250-2026-SDLG-PFR           (claim detail — continues from list)
 *   #/claims/0250-2026-SDLG-PFR/assessment
 *   #/sdlg-input[/claimId]
 *   #/master-data[/type]
 *   #/unit360[/serial]
 *   #/data-quality
 *   #/new-claim
 *
 * Legacy (still parsed):
 *   #/claim/:id
 *   #claim/:id   (missing slash — normalized)
 */
(function (root) {
  'use strict';
  if (root.__SDLG_HASH_ROUTER_V22__) return;
  root.__SDLG_HASH_ROUTER_V22__ = true;
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

  function isYear(s) {
    return /^\d{4}$/.test(String(s || ''));
  }

  function isClaimId(s) {
    s = String(s || '').trim();
    if (!s || isYear(s)) return false;
    return /SDLG-PFR/i.test(s) || /\d{3,4}-\d{4}/.test(s) || s.length > 6;
  }

  function parse() {
    var raw = String(root.location.hash || '').replace(/^#/, '');
    if (raw && raw.charAt(0) !== '/') raw = '/' + raw;
    if (!raw || raw === '/') return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' };

    var leg = raw.match(/^\/claim\/([^/?#]+)(?:\/(assessment|input|overview))?$/i);
    if (leg) {
      var cid0 = normClaim(decodeURIComponent(leg[1]));
      var sub0 = (leg[2] || 'overview').toLowerCase();
      if (sub0 === 'input') return { page: 'sdlg-input', params: { claimId: cid0 }, subTab: 'input', tab: 'sdlginput' };
      return { page: 'claim', params: { claimId: cid0 }, subTab: sub0, tab: 'list' };
    }

    leg = raw.match(/^\/sdlginput(?:\/([^/?#]+))?$/i);
    if (leg) {
      return {
        page: 'sdlg-input',
        params: { claimId: normClaim(leg[1] ? decodeURIComponent(leg[1]) : '') },
        subTab: '',
        tab: 'sdlginput'
      };
    }

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
        if (p2 === 'input') {
          return { page: 'sdlg-input', params: { claimId: normClaim(p1) }, subTab: 'input', tab: 'sdlginput' };
        }
        return {
          page: 'claim',
          params: { claimId: normClaim(p1) },
          subTab: p2 === 'assessment' ? 'assessment' : 'overview',
          tab: 'list'
        };
      }
      if (p1 && isYear(p1)) {
        return { page: 'claims', params: { year: p1 }, subTab: '', tab: 'list' };
      }
      return { page: 'claims', params: {}, subTab: '', tab: 'list' };
    }

    if (head === 'new-claim' || head === 'paste') {
      return { page: 'new-claim', params: {}, subTab: '', tab: 'paste' };
    }
    if (head === 'sdlg-input') {
      return {
        page: 'sdlg-input',
        params: { claimId: parts[1] ? normClaim(decodeURIComponent(parts[1])) : '' },
        subTab: '',
        tab: 'sdlginput'
      };
    }
    if (head === 'master-data' || head === 'masters') {
      return {
        page: 'master-data',
        params: { type: parts[1] || 'customers' },
        subTab: '',
        tab: 'masters'
      };
    }
    if (head === 'data-quality' || head === 'quality') {
      return { page: 'data-quality', params: {}, subTab: '', tab: 'quality' };
    }
    if (head === 'unit360' || head === 'unit') {
      return {
        page: 'unit360',
        params: { serial: parts[1] ? decodeURIComponent(parts[1]) : '' },
        subTab: '',
        tab: 'unit360'
      };
    }

    return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' };
  }

  function build(page, params, subTab) {
    params = params || {};
    page = String(page || 'overview').toLowerCase();
    if (page === 'login') return '#/login';
    if (page === 'overview') return '#/overview';
    if (page === 'claims') {
      return params.year ? '#/claims/' + params.year : '#/claims';
    }
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
    if (page === 'master-data') {
      return '#/master-data/' + encodeURIComponent(params.type || 'customers');
    }
    if (page === 'data-quality') return '#/data-quality';
    if (page === 'unit360') {
      return params.serial
        ? '#/unit360/' + encodeURIComponent(params.serial)
        : '#/unit360';
    }
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
    if (current === target) {
      try {
        var route0 = parse();
        root.localStorage.setItem(ROUTE_KEY, JSON.stringify({ page: route0.page, params: route0.params, subTab: route0.subTab }));
        if (route0.params && route0.params.claimId) root.localStorage.setItem(CLAIM_KEY, route0.params.claimId);
      } catch (_) {}
      return;
    }
    if (opts.replace) {
      root.location.replace(target);
    } else {
      root.location.hash = hash.replace(/^#/, '');
      if (/^#claim\//i.test(String(root.location.hash || ''))) {
        try {
          root.history.replaceState(null, '', target);
        } catch (_) {}
      }
    }
    try {
      var route = parse();
      root.localStorage.setItem(ROUTE_KEY, JSON.stringify({ page: route.page, params: route.params, subTab: route.subTab }));
      if (route.params && route.params.claimId) root.localStorage.setItem(CLAIM_KEY, route.params.claimId);
      if (route.page === 'sdlg-input' && route.params && route.params.claimId) {
        root.localStorage.setItem(INPUT_KEY, route.params.claimId);
      }
      try {
        root.dispatchEvent(new CustomEvent('sdlg-route', { detail: route }));
      } catch (_) {}
    } catch (_) {}
  }

  function setFromTab(tab, detailId, extra) {
    extra = extra || {};
    if (tab === 'list' && detailId) {
      return navigate('claim', { claimId: detailId }, {
        subTab: extra.subTab || 'overview',
        replace: !!extra.replace
      });
    }
    if (tab === 'sdlginput') {
      return navigate('sdlg-input', { claimId: detailId || extra.claimId || '' }, { replace: !!extra.replace });
    }
    if (tab === 'masters') {
      return navigate('master-data', { type: extra.type || 'customers' }, { replace: !!extra.replace });
    }
    if (tab === 'unit360') {
      return navigate('unit360', { serial: extra.serial || '' }, { replace: !!extra.replace });
    }
    if (tab === 'list' && extra.year) {
      return navigate('claims', { year: extra.year }, { replace: !!extra.replace });
    }
    return navigate(PAGE_BY_TAB[tab] || 'overview', {}, { replace: !!extra.replace });
  }

  function wireClicks() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var btn = e.target.closest && e.target.closest('button, a, [role="tab"]');
      if (!btn || (btn.classList && btn.classList.contains('nav-btn'))) return;
      var label = String(btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
      var m = String(btn.getAttribute('data-claim-id') || btn.getAttribute('data-id') || '').match(
        /(\d{3,4}-\d{4}-SDLG-PFR)/i
      );
      if (m) {
        setTimeout(function () {
          navigate('claim', { claimId: m[1] }, { subTab: 'overview' });
        }, 0);
      }
      if (/kembali|back to list|semua klaim/.test(label)) {
        setTimeout(function () {
          navigate('claims');
        }, 0);
      }
    }, true);
  }

  root.SDLGHashRouter = {
    version: '2.2.0',
    parse: parse,
    get: parse,
    build: build,
    navigate: navigate,
    setFromTab: setFromTab,
    claimId: function () {
      var r = parse();
      return (r.params && r.params.claimId) || '';
    },
    tabForRoute: function () {
      return parse().tab;
    },
    restore: function (opts) {
      opts = opts || {};
      if (opts.mode === 'sdlginput' || opts.tab === 'sdlginput') {
        return navigate('sdlg-input', { claimId: opts.claimId }, { replace: !!opts.replace });
      }
      if (opts.mode === 'detail' || opts.claimId) {
        return navigate('claim', { claimId: opts.claimId }, {
          subTab: 'overview',
          replace: !!opts.replace
        });
      }
      if (opts.tab) return setFromTab(opts.tab, opts.claimId, { replace: !!opts.replace });
      return navigate(opts.page || 'overview', opts.params || {}, opts);
    }
  };

  if (!root.SDLGNavState) root.SDLGNavState = {};
  root.SDLGNavState.setSdlgInputClaim = function (id) {
    navigate('sdlg-input', { claimId: id }, { replace: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireClicks, { once: true });
  } else {
    wireClicks();
  }
})(typeof window !== 'undefined' ? window : this);
