/**
 * SDLG Claim Context Loader — V2.1 (Clean)
 *
 * 2026-10-30: All previous context modules were moved to modules/_archive.
 * Loader no longer requests them → console 404 silence.
 * Helper API (clean / normalizeModel) remains available.
 */
(function (root) {
  'use strict';

  function clean(value) {
    return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
  }

  function normalizeModel(value) {
    return clean(value).replace(/^SDLG\s+/i, '').replace(/\s+/g, '').toUpperCase();
  }

  root.SDLGMasterResolutionUX = root.SDLGMasterResolutionUX || {
    clean: clean,
    normalizeModel: normalizeModel
  };

  if (window.__SDLG_CLAIM_CONTEXT_LOADER_V21__) return;
  window.__SDLG_CLAIM_CONTEXT_LOADER_V21__ = true;
  window.__SDLG_CLAIM_CONTEXT_LOADER_V2__ = true;
  window.__SDLG_CLAIM_CONTEXT_LOADER_V17__ = true;

  // Archived modules intentionally not loaded:
  // sdlg-policy-repair-hardfix, sdlg-portal-enrich, sdlg-policy-table-fill,
  // claim-context-resolve, sdlg-portal-copy-helper, sdlg-portal-ux-v2

  var MODULES = [];

  function loadAllModules() {
    console.info('[SDLG Loader] Context modules: none active (archived cleaned).');
    root.dispatchEvent(new CustomEvent('sdlg-context-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllModules, { once: true });
  } else {
    loadAllModules();
  }

  root.SDLGClaimContextLoader = {
    version: '2.1.0-clean',
    reload: loadAllModules,
    modules: MODULES
  };

})(typeof window !== 'undefined' ? window : globalThis);
