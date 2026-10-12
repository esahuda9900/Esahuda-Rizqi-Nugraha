/**
 * SDLG Hash→Tab bridge v2
 * - Sync hash → React tab ONLY when hash actually changes
 * - Sync React tab → hash when user clicks nav (via capture)
 * - NO periodic re-apply (was causing Overview flicker loop)
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_HASH_TAB_BRIDGE_V2__) return;
    root.__SDLG_HASH_TAB_BRIDGE_V2__ = true;
    root.__SDLG_HASH_TAB_BRIDGE_V1__ = true;

    var lastHash = null;
    var applying = false;
    var userNavUntil = 0;

    function parseTabFromHash() {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.tabForRoute === 'function') {
          var t = root.SDLGHashRouter.tabForRoute();
          if (t) return t;
        }
      } catch (_) {}
      var h = String(root.location.hash || '').replace(/^#/, '');
      var parts = h.split('/').filter(Boolean);
      var head = (parts[0] || '').toLowerCase();
      if (!head || head === 'overview') return 'dashboard';
      if (head === 'claims' || head === 'list') return 'list';
      if (head === 'login') return 'login';
      if (head === 'new-claim') return 'paste';
      if (head === 'sdlg-input') return 'sdlginput';
      if (head === 'master-data') return 'masters';
      if (head === 'data-quality') return 'quality';
      if (head === 'unit360') return 'unit360';
      if (head === 'claim') return 'list';
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
      var cur = String(root.location.hash || '');
      if (cur === next) return;
      try {
        root.history.replaceState(null, '', root.location.pathname + root.location.search + next);
      } catch (_) {
        root.location.hash = next;
      }
    }

    function applyHashToTab() {
      if (applying) return;
      if (Date.now() < userNavUntil) return;
      var hash = String(root.location.hash || '');
      if (hash === lastHash) return;
      lastHash = hash;
      var tab = parseTabFromHash();
      if (!tab || tab === 'login') return;
      applying = true;
      try {
        if (typeof root.__SDLG_APPLY_ROUTE === 'function') {
          root.__SDLG_APPLY_ROUTE(tab);
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
        userNavUntil = Date.now() + 800;
        setHashFromTab(tab);
        lastHash = String(root.location.hash || '');
      } catch (_) {}
    }

    function boot() {
      document.addEventListener('click', onNavClick, true);
      root.addEventListener('hashchange', function () {
        setTimeout(applyHashToTab, 30);
      });
      setTimeout(applyHashToTab, 200);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }

    root.SDLGHashTabBridge = {
      version: '2.0.0',
      apply: applyHashToTab,
      parseTab: parseTabFromHash,
      setHashFromTab: setHashFromTab
    };
  } catch (e) {
    try { console.warn('[SDLG hash-tab-bridge] init failed', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
