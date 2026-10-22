/**
 * command-center — EMERGENCY STUB 2026-10-22
 * Full V4 disabled: auto-refresh + realtime + 1000-row queue caused main-thread freeze on login.
 * Dashboard core (list claims) remains in index.html React app.
 */
(function () {
  'use strict';
  if (window.__SDLG_CC_STUB__) return;
  window.__SDLG_CC_STUB__ = true;
  window.SDLGCommandCenter = {
    version: 'stub-2026-10-22',
    mount: function () {},
    unmount: function () {},
    refresh: function () { return Promise.resolve(null); }
  };
  try { console.info('[SDLG] command-center emergency stub active'); } catch (_) {}
})();
