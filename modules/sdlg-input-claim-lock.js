/**
 * SDLG Input Claim Lock — V2.0 (Smart Form Guardian)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ MUTATION OBSERVER: Nangkep dropdown yang dirender React.
 * ✅ REACT-SAFE SYNC: Dispatch event biar React tau nilainya berubah.
 * ✅ CENTRALIZED STATE: Pakai __SDLG_ACTIVE_CLAIM_ID__.
 * ✅ IMMUTABLE: Object.freeze() pada API.
 * ✅ ZERO TIMEOUT HACK: Gak ada setTimeout(300) lagi.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_INPUT_CLAIM_LOCK_V2__) return;
  root.__SDLG_INPUT_CLAIM_LOCK_V2__ = true;
  root.__SDLG_INPUT_CLAIM_LOCK_V16__ = true; // Backward compat

  // Pre-compiled Regex
  var RE_CLAIM_ID = /^\d{3,4}-\d{4}-SDLG-PFR$/i;
  var RE_HASH_EXTRACT = /(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i;

  // ─────────────────────────────────────────────────────────
  // 1. STATE & UTILITIES
  // ─────────────────────────────────────────────────────────
  var isSyncing = false;

  /**
   * Ambil Claim ID dari URL hash.
   * Contoh: #/sdlg-input/0250-2026-SDLG-PFR → "0250-2026-SDLG-PFR"
   */
  function getClaimIdFromHash() {
    try {
      var h = String((root.location && root.location.hash) || '');
      var m = h.match(RE_HASH_EXTRACT);
      if (!m) return '';
      var seg = decodeURIComponent(m[1]).trim();
      return RE_CLAIM_ID.test(seg) ? seg : '';
    } catch (_) { return ''; }
  }

  /**
   * Ambil Claim ID aktif (prioritas: Hash > Live State > Router).
   */
  function getActiveClaimId() {
    // Prioritas 1: URL Hash
    var fromHash = getClaimIdFromHash();
    if (fromHash) {
      root.__SDLG_ACTIVE_CLAIM_ID__ = fromHash;
      return fromHash;
    }

    // Prioritas 2: Live State (kalau ada)
    var live = root.__SDLG_LIVE_CLAIM__;
    if (live && live.claim_id && RE_CLAIM_ID.test(String(live.claim_id))) {
      root.__SDLG_ACTIVE_CLAIM_ID__ = String(live.claim_id);
      return String(live.claim_id);
    }

    // Prioritas 3: Router
    try {
      if (root.SDLGHashRouter && root.SDLGHashRouter.claimId) {
        var cid = root.SDLGHashRouter.claimId();
        if (cid && RE_CLAIM_ID.test(cid)) {
          root.__SDLG_ACTIVE_CLAIM_ID__ = cid;
          return cid;
        }
      }
    } catch (_) {}

    return '';
  }

  // ─────────────────────────────────────────────────────────
  // 2. SMART SELECT SYNC
  // ─────────────────────────────────────────────────────────
  
  /**
   * Sinkronkan semua dropdown yang punya Option sesuai Claim ID.
   * Pakai dispatchEvent biar React tau.
   */
  function syncSelectTo(claimId) {
    if (isSyncing || !claimId || !RE_CLAIM_ID.test(claimId)) return;
    isSyncing = true;

    try {
      var selects = document.querySelectorAll('select');
      for (var i = 0; i < selects.length; i++) {
        var s = selects[i];
        
        // Skip kalau udah punya value yang bener
        if (String(s.value || '') === claimId) continue;

        // Cek apakah select ini beneran punya opsi Claim ID
        var hasOption = false;
        for (var j = 0; j < s.options.length; j++) {
          if (String(s.options[j].value || '') === claimId) {
            hasOption = true;
            break;
          }
        }
        
        if (!hasOption) continue;

        // Set value + trigger event React
        s.value = claimId;
        try {
          s.dispatchEvent(new Event('change', { bubbles: true }));
          s.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (_) {}
      }
    } catch (_) {
      // Silent fail
    } finally {
      isSyncing = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. DELEGATION (Hydrate)
  // ─────────────────────────────────────────────────────────
  
  /**
   * Apply data ke form. Delegasikan ke SDLGHydrate kalau ada.
   */
  function applyClaim(claim) {
    if (!claim) return false;

    // Cek apakah Hydrate aktif
    var writesDisabled = root.__SDLG_DISABLE_CLAIM_LOCK_FIELD_WRITES__ || root.SDLGInputHydrate;
    
    if (writesDisabled) {
      if (root.SDLGInputHydrate && typeof root.SDLGInputHydrate.apply === 'function') {
        try {
          root.SDLGInputHydrate.apply(claim);
          return true;
        } catch (e) {
          console.warn('[SDLG ClaimLock] Hydrate error:', e);
          return false;
        }
      }
      // Hydrate aktif tapi gak punya .apply
      return false;
    }

    // Legacy path: Removed (Hydrate owns writes)
    return false;
  }

  /**
   * Hydrate claim dari ID.
   */
  async function hydrate(claimId) {
    var cid = claimId || getActiveClaimId();
    if (!cid) return false;

    if (root.SDLGInputHydrate && typeof root.SDLGInputHydrate.hydrate === 'function') {
      try {
        return await root.SDLGInputHydrate.hydrate(cid);
      } catch (e) {
        console.warn('[SDLG ClaimLock] Hydrate failed:', e);
        return false;
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────
  // 4. EVENT LISTENERS & OBSERVER
  // ─────────────────────────────────────────────────────────

  // A. Hashchange → sync dropdown
  root.addEventListener('hashchange', function () {
    var id = getActiveClaimId();
    if (id) syncSelectTo(id);
  });

  // B. Sinyal dari Router V3.0 → sync dropdown
  root.addEventListener('sdlg-route-changed', function (e) {
    var route = e.detail;
    var id = (route && route.params && route.params.claimId) || '';
    if (id && RE_CLAIM_ID.test(id)) {
      root.__SDLG_ACTIVE_CLAIM_ID__ = id;
      // Delay dikit biar React sempet render select-nya
      setTimeout(function () { syncSelectTo(id); }, 150);
    }
  });

  // C. Mutation Observer: Nangkep dropdown yang muncul belakangan
  function setupSelectObserver() {
    if (!window.MutationObserver) return;

    var debounce;
    var obs = new MutationObserver(function () {
      var id = root.__SDLG_ACTIVE_CLAIM_ID__;
      if (!id) return;
      
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        syncSelectTo(id);
      }, 100);
    });

    obs.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  root.SDLGInputClaimLock = Object.freeze({
    version: '2.0.0',
    hydrate: hydrate,
    applyClaim: applyClaim,
    activeClaimId: getActiveClaimId,
    syncSelect: syncSelectTo
  });

  // ─────────────────────────────────────────────────────────
  // 6. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    setupSelectObserver();
    
    // Initial sync
    var id = getActiveClaimId();
    if (id) {
      // Delay 1 frame biar select-nya ada
      setTimeout(function () { syncSelectTo(id); }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})(typeof window !== 'undefined' ? window : globalThis);