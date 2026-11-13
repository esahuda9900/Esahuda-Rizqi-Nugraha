/**
 * SDLG Perf Runtime v1.7.1 — claims CSS bust + claim-detail toolbar restore
 */
(function () {
  'use strict';

  function upgradeClaimsDom() {
    /* Markup is natively rendered by React in app.html (.claims-kpi-grid/.claims-kpi) */
  }

  function bustClaimDetailToolbarCss() {
    try {
      var href = './styles/sdlg-claim-detail-toolbar-fix.css?v=20261030-toolbar-fix-v1';
      var existing = document.getElementById('sdlg-claim-detail-toolbar-fix');
      if (existing) {
        if ((existing.getAttribute('href') || '') !== href) existing.href = href;
        return;
      }
      var link = document.createElement('link');
      link.id = 'sdlg-claim-detail-toolbar-fix';
      link.rel = 'stylesheet';
      link.href = href;
      (document.head || document.documentElement).appendChild(link);
    } catch (_) {}
  }

  function bustClaimsUiCss() {
    try {
      var href = './styles/sdlg-claims-ui-fix.css?v=20261113-ui-expert-v6';
      var links = document.querySelectorAll('link[rel="stylesheet"][href*="claims-ui-fix"]');
      if (links && links.length) {
        return;
      }
      if (document.getElementById('sdlg-claims-ui-fix-bust')) return;
      var link = document.createElement('link');
      link.id = 'sdlg-claims-ui-fix-bust';
      link.rel = 'stylesheet';
      link.href = href;
      (document.head || document.documentElement).appendChild(link);
    } catch (_) {}
  }

  function tryPolyfillListPage() {
    try {
      if (!window.SDLG_REPOSITORY) return false;
      if (typeof window.SDLG_REPOSITORY.listClaimsPage === 'function') return true;
      window.SDLG_REPOSITORY.listClaimsPage = async function (page) {
        var pageSize = 100;
        try {
          if (window.SDLG_FOUNDATION && window.SDLG_FOUNDATION.LIMITS && window.SDLG_FOUNDATION.LIMITS.PAGE_SIZE) {
            pageSize = window.SDLG_FOUNDATION.LIMITS.PAGE_SIZE;
          }
        } catch (_) {}
        var from = (page || 0) * pageSize;
        var client =
          (typeof window.getSdlgSupabase === 'function' && window.getSdlgSupabase()) ||
          window.sdlgSupabase ||
          window.supabaseClient;
        if (!client) throw new Error('Supabase client not ready');
        var run = window.runSupabaseRead || function (fn) { return fn(); };
        var result = await run(function () {
          return client
            .from('claims')
            .select('*')
            .is('archived_at', null)
            .order('claim_id', { ascending: false })
            .range(from, from + pageSize - 1);
        });
        if (result && result.error) throw result.error;
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
    bustClaimsUiCss();
    bustClaimDetailToolbarCss();
    tryPolyfillListPage();
    ensureXlsxLoader();
    if (!window.SDLG_REPOSITORY) {
      window.addEventListener('load', tryPolyfillListPage, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGPerfRuntime = {
    version: '1.8.0-clean-perf',
    tryPolyfillListPage: tryPolyfillListPage,
    bustClaimsUiCss: bustClaimsUiCss,
    bustClaimDetailToolbarCss: bustClaimDetailToolbarCss,
    upgradeClaimsDom: upgradeClaimsDom
  };
})();
