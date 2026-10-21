/**
 * SDLG Perf Runtime — V2.0 (Bulletproof Performance)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ SMART EXPORT INTERCEPTOR: Pause klik -> Load XLSX -> Resume klik.
 * ✅ CDN TIMEOUT & RETRY: Anti-hang kalau internet lemot.
 * ✅ SMART POLLING: Nunggu global object tanpa setTimeout 10 detik.
 * ✅ SDLGNotify INTEGRATION: Kasih feedback visual ke user.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_PERF_RUNTIME_V2__) return;
  window.__SDLG_PERF_RUNTIME_V2__ = true;

  // ─────────────────────────────────────────────────────────
  // 1. SMART WAIT (Ganti Polling 40x)
  // ─────────────────────────────────────────────────────────
  function waitForGlobals(conditionFn, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (conditionFn()) return resolve();
      
      var start = Date.now();
      var timer = setInterval(function () {
        if (conditionFn()) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Timeout menunggu dependensi global.'));
        }
      }, 100);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 2. POLYFILL LIST CLAIMS PAGE
  // ─────────────────────────────────────────────────────────
  async function tryPolyfillListPage() {
    try {
      if (!window.SDLG_REPOSITORY || !window.SDLG_FOUNDATION) return false;
      if (typeof window.SDLG_REPOSITORY.listClaimsPage === 'function') return true;
      if (typeof window.SDLG_REPOSITORY.listClaims !== 'function') return false;
      if (!window.sdlgSupabase || !window.SDLG_DATA_MODEL) return false;

      window.SDLG_REPOSITORY.listClaimsPage = async function (page) {
        var pageSize = (window.SDLG_FOUNDATION.LIMITS && window.SDLG_FOUNDATION.LIMITS.PAGE_SIZE) || 100;
        var from = (page || 0) * pageSize;
        var run = window.runSupabaseRead || function (fn) { return fn(); };
        
        var result = await window.SDLG_FOUNDATION.retry(async function () {
          var r = await run(function () {
            return window.sdlgSupabase
              .from('claims')
              .select('*')
              .order('claim_id', { ascending: false })
              .range(from, from + pageSize - 1);
          });
          if (r && r.error) throw r.error;
          return r;
        });
        
        var rows = (result && result.data) || [];
        if (window.SDLG_DATA_MODEL && typeof window.SDLG_DATA_MODEL.normalizeClaimCollection === 'function') {
          return window.SDLG_DATA_MODEL.normalizeClaimCollection(rows).rows;
        }
        return rows;
      };
      console.info('[SDLG Perf] ✅ Polyfill listClaimsPage applied.');
      return true;
    } catch (_) {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. ROBUST XLSX LOADER (Timeout + Retry)
  // ─────────────────────────────────────────────────────────
  function ensureXlsxLoader() {
    if (typeof window.SDLG_LOAD_XLSX === 'function') return;

    window.SDLG_LOAD_XLSX = function (retries) {
      retries = retries || 0;
      
      // Udah ada di memory
      if (window.XLSX) return Promise.resolve(window.XLSX);
      // Lagi loading (biar gak dobel download)
      if (window.__sdlgXlsxLoading) return window.__sdlgXlsxLoading;

      window.__sdlgXlsxLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.async = true;
        
        var timeoutId = setTimeout(function () {
          s.onload = s.onerror = null;
          s.remove();
          if (retries < 1) {
            console.warn('[SDLG Perf] XLSX timeout, retrying...');
            window.__sdlgXlsxLoading = null;
            resolve(window.SDLG_LOAD_XLSX(retries + 1));
          } else {
            reject(new Error('Gagal load SheetJS (Timeout)'));
          }
        }, 15000); // 15s timeout

        s.onload = function () {
          clearTimeout(timeoutId);
          resolve(window.XLSX);
        };
        
        s.onerror = function () {
          clearTimeout(timeoutId);
          s.remove();
          if (retries < 1) {
            window.__sdlgXlsxLoading = null;
            resolve(window.SDLG_LOAD_XLSX(retries + 1));
          } else {
            reject(new Error('Gagal load SheetJS (Network)'));
          }
        };
        
        (document.head || document.documentElement).appendChild(s);
      });
      
      // Kalau gagal, reset biar bisa dicoba lagi nanti
      window.__sdlgXlsxLoading.catch(function() { window.__sdlgXlsxLoading = null; });
      
      return window.__sdlgXlsxLoading;
    };
  }

  // ─────────────────────────────────────────────────────────
  // 4. SMART EXPORT INTERCEPTOR (Anti Race Condition)
  // ─────────────────────────────────────────────────────────
  function patchExportClicks() {
    document.addEventListener('click', async function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      
      var btn = t.closest('button, a');
      if (!btn) return;

      // Kalau tombol lagi diproses, abaikan
      if (btn.getAttribute('data-sdlg-exporting') === 'true') return;

      var label = String(btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
      if (!/export|excel|xlsx|download.*csv|unduh/.test(label)) return;

      // Kalau XLSX udah siap, biarin kode asli jalan
      if (window.XLSX) return;

      // ─── STOP CLICK ASLI ───
      e.preventDefault();
      e.stopPropagation();

      try {
        btn.setAttribute('data-sdlg-exporting', 'true');
        
        // Visual feedback
        if (window.SDLGNotify) window.SDLGNotify.info('Menyiapkan Excel', 'Memuat library SheetJS...');
        var originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Memuat...';
        btn.style.opacity = '0.7';

        // Tungguin library selesai di-download
        await window.SDLG_LOAD_XLSX();

        // Balikin tombol ke semula
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
        btn.removeAttribute('data-sdlg-exporting');

        if (window.SDLGNotify) window.SDLGNotify.success('Siap!', 'Memulai proses export...');

        // ─── LANJUTKAN CLICK ASLI ───
        // Delay dikit biar event loop sempet napas
        setTimeout(function () { btn.click(); }, 50);

      } catch (err) {
        btn.removeAttribute('data-sdlg-exporting');
        btn.style.opacity = '1';
        if (window.SDLGNotify) window.SDLGNotify.error('Gagal Export', 'Library Excel gagal dimuat. Cek koneksi internet.');
      }
    }, true); // Pakai phase Capture biar dieksekusi duluan
  }

  // ─────────────────────────────────────────────────────────
  // 5. BOOT
  // ─────────────────────────────────────────────────────────
  async function boot() {
    ensureXlsxLoader();
    patchExportClicks();

    try {
      await waitForGlobals(function () {
        return !!(window.SDLG_REPOSITORY && window.SDLG_FOUNDATION && window.sdlgSupabase);
      }, 10000); // Nunggu maksimal 10 detik
      
      tryPolyfillListPage();
    } catch (err) {
      console.warn('[SDLG Perf] Gagal init polyfill:', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 6. PUBLIC API
  // ─────────────────────────────────────────────────────────
  window.SDLGPerfRuntime = {
    version: '2.0.0',
    ensureXlsx: function () {
      ensureXlsxLoader();
      return window.SDLG_LOAD_XLSX();
    }
  };

})();