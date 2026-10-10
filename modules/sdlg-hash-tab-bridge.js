/**
 * SDLG Hash→Tab bridge v1
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_HASH_TAB_BRIDGE_V1__) return;
    root.__SDLG_HASH_TAB_BRIDGE_V1__ = true;

    function parseTab() {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.tabForRoute === 'function') {
          return root.SDLGHashRouter.tabForRoute() || '';
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

    function clickNav(tab) {
      try {
        var labels = {
          dashboard: /overview/i,
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
          if (re.test(String(btns[i].textContent || '').trim())) {
            btns[i].click();
            return true;
          }
        }
      } catch (_) {}
      return false;
    }

    function apply() {
      try {
        var tab = parseTab();
        if (!tab || tab === 'login') return;
        if (typeof root.__SDLG_APPLY_ROUTE === 'function') {
          root.__SDLG_APPLY_ROUTE(tab);
          return;
        }
        clickNav(tab);
      } catch (e) {
        console.warn('[SDLG hash-tab-bridge]', e);
      }
    }

    function boot() {
      root.addEventListener('hashchange', function () { setTimeout(apply, 50); });
      setTimeout(apply, 400);
      setTimeout(apply, 1200);
      setTimeout(apply, 2800);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    root.SDLGHashTabBridge = { version: '1.0.0', apply: apply, parseTab: parseTab };
  } catch (e) {
    try { console.warn('[SDLG hash-tab-bridge] init failed', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
