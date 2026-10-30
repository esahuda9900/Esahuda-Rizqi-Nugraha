/**
 * SDLG Perf Runtime v1.6 — claims CSS bust v6 + DOM upgrade for Claims KPI
 */
(function () {
  'use strict';

  function upgradeClaimsDom() {
    try {
      var page = document.querySelector('.page:has(.claims-searchbar)');
      if (!page) return;
      page.querySelectorAll('.claim-row.sdlg-card').forEach(function (el) {
        el.classList.remove('sdlg-card');
      });
      page.querySelectorAll('.sdlg-card').forEach(function (el) {
        if (el.classList.contains('claim-row')) return;
        if (el.querySelector('button, input, select, textarea, a')) return;
        if (el.children.length > 4) return;
        el.classList.remove('sdlg-card');
        el.classList.add('claims-kpi');
        var kids = el.children;
        if (kids[0] && !kids[0].classList.contains('claims-kpi__label')) {
          kids[0].classList.add('claims-kpi__label');
        }
        if (kids[1] && !kids[1].classList.contains('claims-kpi__value')) {
          kids[1].classList.add('claims-kpi__value');
        }
      });
      var firstKpi = page.querySelector('.claims-kpi');
      if (firstKpi && firstKpi.parentElement && !firstKpi.parentElement.classList.contains('claims-kpi-grid')) {
        firstKpi.parentElement.classList.add('claims-kpi-grid');
      }
    } catch (_) {}
  }

  function bustClaimsUiCss() {
    try {
      var href = './styles/sdlg-claims-ui-fix.css?v=20261030-claims-modern-v6';
      var links = document.querySelectorAll('link[rel="stylesheet"][href*="claims-ui-fix"]');
      if (links && links.length) {
        for (var i = 0; i < links.length; i++) links[i].href = href;
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
    bustClaimsUiCss();
    upgradeClaimsDom();
    try {
      if (typeof MutationObserver !== 'undefined') {
        var tmr = null;
        new MutationObserver(function () {
          clearTimeout(tmr);
          tmr = setTimeout(upgradeClaimsDom, 80);
        }).observe(document.documentElement, { childList: true, subtree: true });
      }
      setInterval(upgradeClaimsDom, 2000);
    } catch (_) {}
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

  window.SDLGPerfRuntime = {
    version: '1.6.0-claims-modern-v6',
    tryPolyfillListPage: tryPolyfillListPage,
    bustClaimsUiCss: bustClaimsUiCss,
    upgradeClaimsDom: upgradeClaimsDom,
  };
})();
