/**
 * SDLG Perf Runtime v1.0 — soft-restore from stable
 * - Polyfill listClaimsPage if needed
 * - Ensure SheetJS loads on demand before export
 */
(function () {
  'use strict';

  function tryPolyfillListPage() {
    try {
      if (!window.SDLG_REPOSITORY || !window.SDLG_FOUNDATION) return false;
      if (typeof window.SDLG_REPOSITORY.listClaimsPage === 'function') return true;
      window.SDLG_REPOSITORY.listClaimsPage = async function (page, opts) {
        var pageSize = (window.SDLG_FOUNDATION.LIMITS && window.SDLG_FOUNDATION.LIMITS.PAGE_SIZE) || 100;
        var from = (page || 0) * pageSize;
        var run = window.runSupabaseRead || function (fn) { return fn(); };
        var result = await window.SDLG_FOUNDATION.retry(async function () {
          var r = await run(function () {
            return window.sdlgSupabase
              .from('claims')
              .select('*')
              .order('created_at', { ascending: false })
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
    if (typeof window.SDLGEnsureXLSX === 'function') return;
    window.SDLGEnsureXLSX = function () {
      return new Promise(function (resolve, reject) {
        if (window.XLSX) return resolve(window.XLSX);
        var existing = document.querySelector('script[data-sdlg-xlsx]');
        if (existing) {
          existing.addEventListener('load', function () { resolve(window.XLSX); });
          existing.addEventListener('error', function () { reject(new Error('XLSX load failed')); });
          return;
        }
        var s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.async = true;
        s.setAttribute('data-sdlg-xlsx', '1');
        s.onload = function () { resolve(window.XLSX); };
        s.onerror = function () { reject(new Error('XLSX CDN unavailable')); };
        document.head.appendChild(s);
      });
    };
  }

  function boot() {
    tryPolyfillListPage();
    ensureXlsxLoader();
    var tries = 0;
    var t = setInterval(function () {
      if (tryPolyfillListPage() || ++tries > 40) clearInterval(t);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGPerfRuntime = { version: '1.0.0-soft-restore', tryPolyfillListPage: tryPolyfillListPage };
})();
