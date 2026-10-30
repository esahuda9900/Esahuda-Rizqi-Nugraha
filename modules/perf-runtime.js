/**
 * SDLG Perf Runtime v1.8 — claims list + claim-detail evidence polish
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

  /** Claim detail: evidence boxes look like form inputs when empty — restyle to chips. */
  function upgradeClaimDetailDom() {
    try {
      var page = document.querySelector('.page.claim-detail-page');
      if (!page) return;

      var headings = page.querySelectorAll('div');
      var evidenceRoot = null;
      for (var i = 0; i < headings.length; i++) {
        var t = String(headings[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (/^Evidence\s*\/?\s*Photo Context$/i.test(t) || /^EVIDENCE\s*\/?\s*PHOTO/i.test(t)) {
          evidenceRoot = headings[i].parentElement;
          break;
        }
      }
      if (!evidenceRoot) return;

      var grid = null;
      var children = evidenceRoot.children;
      for (var c = 0; c < children.length; c++) {
        var el = children[c];
        if (el.children && el.children.length >= 2) {
          var st = String(el.getAttribute('style') || '');
          if (/grid/i.test(st) || el.children.length >= 4) {
            grid = el;
            break;
          }
        }
      }
      if (!grid) {
        // fallback: first multi-child div after heading
        for (var c2 = 0; c2 < children.length; c2++) {
          if (children[c2].children && children[c2].children.length > 1) {
            grid = children[c2];
            break;
          }
        }
      }
      if (!grid) return;

      grid.classList.add('cd-evidence-grid');
      Array.prototype.forEach.call(grid.children, function (item) {
        if (!item || item.nodeType !== 1) return;
        item.classList.add('cd-evidence-item');
        var kids = item.children;
        if (kids[0]) kids[0].classList.add('cd-evidence-label');
        if (kids[1]) {
          kids[1].classList.add('cd-evidence-value');
          var val = String(kids[1].textContent || '').trim();
          if (!val) {
            item.classList.add('is-empty');
            if (!kids[1].getAttribute('data-cd-empty')) {
              kids[1].setAttribute('data-cd-empty', '1');
              kids[1].textContent = 'No caption';
            }
          } else {
            item.classList.remove('is-empty');
          }
        } else {
          item.classList.add('is-empty');
        }
      });
    } catch (_) {}
  }

  function bustClaimsUiCss() {
    try {
      var href = './styles/sdlg-claims-ui-fix.css?v=20261030-stable-v2';
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

  function runUpgrades() {
    upgradeClaimsDom();
    upgradeClaimDetailDom();
  }

  function boot() {
    bustClaimsUiCss();
    runUpgrades();
    try {
      if (typeof MutationObserver !== 'undefined') {
        var tmr = null;
        new MutationObserver(function () {
          clearTimeout(tmr);
          tmr = setTimeout(runUpgrades, 80);
        }).observe(document.documentElement, { childList: true, subtree: true });
      }
      setInterval(runUpgrades, 2000);
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
    version: '1.8.0-claim-detail',
    tryPolyfillListPage: tryPolyfillListPage,
    bustClaimsUiCss: bustClaimsUiCss,
    upgradeClaimsDom: upgradeClaimsDom,
    upgradeClaimDetailDom: upgradeClaimDetailDom
  };
})();
