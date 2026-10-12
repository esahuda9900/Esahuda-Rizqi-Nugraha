/**
 * SDLG Hash→Tab bridge v2.3
 * - #/claims/:claimId is DETAIL — never force Claims list click
 * - Supports hierarchical URLs from router v2.2
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_HASH_TAB_BRIDGE_V23__) return;
    root.__SDLG_HASH_TAB_BRIDGE_V23__ = true;
    root.__SDLG_HASH_TAB_BRIDGE_V22__ = true;
    root.__SDLG_HASH_TAB_BRIDGE_V21__ = true;
    root.__SDLG_HASH_TAB_BRIDGE_V2__ = true;
    root.__SDLG_HASH_TAB_BRIDGE_V1__ = true;

    var lastHash = null;
    var applying = false;
    var userNavUntil = 0;

    function rawHash() {
      return String(root.location.hash || '');
    }

    function isClaimDetailHash(h) {
      h = String(h || rawHash()).replace(/^#/, '');
      if (h.charAt(0) !== '/') h = '/' + h;
      if (/^\/claim\//i.test(h)) return true;
      var m = h.match(/^\/claims\/([^/]+)/i);
      if (m) {
        var seg = decodeURIComponent(m[1]);
        if (/^\d{4}$/.test(seg)) return false;
        return true;
      }
      return false;
    }

    function isSdlgInputHash(h) {
      h = String(h || rawHash()).replace(/^#/, '');
      if (h.charAt(0) !== '/') h = '/' + h;
      return /^\/sdlg-input/i.test(h);
    }

    function parseTabFromHash() {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.tabForRoute === 'function') {
          var t = root.SDLGHashRouter.tabForRoute();
          if (t) return t;
        }
      } catch (_) {}
      var h = rawHash().replace(/^#/, '');
      if (h.charAt(0) !== '/') h = '/' + h;
      var parts = h.replace(/^\//, '').split('/').filter(Boolean);
      var head = (parts[0] || '').toLowerCase();
      if (!head || head === 'overview') return 'dashboard';
      if (head === 'claims' || head === 'list') return 'list';
      if (head === 'login') return 'login';
      if (head === 'new-claim') return 'paste';
      if (head === 'sdlg-input') return 'sdlginput';
      if (head === 'master-data') return 'masters';
      if (head === 'data-quality') return 'quality';
      if (head === 'unit360') return 'unit360';
      if (head === 'claim') return '';
      return '';
    }

    function setHashFromTab(tab) {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.setFromTab === 'function') {
          root.SDLGHashRouter.setFromTab(tab, null, { replace: true });
          return;
        }
      } catch (_) {}
      var map = {
        dashboard: '#/overview',
        list: '#/claims',
        paste: '#/new-claim',
        sdlginput: '#/sdlg-input',
        masters: '#/master-data',
        quality: '#/data-quality',
        unit360: '#/unit360'
      };
      var next = map[tab];
      if (!next) return;
      if (rawHash() === next) return;
      try {
        root.history.replaceState(null, '', root.location.pathname + root.location.search + next);
      } catch (_) {
        root.location.hash = next.replace(/^#/, '');
      }
    }

    function clickNavOnce(tab) {
      try {
        var labels = {
          dashboard: /^overview/i,
          list: /^claims/i,
          paste: /new claim/i,
          sdlginput: /sdlg input/i,
          masters: /master data/i,
          quality: /data quality/i
        };
        var re = labels[tab];
        if (!re) return false;
        var btns = document.querySelectorAll('button.nav-btn');
        for (var i = 0; i < btns.length; i++) {
          var text = String(btns[i].textContent || '').trim();
          if (re.test(text)) {
            userNavUntil = Date.now() + 100;
            btns[i].click();
            return true;
          }
        }
      } catch (_) {}
      return false;
    }

    function applyHashToTab() {
      if (applying) return;
      if (Date.now() < userNavUntil) return;
      var hash = rawHash();
      if (hash === lastHash) return;

      if (isClaimDetailHash(hash)) {
        lastHash = hash;
        return;
      }
      if (isSdlgInputHash(hash)) {
        lastHash = hash;
        applying = true;
        try {
          if (typeof root.__SDLG_APPLY_ROUTE === 'function') {
            root.__SDLG_APPLY_ROUTE('sdlginput');
          }
        } catch (_) {}
        applying = false;
        return;
      }

      lastHash = hash;
      var tab = parseTabFromHash();
      if (!tab || tab === 'login') return;
      applying = true;
      try {
        if (typeof root.__SDLG_APPLY_ROUTE === 'function') {
          root.__SDLG_APPLY_ROUTE(tab);
        } else {
          clickNavOnce(tab);
        }
      } catch (e) {
        console.warn('[SDLG hash-tab-bridge] apply', e);
      } finally {
        applying = false;
      }
    }

    function onNavClick(e) {
      try {
        var btn = e.target && e.target.closest && e.target.closest('button.nav-btn');
        if (!btn) return;
        var label = String(btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        var tab = '';
        if (/^overview/.test(label)) tab = 'dashboard';
        else if (/^claims/.test(label)) tab = 'list';
        else if (/new claim/.test(label)) tab = 'paste';
        else if (/sdlg input/.test(label)) tab = 'sdlginput';
        else if (/master data/.test(label)) tab = 'masters';
        else if (/data quality/.test(label)) tab = 'quality';
        else if (/unit/.test(label)) tab = 'unit360';
        if (!tab) return;
        userNavUntil = Date.now() + 900;
        setHashFromTab(tab);
        lastHash = rawHash();
      } catch (_) {}
    }

    function boot() {
      document.addEventListener('click', onNavClick, true);
      root.addEventListener('hashchange', function () {
        setTimeout(applyHashToTab, 30);
      });
      setTimeout(applyHashToTab, 250);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }

    root.SDLGHashTabBridge = {
      version: '2.3.0',
      apply: applyHashToTab,
      parseTab: parseTabFromHash,
      setHashFromTab: setHashFromTab
    };
  } catch (e) {
    try { console.warn('[SDLG hash-tab-bridge] init failed', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
