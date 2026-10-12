/**
 * SDLG Input claim-id sync v1
 * Prevents cross-claim contamination (e.g. report name from 0429 while viewing 0251).
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_INPUT_CLAIM_SYNC_V1__) return;
    root.__SDLG_INPUT_CLAIM_SYNC_V1__ = true;

    var LS_INPUT = 'sdlg-warranty:last-sdlginput-claim:v1';
    var LS_CLAIM = 'sdlg-warranty:last-claim:v1';

    function fromHash() {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.claimId === 'function') {
          var id = root.SDLGHashRouter.claimId();
          if (id) return String(id).trim();
        }
      } catch (_) {}
      var h = String(root.location.hash || '');
      var m = h.match(/#?\/?(?:sdlg-input|sdlginput)\/([^/?#]+)/i);
      if (m) return decodeURIComponent(m[1]).trim();
      m = h.match(/#?\/?(?:claims)\/([^/?#]+)/i);
      if (m) {
        var seg = decodeURIComponent(m[1]).trim();
        if (/^\d{4}$/.test(seg)) return '';
        return seg;
      }
      m = h.match(/#?\/?(?:claim)\/([^/?#]+)/i);
      if (m) return decodeURIComponent(m[1]).trim();
      return '';
    }

    function resolvePreferredClaimId(explicit) {
      var ex = explicit != null ? String(explicit).trim() : '';
      if (ex) return ex;
      var hid = fromHash();
      if (hid) return hid;
      try {
        var ls = root.localStorage.getItem(LS_INPUT) || '';
        if (ls) return String(ls).trim();
      } catch (_) {}
      return '';
    }

    function remember(id) {
      id = String(id || '').trim();
      if (!id) return;
      try {
        root.localStorage.setItem(LS_INPUT, id);
        root.localStorage.setItem(LS_CLAIM, id);
      } catch (_) {}
    }

    function syncFromHash() {
      var id = fromHash();
      if (!id) return;
      remember(id);
      try {
        root.dispatchEvent(new CustomEvent('sdlg-input-claim', { detail: { claimId: id } }));
      } catch (_) {}
    }

    root.SDLGInputClaimSync = {
      version: '1.0.0',
      fromHash: fromHash,
      resolve: resolvePreferredClaimId,
      remember: remember
    };

    root.addEventListener('hashchange', function () {
      setTimeout(syncFromHash, 20);
    });
    setTimeout(syncFromHash, 100);
    setTimeout(syncFromHash, 600);
  } catch (e) {
    try { console.warn('[SDLG input-claim-sync]', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
