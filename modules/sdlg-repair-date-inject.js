/**
 * SDLG repair-date-inject — DISABLED.
 * Previously injected a duplicate "Warranty Claim Form" (D365 mirror) with its own
 * taskbar + Home/Approval Progress/Related tabs. That UI is permanently removed.
 * This stub only cleans any leftover panel if an old cached script ran first.
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_MIRROR_DISABLED_V2__) return;
  window.__SDLG_PORTAL_MIRROR_DISABLED_V2__ = true;
  window.__SDLG_PORTAL_MIRROR_155__ = true;

  function removePanel() {
    ['sdlg-portal-mirror-panel', 'sdlg-dynamics-portal-mirror'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    document.querySelectorAll('[data-sdlg-dynamics-mirror]').forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
  }

  function boot() {
    removePanel();
    setInterval(removePanel, 1000);
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(removePanel, 200);
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGPortalMirror = {
    version: '2.0.1-disabled',
    refresh: removePanel,
    remove: removePanel,
    isHelper: function () { return false; },
    claimId: function () { return ''; }
  };
})();
