/**
 * command-center — stub (heavy realtime deferred to avoid login freeze)
 * Log only when ?debug=1 or localStorage sdlg-debug=1
 */
(function (root) {
  'use strict';
  if (root.__SDLG_CC_STUB__) return;
  root.__SDLG_CC_STUB__ = true;

  function isDebug() {
    try {
      if (/[?&]debug=1(?:&|$)/.test(String(root.location && root.location.search))) return true;
      if (root.localStorage && root.localStorage.getItem('sdlg-debug') === '1') return true;
    } catch (_) {}
    return false;
  }

  root.SDLGCommandCenter = {
    version: 'stub-2026-10-30',
    mount: function () {},
    unmount: function () {},
    refresh: function () { return Promise.resolve(null); }
  };

  if (isDebug()) {
    try { console.info('[SDLG] command-center stub (debug)'); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
