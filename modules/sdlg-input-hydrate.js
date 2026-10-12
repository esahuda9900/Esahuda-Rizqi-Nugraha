/**
 * SDLG Input Hydrate v1.4 — read-only compatibility shim.
 * React useLiveClaim owns SDLG Input field rendering; this module must never mutate the DOM.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_INPUT_HYDRATE_V14__) return;
  root.__SDLG_INPUT_HYDRATE_V14__ = true;
  root.__SDLG_DISABLE_CLAIM_LOCK_FIELD_WRITES__ = true;
  root.__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__ = true;
  root.__SDLG_DISABLE_FB_FIX_WRITES__ = true;

  function hashClaimId() {
    try {
      var h = String((root.location && root.location.hash) || '');
      var m = h.match(/(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i);
      return m ? decodeURIComponent(m[1]).trim() : '';
    } catch (_) { return ''; }
  }

  root.SDLGInputHydrate = {
    version: '1.4.0-readonly',
    hydrate: function () { return Promise.resolve(null); },
    apply: function () { return false; },
    hashClaimId: hashClaimId,
    lastValues: function () { return null; },
    enforceRepairDate: function () { return false; }
  };
})(typeof window !== 'undefined' ? window : this);
