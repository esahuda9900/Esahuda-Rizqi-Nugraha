/**
 * boss-analytics-dashboard — stub (heavy ranking deferred)
 * Log only when ?debug=1 or localStorage sdlg-debug=1
 */
(function (root) {
  'use strict';
  if (root.__SDLG_BOSS_STUB__) return;
  root.__SDLG_BOSS_STUB__ = true;

  function isDebug() {
    try {
      if (/[?&]debug=1(?:&|$)/.test(String(root.location && root.location.search))) return true;
      if (root.localStorage && root.localStorage.getItem('sdlg-debug') === '1') return true;
    } catch (_) {}
    return false;
  }

  root.SDLGBossAnalytics = {
    version: 'stub-2026-10-30',
    renderExtraPanels: function () { return null; },
    periodFilterBar: function () { return null; },
    applyStyles: function () {}
  };

  if (isDebug()) {
    try { console.info('[SDLG] boss-analytics stub (debug)'); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
