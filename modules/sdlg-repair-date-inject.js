/**
 * SDLG Repair-Date-Inject — V3.0 (Self-Destructing Sentinel)
 * 
 * ═══════════════════════════════════════════════════════════
 * STATUS: PERMANENTLY DISABLED (The D365 Mirror feature is dead)
 * 
 * FUNGSI FILE INI:
 * - Cleanup kalau ada old script cache yang balik nge-inject "Portal Mirror"
 * - Zero overhead (gak polling forever)
 * - Self-destructing observer (mati sendiri kalau gak nemu apa-apa)
 * 
 * UPGRADE V3.0:
 * ✅ ZERO INTERVAL: Ganti setInterval jadi MutationObserver.
 * ✅ SELF-DESTRUCT: Observer mati otomatis setelah 30 detik idle.
 * ✅ RE-ARM ON ROUTE: Nyalain ulang pas user pindah halaman.
 * ✅ TARGETED SELECTORS: Gak scan seluruh DOM.
 * ✅ IMMUTABLE API: Object.freeze().
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_PORTAL_MIRROR_DISABLED_V3__) return;
  window.__SDLG_PORTAL_MIRROR_DISABLED_V3__ = true;
  window.__SDLG_PORTAL_MIRROR_DISABLED_V2__ = true; // Backward compat
  window.__SDLG_PORTAL_MIRROR_155__ = true;

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI
  // ─────────────────────────────────────────────────────────
  var SELF_DESTRUCT_MS = 30000; // 30 detik
  var PURGE_IDS = ['sdlg-portal-mirror-panel', 'sdlg-dynamics-portal-mirror'];
  var PURGE_ATTR = '[data-sdlg-dynamics-mirror]';

  // ─────────────────────────────────────────────────────────
  // 2. STATE
  // ─────────────────────────────────────────────────────────
  var observer = null;
  var destructTimer = null;
  var isWatching = false;

  // ─────────────────────────────────────────────────────────
  // 3. CLEANUP FUNCTION
  // ─────────────────────────────────────────────────────────
  function removePanel() {
    var removed = 0;

    // A. Hapus by ID
    for (var i = 0; i < PURGE_IDS.length; i++) {
      var el = document.getElementById(PURGE_IDS[i]);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
        removed++;
      }
    }

    // B. Hapus by attribute
    var nodes = document.querySelectorAll(PURGE_ATTR);
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j].parentNode) {
        nodes[j].parentNode.removeChild(nodes[j]);
        removed++;
      }
    }

    // C. Kalau berhasil hapus sesuatu, restart self-destruct timer
    if (removed > 0) {
      resetSelfDestruct();
    }

    return removed;
  }

  // ─────────────────────────────────────────────────────────
  // 4. SELF-DESTRUCTING OBSERVER
  // ─────────────────────────────────────────────────────────
  function startWatching() {
    if (isWatching) return;

    // Cek dulu, kalau gak ada panel sama sekali, jangan observe
    if (!document.body) return;

    try {
      observer = new MutationObserver(function (mutations) {
        // Cek apakah ada perubahan yang relevan
        // (jangan process semua mutation, cuma yang childList)
        var hasAdditions = false;
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].type === 'childList' && mutations[i].addedNodes.length > 0) {
            hasAdditions = true;
            break;
          }
        }

        if (hasAdditions) {
          removePanel();
        }
      });

      // Observe dengan subtree tapi tanpa attributes (lebih hemat)
      observer.observe(document.body, {
        childList: true,
        subtree: true
        // Tidak observe 'attributes' atau 'characterData' - hemat CPU
      });

      isWatching = true;
      resetSelfDestruct();

    } catch (e) {
      console.warn('[SDLG Mirror Cleanup] Observer setup failed:', e);
    }
  }

  function stopWatching() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (destructTimer) {
      clearTimeout(destructTimer);
      destructTimer = null;
    }
    isWatching = false;
  }

  function resetSelfDestruct() {
    if (destructTimer) clearTimeout(destructTimer);
    destructTimer = setTimeout(function () {
      // Self-destruct: kalau udah 30 detik gak nemu apa-apa, matiin
      stopWatching();
    }, SELF_DESTRUCT_MS);
  }

  // ─────────────────────────────────────────────────────────
  // 5. ROUTE CHANGE HANDLER (Re-arm Observer)
  // ─────────────────────────────────────────────────────────
  function onRouteChange() {
    // Pindah halaman bisa bikin old script nge-inject mirror lagi
    // Jadi kita re-arm (nyalain ulang) observer
    setTimeout(function () {
      removePanel();
      startWatching();
    }, 100);
  }

  // ─────────────────────────────────────────────────────────
  // 6. SENTINEL TRAP (Buat Script Lama yang Masih Panggil)
  // ─────────────────────────────────────────────────────────
  function createTrap(methodName) {
    return function () {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[SDLG Guardian] ⚠️ Old script tried to call PortalMirror.' + methodName + '()\n' +
          'This feature is permanently disabled. Ignoring call.'
        );
      }
      return false; // Biar gak error
    };
  }

  // ─────────────────────────────────────────────────────────
  // 7. PUBLIC API (Immutable + Trapped)
  // ─────────────────────────────────────────────────────────
  var MirrorAPI = Object.freeze({
    version: '3.0.0-disabled',
    disabled: true,
    reason: 'D365 Portal Mirror feature permanently removed',
    
    // Real functions
    refresh: removePanel,
    remove: removePanel,
    isHelper: function () { return false; },
    claimId: function () { return ''; },
    
    // Traps (buat old scripts)
    render: createTrap('render'),
    inject: createTrap('inject'),
    mount: createTrap('mount'),
    show: createTrap('show')
  });

  try {
    Object.defineProperty(window, 'SDLGPortalMirror', {
      value: MirrorAPI,
      writable: false,
      configurable: false
    });
  } catch (_) {
    window.SDLGPortalMirror = MirrorAPI;
  }

  // ─────────────────────────────────────────────────────────
  // 8. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    // 1. Cleanup awal
    removePanel();

    // 2. Start self-destructing observer
    startWatching();

    // 3. Re-arm on route change
    try {
      window.addEventListener('hashchange', onRouteChange);
      window.addEventListener('sdlg-route-changed', onRouteChange);
      window.addEventListener('popstate', onRouteChange);
    } catch (_) {}

    // 4. Cleanup saat page unload (biar gak nyangkut)
    try {
      window.addEventListener('beforeunload', stopWatching);
    } catch (_) {}

    // 5. Log sekali
    if (typeof console !== 'undefined' && console.info) {
      console.info(
        '%c[SDLG]%c Portal Mirror permanently disabled (sentinel mode active)',
        'background:#dc2626;color:white;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px',
        'color:#94a3b8;font-size:11px'
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})();