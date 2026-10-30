/**
 * SDLG Ops-Clean UI Injector — V2.0 (Smart Asset Injector)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ PATH RESOLVER: Deteksi otomatis GitHub Pages / Cloudflare.
 * ✅ ERROR HANDLING: Notif merah kalau file gagal dimuat.
 * ✅ SAFE LOADING: Urutan CSS -> JS biar gak flash.
 * ✅ ZERO CLUTTER: Gak ada load dobel (cek marker).
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';
  
  if (window.__SDLG_OPS_CLEAN_V2__) return;
  window.__SDLG_OPS_CLEAN_V2__ = true;

  var CSS_MARKER = 'data-sdlg-ops-clean';
  var JS_MARKER = 'data-sdlg-core-bridge';

  // ─────────────────────────────────────────────────────────
  // 1. PATH RESOLVER (Biar gak salah folder)
  // ─────────────────────────────────────────────────────────
  function resolvePath(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path)) return path;
    
    try {
      var host = String(location.hostname || '');
      // Deteksi GitHub Project Pages (username.github.io/repo-name/)
      if (/github\.io$/i.test(host)) {
        var parts = String(location.pathname || '').split('/').filter(Boolean);
        if (parts.length >= 1 && parts[0].indexOf('.') < 0) {
          return '/' + parts[0] + (path.charAt(0) === '/' ? path : '/' + path);
        }
      }
    } catch (_) {}
    
    // Fallback untuk Cloudflare / Localhost
    return path;
  }

  // ─────────────────────────────────────────────────────────
  // 2. NOTIFICATION HELPER
  // ─────────────────────────────────────────────────────────
  function notifyError(title, msg) {
    if (window.SDLGNotify && window.SDLGNotify.error) {
      window.SDLGNotify.error(title, msg);
    } else {
      console.error('[SDLG OpsClean] ' + title + ': ' + msg);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. INJECT CSS (Prioritas Pertama)
  // ─────────────────────────────────────────────────────────
  function injectCss() {
    return new Promise(function (resolve) {
      if (document.querySelector('link[' + CSS_MARKER + ']')) {
        return resolve({ ok: true, skipped: true });
      }

      var href = resolvePath('./styles/sdlg-ops-clean-v1.css') + '?v=' + Date.now();
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute(CSS_MARKER, '1');

      link.onload = function () { resolve({ ok: true }); };
      link.onerror = function () {
        notifyError('Gagal Load CSS', 'File ops-clean.css tidak ditemukan di server.');
        resolve({ ok: false });
      };

      (document.head || document.documentElement).appendChild(link);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 4. INJECT JS (Setelah CSS Siap)
  // ─────────────────────────────────────────────────────────
  function injectJs() {
    return new Promise(function (resolve) {
      if (document.querySelector('script[' + JS_MARKER + ']')) {
        return resolve({ ok: true, skipped: true });
      }

      var src = resolvePath('./modules/sdlg-core-bridge.js');
      var script = document.createElement('script');
      script.src = src;
      script.async = false; // WAJIB FALSE: Biar urutan gak kacau
      script.setAttribute(JS_MARKER, '1');

      script.onload = function () {
        console.info('[SDLG OpsClean] ✅ Core bridge loaded.');
        resolve({ ok: true });
      };
      
      script.onerror = function () {
        notifyError('Gagal Load JS', 'File sdlg-core-bridge.js gagal di-download.');
        resolve({ ok: false });
      };

      (document.head || document.documentElement).appendChild(script);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. MAIN ORCHESTRATOR
  // ─────────────────────────────────────────────────────────
  function boot() {
    // Catatan: "Portal Mirror disabled" — sengaja gak nge-load sdlg-repair-date-inject.js
    
    // Load CSS dulu, baru JS
    injectCss()
      .then(function () {
        return injectJs();
      })
      .then(function () {
        console.info('[SDLG OpsClean] 🎉 Semua aset siap tempur.');
      });
  }

  // ─────────────────────────────────────────────────────────
  // 6. INIT
  // ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})();