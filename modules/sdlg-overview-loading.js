/**
 * SDLG Overview Loading Architecture v2.1
 * ALL Overview sections show skeleton/… during hydrate.
 * Also monkey-patches SDLGBossAnalytics periodFilterBar + renderExtraPanels.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_OVERVIEW_LOADING_V21__) return;
    root.__SDLG_OVERVIEW_LOADING_V21__ = true;
    root.__SDLG_OVERVIEW_LOADING_V2__ = true;
    root.__SDLG_OVERVIEW_LOADING_V1__ = true;

    var COUNT_KEY = 'sdlg:claims-count:v1';
    var TTL = 5 * 60 * 1000;
    var hydrateUntil = Date.now() + 8000;

    function readCache() {
      try {
        var raw = sessionStorage.getItem(COUNT_KEY);
        if (!raw) return null;
        var p = JSON.parse(raw);
        if (!p || typeof p.count !== 'number') return null;
        if (Date.now() - (p.at || 0) > TTL) return null;
        return p.count;
      } catch (_) { return null; }
    }

    function writeCache(n) {
      try {
        if (typeof n === 'number') sessionStorage.setItem(COUNT_KEY, JSON.stringify({ count: n, at: Date.now() }));
      } catch (_) {}
    }

    function injectCss() {
      if (document.getElementById('sdlg-overview-loading-css')) return;
      var s = document.createElement('style');
      s.id = 'sdlg-overview-loading-css';
      s.textContent = [
        '@keyframes sdlg-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}',
        '.metric-card.is-loading .metric-value,.wx-metric.is-loading .wx-metric-value{opacity:.45;letter-spacing:.08em}',
        '.nav-btn.is-count-loading{opacity:.85}',
        '.sdlg-skel{display:inline-block;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:sdlg-pulse 1.5s ease-in-out infinite;border-radius:4px}',
        '.wx-filter.is-loading .wx-filter-count{opacity:.6}'
      ].join('');
      (document.head || document.documentElement).appendChild(s);
    }

    function isHydrating() { return Date.now() < hydrateUntil; }

    function hasClaimData() {
      try {
        return !!document.querySelector('.claim-row, .claims-table-shell tbody tr, [data-sdlg-claims-ready="1"]');
      } catch (_) { return false; }
    }

    function suppressLoadingZeros() {
      if (!isHydrating() && hasClaimData()) return;
      try {
        var vals = document.querySelectorAll('.metric-value, .wx-metric-value, b');
        for (var i = 0; i < vals.length; i++) {
          var el = vals[i];
          var t = String(el.textContent || '').trim();
          if (t === '0' || t === '0.0%' || t === '0%' || t === 'Rp 0' || t === 'Rp0') {
            var page = el.closest('.page, .wx-analytics-shell, .metric-card, .card');
            if (!page) continue;
            if (hasClaimData() && !isHydrating()) continue;
            el.textContent = '\u2026';
            if (el.parentElement) el.parentElement.classList.add('is-loading');
          }
        }
        var counts = document.querySelectorAll('.wx-filter-count');
        for (var j = 0; j < counts.length; j++) {
          var c = counts[j];
          var ct = String(c.textContent || '');
          if (/^0\s+claim/.test(ct) && (isHydrating() || !hasClaimData())) {
            c.textContent = '\u2026 claim dalam periode';
          }
        }
        var emptyMsgs = document.querySelectorAll('div, span, p');
        for (var k = 0; k < emptyMsgs.length; k++) {
          var em = emptyMsgs[k];
          if (em.children && em.children.length > 0) continue;
          var et = String(em.textContent || '').trim();
          if (/^Belum ada (data|tanggal|claim)/i.test(et) && (isHydrating() || !hasClaimData())) {
            em.textContent = '\u2026';
            em.setAttribute('data-sdlg-was-empty', '1');
          }
        }
      } catch (_) {}
    }

    function patchNavCount(count) {
      try {
        var buttons = document.querySelectorAll('.nav-btn');
        for (var i = 0; i < buttons.length; i++) {
          var b = buttons[i];
          var label = String(b.textContent || '');
          if (!/^Claims/i.test(label)) continue;
          if (typeof count === 'number') {
            b.textContent = 'Claims \u00b7 ' + count;
            b.classList.remove('is-count-loading');
          } else {
            b.textContent = 'Claims \u00b7 \u2026';
            b.classList.add('is-count-loading');
          }
        }
      } catch (_) {}
    }

    async function earlyCount() {
      try {
        var cached = readCache();
        if (cached != null) { patchNavCount(cached); return cached; }
        var repo = root.SDLG_REPOSITORY;
        if (repo && typeof repo.countClaimsCached === 'function') {
          var n = await repo.countClaimsCached();
          if (typeof n === 'number') { writeCache(n); patchNavCount(n); return n; }
        } else if (repo && typeof repo.countClaims === 'function') {
          var n2 = await repo.countClaims();
          if (typeof n2 === 'number') { writeCache(n2); patchNavCount(n2); return n2; }
        }
      } catch (e) {
        console.warn('[SDLG overview-loading] earlyCount', e);
      }
      return null;
    }

    function patchBossAnalytics() {
      try {
        var boss = root.SDLGBossAnalytics;
        if (!boss || boss.__sdlgLoadingPatched) return;
        var origPeriod = boss.periodFilterBar;
        var origExtra = boss.renderExtraPanels;
        if (typeof origPeriod !== 'function') return;

        function isLoading(opts) {
          if (opts && opts.loading) return true;
          var claims = (opts && opts.claims) || [];
          return isHydrating() && (!claims || claims.length === 0);
        }

        var next = {};
        Object.keys(boss).forEach(function (k) { next[k] = boss[k]; });
        next.periodFilterBar = function (opts) {
          opts = opts || {};
          if (isLoading(opts)) {
            var React = opts.React;
            return React.createElement('div', { className: 'wx-filter is-loading' },
              React.createElement('div', { className: 'wx-filter-label' }, 'Analisa periode'),
              React.createElement('select', { disabled: true }, React.createElement('option', null, 'Semua tahun')),
              React.createElement('select', { disabled: true }, React.createElement('option', null, 'Semua bulan')),
              React.createElement('div', { className: 'wx-filter-count' }, '\u2026 claim dalam periode')
            );
          }
          return origPeriod(opts);
        };
        next.renderExtraPanels = function (opts) {
          opts = opts || {};
          if (isLoading(opts) && typeof origExtra === 'function') {
            var React = opts.React;
            function skel(w, h) {
              return React.createElement('div', { className: 'sdlg-skel', style: { width: w || '100%', height: h || 18 } });
            }
            return React.createElement('div', { className: 'wx-analytics-shell is-loading', 'aria-busy': 'true' },
              React.createElement('div', { className: 'wx-insight' },
                React.createElement('div', { className: 'wx-insight-badge' }, 'EXECUTIVE SNAPSHOT'),
                React.createElement('div', { style: { marginTop: 8 } }, skel('55%', 16)),
                React.createElement('div', { className: 'wx-metric-grid', style: { marginTop: 12 } },
                  [1,2,3,4,5,6].map(function (i) {
                    return React.createElement('div', { key: i, className: 'wx-metric' },
                      skel('70%', 10),
                      React.createElement('div', { style: { marginTop: 8 } }, skel('40%', 22)),
                      React.createElement('div', { style: { marginTop: 6 } }, skel('50%', 10))
                    );
                  })
                )
              )
            );
          }
          return origExtra ? origExtra(opts) : null;
        };
        next.yearFilterBar = next.periodFilterBar;
        next.__sdlgLoadingPatched = true;
        next.version = String(boss.version || '') + '+loading';
        root.SDLGBossAnalytics = Object.freeze(next);
        console.info('[SDLG overview-loading] boss analytics patched for loading state');
      } catch (e) {
        console.warn('[SDLG overview-loading] boss patch failed', e);
      }
    }

    function boot() {
      injectCss();
      var c = readCache();
      if (c != null) patchNavCount(c);
      else patchNavCount(null);

      function onReady() {
        hydrateUntil = Date.now() + 8000;
        earlyCount();
        patchBossAnalytics();
        var tries = 0;
        var iv = setInterval(function () {
          suppressLoadingZeros();
          if (tries % 5 === 0) patchBossAnalytics();
          tries++;
          if (tries > 40 || (!isHydrating() && hasClaimData())) clearInterval(iv);
        }, 120);
      }

      if (typeof root.waitForSupabaseReady === 'function') {
        root.waitForSupabaseReady().then(onReady).catch(onReady);
      } else {
        setTimeout(onReady, 300);
        setTimeout(onReady, 1000);
      }

      root.addEventListener('hashchange', function () {
        hydrateUntil = Date.now() + 4000;
        setTimeout(function () {
          var c2 = readCache();
          if (c2 != null) patchNavCount(c2);
          suppressLoadingZeros();
          patchBossAnalytics();
        }, 150);
      });

      root.addEventListener('sdlg-session-ready', function () {
        hydrateUntil = Date.now() + 8000;
        setTimeout(onReady, 200);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { boot(); } catch (_) {} }, { once: true });
    } else {
      try { boot(); } catch (_) {}
    }

    root.SDLGOverviewLoading = { version: '2.1.0', earlyCount: earlyCount, patchNavCount: patchNavCount, patchBossAnalytics: patchBossAnalytics };
  } catch (e) {
    try { console.warn('[SDLG overview-loading] init failed (non-fatal)', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
