/**
 * SDLG Claim Context Loader — V2.0 (Smart Sequential Loader)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ANTI-RACE CONDITION: File di-load berurutan (async=false).
 * ✅ SMART NOTIFICATION: Muncul notif kalau ada file gagal load.
 * ✅ AUTO-RETRY: Coba ulang 1x kalau gagal.
 * ✅ ROBUST PATH: Deteksi otomatis GitHub Pages / Cloudflare.
 * ✅ API EXPORT: Bisa dipanggil manual kalau butuh.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. DEFINISI GLOBAL HELPER (Master Resolution)
  // ─────────────────────────────────────────────────────────
  function clean(value) { 
    return value == null ? '' : String(value).replace(/\s+/g, ' ').trim(); 
  }
  
  function normalizeModel(value) { 
    return clean(value).replace(/^SDLG\s+/i, '').replace(/\s+/g, '').toUpperCase(); 
  }
  
  // Note: Gak pake Object.freeze biar modul lain bisa nambahin properti
  root.SDLGMasterResolutionUX = root.SDLGMasterResolutionUX || { 
    clean: clean, 
    normalizeModel: normalizeModel 
  };

  // ─────────────────────────────────────────────────────────
  // 2. CEK APAKAH UDAH PERNAH DI-LOAD
  // ─────────────────────────────────────────────────────────
  if (window.__SDLG_CLAIM_CONTEXT_LOADER_V2__) return;
  window.__SDLG_CLAIM_CONTEXT_LOADER_V2__ = true;
  window.__SDLG_CLAIM_CONTEXT_LOADER_V17__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 3. DAFTAR MODUL (Urutan Penting!)
  // ─────────────────────────────────────────────────────────
  var MODULES = [
    { src: 'modules/sdlg-policy-repair-hardfix.js?v=20261008-v2.1', name: 'Policy Repair Hardfix' },
    { src: 'modules/sdlg-portal-enrich.js?v=20261008-v1.4',          name: 'Portal Enrich' },
    { src: 'modules/sdlg-policy-table-fill.js?v=20261008-v1.1',      name: 'Policy Table Fill' },
    { src: 'modules/claim-context-resolve.js?v=20261008-v4',         name: 'Claim Context Resolve' },
    { src: 'modules/sdlg-portal-copy-helper.js?v=20261008-v1.3',     name: 'Portal Copy Helper' },
    { src: 'modules/sdlg-portal-ux-v2.js?v=20261008-v2.1',           name: 'Portal UX v2' }
  ];

  // ─────────────────────────────────────────────────────────
  // 4. UTILITIES
  // ─────────────────────────────────────────────────────────
  function getBasePath() {
    try {
      if (/github\.io/i.test(location.host)) {
        var parts = location.pathname.split('/').filter(Boolean);
        if (parts.length >= 1) return '/' + parts[0] + '/';
      }
    } catch (_) {}
    return './';
  }

  function notifyError(title, msg) {
    if (root.SDLGNotify && root.SDLGNotify.error) {
      root.SDLGNotify.error(title, msg);
    } else {
      console.error('[SDLG Loader] ' + title + ': ' + msg);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. LOADER FUNCTION (Sequential + Retry)
  // ─────────────────────────────────────────────────────────
  function loadScript(url, name, retries) {
    retries = retries || 0;
    return new Promise(function (resolve) {
      // Cek kalau udah ada di DOM
      if (document.querySelector('script[src="' + url + '"]')) {
        return resolve({ ok: true, skipped: true });
      }

      var s = document.createElement('script');
      s.src = url;
      s.async = false; // WAJIB: Biar urutan gak kacau
      
      var timeoutId = setTimeout(function () {
        s.onload = s.onerror = null;
        s.remove();
        handleFail('Timeout loading: ' + name);
      }, 15000); // 15 detik timeout

      function handleFail(reason) {
        clearTimeout(timeoutId);
        if (retries < 1) {
          console.warn('[SDLG Loader] Gagal load ' + name + '. Mencoba ulang...');
          // Coba lagi setelah 1 detik
          setTimeout(function () {
            resolve(loadScript(url, name, retries + 1));
          }, 1000);
        } else {
          notifyError('Modul Gagal Dimuat', 'File berikut gagal di-download: ' + name);
          resolve({ ok: false, error: reason });
        }
      }

      s.onload = function () {
        clearTimeout(timeoutId);
        console.log('[SDLG Loader] ✅ Loaded: ' + name);
        resolve({ ok: true });
      };

      s.onerror = function () {
        s.remove();
        handleFail('404 atau network error');
      };

      (document.head || document.documentElement).appendChild(s);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. EXECUTE (Chain Promise)
  // ─────────────────────────────────────────────────────────
  function loadAllModules() {
    var base = getBasePath();
    console.info('[SDLG Loader] Memulai load ' + MODULES.length + ' modul context...');
    
    var chain = Promise.resolve();
    
    MODULES.forEach(function (mod) {
      chain = chain.then(function () {
        return loadScript(base + mod.src, mod.name);
      });
    });

    chain.then(function () {
      console.info('[SDLG Loader] 🎉 SEMUA MODUL CONTEXT SELESAI!');
      root.dispatchEvent(new CustomEvent('sdlg-context-ready'));
    });
  }

  // Jalanin
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllModules, { once: true });
  } else {
    loadAllModules();
  }

  // Export API
  root.SDLGClaimContextLoader = {
    version: '2.0.0',
    reload: loadAllModules,
    modules: MODULES
  };

})(typeof window !== 'undefined' ? window : globalThis);