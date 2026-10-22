/**
 * sdlg-hash-router — EMERGENCY STUB 2026-10-22
 * Prevent aggressive route observers from fighting React on login page.
 */
(function () {
  'use strict';
  if (window.__SDLG_HASH_ROUTER_STUB__) return;
  window.__SDLG_HASH_ROUTER_STUB__ = true;
  window.SDLGHashRouter = {
    version: 'stub-2026-10-22',
    navigate: function () {},
    parse: function () { return { tab: 'list', detailId: null }; }
  };
  try { console.info('[SDLG] hash-router emergency stub active'); } catch (_) {}
})();
