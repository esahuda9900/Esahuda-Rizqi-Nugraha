/**
 * SDLG Perf Runtime v1.0
 * - Polyfill listClaimsPage if build patch not yet applied
 * - Ensure SheetJS loads on demand before export
 * - No business logic changes
 */
(function () {
  'use strict';

  function tryPolyfillListPage() {
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
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureXlsxLoader() {
    if (typeof window.SDLG_LOAD_XLSX === 'function') return;
    window.SDLG_LOAD_XLSX = function () {
      if (window.XLSX) return Promise.resolve(window.XLSX);
      if (window.__sdlgXlsxLoading) return window.__sdlgXlsxLoading;
      window.__sdlgXlsxLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.async = true;
        s.onload = function () { resolve(window.XLSX); };
        s.onerror = function () { reject(new Error('Failed to load SheetJS')); };
        (document.head || document.documentElement).appendChild(s);
      });
      return window.__sdlgXlsxLoading;
    };
  }

  /** Wrap common export entry points if they expect global XLSX */
  function patchExportClicks() {
    document.addEventListener(
      'click',
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var btn = t.closest('button, a');
        if (!btn) return;
        var label = String(btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
        if (!/export|excel|xlsx|download.*csv|unduh/.test(label)) return;
        if (window.XLSX) return;
        if (typeof window.SDLG_LOAD_XLSX !== 'function') return;
        // Best-effort preload; do not block click handling
        window.SDLG_LOAD_XLSX().catch(function () {});
      },
      true
    );
  }

  function boot() {
    ensureXlsxLoader();
    patchExportClicks();
    var tries = 0;
    (function poll() {
      if (tryPolyfillListPage() || tries++ > 40) return;
      setTimeout(poll, 250);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGPerfRuntime = { version: '1.0', ensureXlsx: function () {
    ensureXlsxLoader();
    return window.SDLG_LOAD_XLSX();
  } };
})();
