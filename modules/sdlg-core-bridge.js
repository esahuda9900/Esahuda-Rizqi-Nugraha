/**
 * SDLG Core Bridge — V3.0 (Bulletproof Core Loader)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ ZERO INLINE STYLE: Error banner pake SDLGNotify (auto dark mode).
 * ✅ SMART TIMEOUT: 10s timeout + 1x retry kalau server lemot.
 * ✅ PROMISE CHAIN: Anti callback hell & race condition.
 * ✅ ROBUST PATH: Tetap dukung GitHub Pages & Cloudflare.
 * ✅ EXPOSE API: Bisa dipanggil manual via SDLGCore.load().
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;
  if (window.__SDLG_CORE_BRIDGE_V3__) return;
  window.__SDLG_CORE_BRIDGE_V3__ = true;
  window.__SDLG_CORE_BRIDGE__ = true; // Backward compat

  // ═════════════════════════════════════════════════════════
  // 1. KONFIGURASI FILE
  // ═════════════════════════════════════════════════════════
  var FILES = [
    { src: 'modules/sdlg-core-constants.js', marker: 'data-sdlg-core-constants', name: 'Constants' },
    { src: 'modules/sdlg-core-date.js',      marker: 'data-sdlg-core-date',      name: 'Date Utils' },
    { src: 'modules/sdlg-core-currency.js',  marker: 'data-sdlg-core-currency',  name: 'Currency' }
  ];
  
  var LOAD_TIMEOUT = 10000; // 10 detik

  // ═════════════════════════════════════════════════════════
  // 2. PATH RESOLVER (WAJIB - Jangan Dihapus!)
  // ═════════════════════════════════════════════════════════
  function resolvePath(rel) {
    rel = String(rel || '').replace(/^\//, '');
    try {
      var baseEl = document.querySelector('base[href]');
      if (baseEl && baseEl.href) return new URL(rel, baseEl.href).href;
    } catch (_) {}
    try {
      var path = String(location.pathname || '/');
      var parts = path.split('/').filter(Boolean);
      if (parts.length && parts[0].indexOf('.') < 0 && /github\.io$/i.test(location.hostname || '')) {
        return '/' + parts[0] + '/' + rel;
      }
    } catch (_) {}
    return './' + rel;
  }

  // ═════════════════════════════════════════════════════════
  // 3. SMART ERROR HANDLER (SDLGNotify Integration)
  // ═════════════════════════════════════════════════════════
  function showErrorBanner(failedModules) {
    var names = failedModules.map(function(m) { return m.name; }).join(', ');
    
    // Prioritas 1: Pakai SDLGNotify (cantik, ada dark mode)
    if (window.SDLGNotify && window.SDLGNotify.error) {
      window.SDLGNotify.error(
        'Modul Gagal Dimuat', 
        'File berikut gagal di-download: ' + names + '. Coba refresh atau periksa koneksi.'
      );
      return;
    }

    // Prioritas 2: Fallback ke console kalau notifier belum siap
    console.error('[SDLG Core] Modul Gagal Dimuat: ' + names);
  }

  // ═════════════════════════════════════════════════════════
  // 4. LOADER ENGINE (Promise + Timeout + Retry)
  // ═════════════════════════════════════════════════════════
  function loadModule(mod, retries) {
    retries = retries || 0;
    
    return new Promise(function (resolve) {
      // Kalau udah ada di DOM, skip
      if (document.querySelector('script[' + mod.marker + ']')) {
        return resolve({ ok: true, skipped: true });
      }

      var s = document.createElement('script');
      s.src = resolvePath(mod.src);
      s.async = false;
      s.setAttribute(mod.marker, '1');

      var timeoutId = setTimeout(function () {
        s.onload = s.onerror = null;
        s.remove(); // Bersihin script yang nge-hang
        
        if (retries < 1) {
          console.warn('[SDLG Core] Timeout load ' + mod.name + '. Mencoba ulang...');
          resolve(loadModule(mod, retries + 1));
        } else {
          console.error('[SDLG Core] Gagal total load ' + mod.name);
          resolve({ ok: false, error: mod, reason: 'timeout' });
        }
      }, LOAD_TIMEOUT);

      s.onload = function () {
        clearTimeout(timeoutId);
        resolve({ ok: true });
      };

      s.onerror = function () {
        clearTimeout(timeoutId);
        s.remove();
        
        if (retries < 1) {
          console.warn('[SDLG Core] 404 ' + mod.name + '. Mencoba ulang...');
          resolve(loadModule(mod, retries + 1));
        } else {
          console.error('[SDLG Core] Gagal total load ' + mod.name);
          resolve({ ok: false, error: mod, reason: 'network' });
        }
      };

      (document.head || document.documentElement).appendChild(s);
    });
  }

  // ═════════════════════════════════════════════════════════
  // 5. ORCHESTRATOR (Sequential Loading)
  // ═════════════════════════════════════════════════════════
  async function loadAll() {
    var failures = [];
    
    console.info('[SDLG Core] Memulai load ' + FILES.length + ' modul...');

    // Load satu per satu secara berurutan
    for (var i = 0; i < FILES.length; i++) {
      var result = await loadModule(FILES[i]);
      if (!result.ok) failures.push(result.error);
    }

    if (failures.length > 0) {
      showErrorBanner(failures);
      window.dispatchEvent(new CustomEvent('sdlg-core-error', { detail: failures }));
    } else {
      console.info('[SDLG Core] ✅ Semua modul siap.');
      window.dispatchEvent(new CustomEvent('sdlg-core-ready'));
    }
  }

  // ═════════════════════════════════════════════════════════
  // 6. PUBLIC API & INIT
  // ═════════════════════════════════════════════════════════
  window.SDLGCore = {
    version: '3.0.0',
    ready: function () {
      return !!(window.SDLGCoreDate && window.SDLGCoreCurrency && window.SDLGCoreConstants);
    },
    reload: function () {
      // Hapus semua script lama biar bisa load ulang dari awal
      FILES.forEach(function (m) {
        var old = document.querySelector('script[' + m.marker + ']');
        if (old) old.remove();
      });
      return loadAll();
    },
    showError: function (mods) { 
      showErrorBanner(mods || []); 
    }
  };

  // Jalanin!
  loadAll();

})();