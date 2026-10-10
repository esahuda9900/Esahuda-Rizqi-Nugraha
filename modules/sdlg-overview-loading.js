/**
 * SDLG Overview Loading Architecture v3.0 — STABLE (no flicker)
 *
 * Design rules:
 * - NEVER modify React-owned textContent after data has appeared.
 * - No setInterval that toggles DOM values.
 * - One-shot: early nav count + CSS reveal class + boss analytics patch.
 * - React alone owns KPI / section values via `loading ? "\u2026" : value`.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_OVERVIEW_LOADING_V3__) return;
    root.__SDLG_OVERVIEW_LOADING_V3__ = true;

    var COUNT_KEY = 'sdlg:claims-count:v1';
    var TTL = 5 * 60 * 1000;
    var done = false;

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
        if (typeof n === 'number') {
          sessionStorage.setItem(COUNT_KEY, JSON.stringify({ count: n, at: Date.now() }));
        }
      } catch (_) {}
    }

    function injectCss() {
      if (document.getElementById('sdlg-overview-loading-css')) return;
      var s = document.createElement('style');
      s.id = 'sdlg-overview-loading-css';
      s.textContent = [
        '.nav-btn.is-count-loading{opacity:.85}',
        '@keyframes sdlg-soft-in{from{opacity:.55}to{opacity:1}}',
        'html.sdlg-overview-ready .metric-grid,html.sdlg-overview-ready .metric-card,',
        'html.sdlg-overview-ready .card,html.sdlg-overview-ready .wx-filter,',
        'html.sdlg-overview-ready .wx-analytics-shell{animation:sdlg-soft-in .2s ease both}'
      ].join('');
      (document.head || document.documentElement).appendChild(s);
    }

    function patchNavCount(count) {
      try {
        var buttons = document.querySelectorAll('.nav-btn');
        for (var i = 0; i < buttons.length; i++) {
          var b = buttons[i];
          var label = String(b.textContent || '');
          if (!/^Claims/i.test(label)) continue;
          if (typeof count === 'number') {
            if (/Claims\s*[\u00b7\u2022]\s*[\u2026.]/i.test(label) || /Claims\s*$/i.test(label.trim())) {
              b.textContent = 'Claims \u00b7 ' + count;
            }
            b.classList.remove('is-count-loading');
          } else {
            if (/^Claims\s*$/i.test(label.trim()) || /Claims\s*[\u00b7\u2022]\s*0\s*$/i.test(label)) {
              b.textContent = 'Claims \u00b7 \u2026';
              b.classList.add('is-count-loading');
            }
          }
        }
      } catch (_) {}
    }

    async function earlyCount() {
      try {
        var cached = readCache();
        if (cached != null) {
          patchNavCount(cached);
          return cached;
        }
        var repo = root.SDLG_REPOSITORY;
        if (repo && typeof repo.countClaimsCached === 'function') {
          var n = await repo.countClaimsCached();
          if (typeof n === 'number') {
            writeCache(n);
            patchNavCount(n);
            return n;
          }
        } else if (repo && typeof repo.countClaims === 'function') {
          var n2 = await repo.countClaims();
          if (typeof n2 === 'number') {
            writeCache(n2);
            patchNavCount(n2);
            return n2;
          }
        }
      } catch (e) {
        console.warn('[SDLG overview-loading] earlyCount', e);
      }
      return null;
    }

    function hasRealKpi() {
      try {
        var cards = document.querySelectorAll('.metric-card .metric-value');
        for (var i = 0; i < cards.length; i++) {
          var t = String(cards[i].textContent || '').trim().replace(/,/g, '');
          if (/^\d+$/.test(t) && parseInt(t, 10) > 0) return true;
        }
      } catch (_) {}
      return false;
    }

    function waitForDataThenReady() {
      if (done) return;
      var tries = 0;
      var maxTries = 40;
      var iv = setInterval(function () {
        tries++;
        if (hasRealKpi() || tries >= maxTries) {
          clearInterval(iv);
          done = true;
          try {
            document.documentElement.classList.add('sdlg-overview-ready');
          } catch (_) {}
          var c = readCache();
          if (c != null) patchNavCount(c);
          console.info('[SDLG overview-loading] v3.0 ready (no-suppress, no-flicker)');
        }
      }, 150);
    }

    function patchBossAnalytics() {
      try {
        var boss = root.SDLGBossAnalytics;
        if (!boss || boss.__sdlgLoadingPatchedV3) return;
        var origPeriod = boss.periodFilterBar;
        var origExtra = boss.renderExtraPanels;
        if (typeof origPeriod !== 'function') return;

        function isLoading(opts) {
          if (opts && opts.loading) return true;
          var claims = (opts && opts.claims) || [];
          return !claims || claims.length === 0;
        }

        var next = {};
        Object.keys(boss).forEach(function (k) { next[k] = boss[k]; });

        next.periodFilterBar = function (opts) {
          opts = opts || {};
          if (isLoading(opts)) {
            var React = opts.React;
            return React.createElement(
              'div',
              { className: 'wx-filter is-loading' },
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
          var React = opts.React;
          if (!origExtra) return null;
          if (isLoading(opts)) {
            return React.createElement(
              'div',
              { className: 'wx-analytics-shell is-loading', 'aria-busy': 'true' },
              React.createElement(
                'div',
                { className: 'wx-insight' },
                React.createElement('div', { className: 'wx-insight-badge' }, 'EXECUTIVE SNAPSHOT'),
                React.createElement('div', { style: { marginTop: 8, color: '#94a3b8', fontSize: 13 } }, '\u2026')
              )
            );
          }
          var body = origExtra(opts);
          try {
            return React.createElement(
              'div',
              { className: 'wx-analytics-shell' },
              React.createElement(
                'details',
                { style: { background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: '10px 14px' } },
                React.createElement(
                  'summary',
                  { style: { cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#1d2940' } },
                  'Executive Snapshot \u00b7 18 metrik  ',
                  React.createElement(
                    'span',
                    { style: { fontWeight: 600, color: '#64748b', fontSize: 11 } },
                    '(klik untuk buka)'
                  )
                ),
                React.createElement('div', { style: { marginTop: 12 } }, body)
              )
            );
          } catch (_) {
            return body;
          }
        };

        next.yearFilterBar = next.periodFilterBar;
        next.__sdlgLoadingPatched = true;
        next.__sdlgLoadingPatchedV3 = true;
        next.version = String(boss.version || '') + '+stable';
        root.SDLGBossAnalytics = Object.freeze(next);
      } catch (e) {
        console.warn('[SDLG overview-loading] boss patch failed', e);
      }
    }

    function boot() {
      injectCss();

      function onReady() {
        earlyCount();
        patchBossAnalytics();
        waitForDataThenReady();
        setTimeout(patchBossAnalytics, 800);
        setTimeout(patchBossAnalytics, 2000);
      }

      if (typeof root.waitForSupabaseReady === 'function') {
        root.waitForSupabaseReady().then(onReady).catch(onReady);
      } else {
        setTimeout(onReady, 200);
      }

      root.addEventListener('hashchange', function () {
        var h = String(root.location.hash || '');
        if (!/#\/?overview/i.test(h) && h !== '' && h !== '#' && h !== '#/') return;
        done = false;
        try {
          document.documentElement.classList.remove('sdlg-overview-ready');
        } catch (_) {}
        setTimeout(function () {
          earlyCount();
          patchBossAnalytics();
          waitForDataThenReady();
        }, 100);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        function () {
          try {
            boot();
          } catch (_) {}
        },
        { once: true }
      );
    } else {
      try {
        boot();
      } catch (_) {}
    }

    root.SDLGOverviewLoading = {
      version: '3.0.0',
      earlyCount: earlyCount,
      patchNavCount: patchNavCount,
      patchBossAnalytics: patchBossAnalytics
    };
    console.info('[SDLG overview-loading] v3.0 stable (no DOM suppress, no flicker)');
  } catch (e) {
    try {
      console.warn('[SDLG overview-loading] init failed (non-fatal)', e);
    } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
