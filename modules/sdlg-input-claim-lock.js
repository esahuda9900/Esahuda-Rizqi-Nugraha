/**
 * SDLG Input claim-lock v1.6
 * Field WRITES disabled when sdlg-input-hydrate is active.
 * Still exposes activeClaimId (hash-first) + select sync for other modules.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_INPUT_CLAIM_LOCK_V16__) return;
    root.__SDLG_INPUT_CLAIM_LOCK_V16__ = true;

    var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;

    function hashClaimId() {
      try {
        var h = String((root.location && root.location.hash) || '');
        var m = h.match(/(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i);
        if (!m) return '';
        var seg = decodeURIComponent(m[1]).trim();
        return RE.test(seg) ? seg : '';
      } catch (_) { return ''; }
    }

    function syncSelectTo(id) {
      if (!id || !RE.test(id)) return;
      try {
        document.querySelectorAll('select').forEach(function (s) {
          var has = false;
          for (var j = 0; j < s.options.length; j++) {
            if (String(s.options[j].value || '') === id) { has = true; break; }
          }
          if (has && String(s.value || '') !== id) s.value = id;
        });
      } catch (_) {}
    }

    function activeClaimId() {
      var fromHash = hashClaimId();
      if (fromHash) { syncSelectTo(fromHash); return fromHash; }
      var live = root.__SDLG_LIVE_CLAIM__;
      if (live && live.claim_id && RE.test(String(live.claim_id))) {
        syncSelectTo(String(live.claim_id));
        return String(live.claim_id);
      }
      return '';
    }

    function applyClaim(c) {
      // Delegate to unified hydrate when present
      if (root.__SDLG_DISABLE_CLAIM_LOCK_FIELD_WRITES__ || root.SDLGInputHydrate) {
        if (root.SDLGInputHydrate && root.SDLGInputHydrate.apply && c) {
          try { root.SDLGInputHydrate.apply(c); } catch (_) {}
        }
        return;
      }
      // legacy path removed — hydrate owns writes
    }

    async function hydrate(claimId) {
      if (root.SDLGInputHydrate && root.SDLGInputHydrate.hydrate) {
        return root.SDLGInputHydrate.hydrate(claimId || activeClaimId());
      }
    }

    root.SDLGInputClaimLock = {
      version: '1.6.0',
      hydrate: hydrate,
      applyClaim: applyClaim,
      activeClaimId: activeClaimId
    };

    root.addEventListener('hashchange', function () { syncSelectTo(hashClaimId()); });
    setTimeout(function () { syncSelectTo(activeClaimId()); }, 300);
  } catch (e) {
    try { console.warn('[SDLG claim-lock]', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
