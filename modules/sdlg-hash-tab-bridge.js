/**
 * SDLG Hash→Tab bridge v2.2
 * - Never force-apply 'list' while on #/claim/:id (was killing claim detail)
 * - Hash change → React tab only for top-level pages
 * - Nav click → hash update (capture)
 * - No periodic re-apply
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_HASH_TAB_BRIDGE_V22__) return;
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
      return /^\/?claim\//i.test(h);
    }

    function isSdlgInputHash(h) {
      h = String(h || rawHash()).replace(/^#/, '');
      return /^\/?sdlg-input/i.test(h);
    }

    function parseTabFromHash() {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.tabForRoute === 'function') {
          var t = root.SDLGHashRouter.tabForRoute();
          if (t) return t;
        }
      } catch (_) {}
      var h = rawHash().replace(/^#/, '');
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
      // claim detail is NOT a top-level tab — handled separately
      if (head === 'claim') return '';
      return '';
    }

    function setHashFromTab(tab) {
      // Never overwrite an open claim detail URL when syncing from generic list tab
      // (only explicit Claims nav should leave detail — that path passes through onNavClick)
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
        root.location.hash = next;
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

      // CRITICAL: claim detail URL must not trigger Claims-nav click (clears detailId)
      if (isClaimDetailHash(hash)) {
        lastHash = hash;
        return;
      }
      // SDLG Input with/without claimId: let React own the page; only set tab if needed
      if (isSdlgInputHash(hash)) {
        lastHash = hash;
        // soft-set tab without wiping claim context if possible
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
      version: '2.2.0',
      apply: applyHashToTab,
      parseTab: parseTabFromHash,
      setHashFromTab: setHashFromTab
    };
  } catch (e) {
    try { console.warn('[SDLG hash-tab-bridge] init failed', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
