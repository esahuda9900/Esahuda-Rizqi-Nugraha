/**
 * SDLG Overview Loading Architecture v1.0
 * Runtime patch: eliminates 0 → 100 → 538 KPI flicker.
 * - Uses countClaimsCached when available
 * - Prevents intermediate setClaims(firstPage)
 * - Nav + KPI show "…" while loading
 * Fail-safe: never crash the app.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_OVERVIEW_LOADING_V1__) return;
    root.__SDLG_OVERVIEW_LOADING_V1__ = true;

    var COUNT_KEY = 'sdlg:claims-count:v1';
    var TTL = 5 * 60 * 1000;

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
        '.metric-card.is-loading .metric-value{opacity:.45;letter-spacing:.08em}',
        '.nav-btn.is-count-loading{opacity:.85}'
      ].join('');
      (document.head || document.documentElement).appendChild(s);
    }

    function suppressZeroKpis() {
      try {
        var cards = document.querySelectorAll('.metric-card');
        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          var val = card.querySelector('.metric-value');
          if (!val) continue;
          var t = String(val.textContent || '').trim();
          if (t === '0' || t === '0.0%' || t === '0%') {
            var hasRows = !!document.querySelector('.claim-row, .claims-table-shell tbody tr');
            if (!hasRows) {
              val.textContent = '\u2026';
              card.classList.add('is-loading');
            }
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
            b.textContent = 'Claims · ' + count;
            b.classList.remove('is-count-loading');
          } else {
            b.textContent = 'Claims · \u2026';
            b.classList.add('is-count-loading');
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
        if (root.SDLG_REPOSITORY && typeof root.SDLG_REPOSITORY.countClaimsCached === 'function') {
          var n = await root.SDLG_REPOSITORY.countClaimsCached();
          if (typeof n === 'number') {
            writeCache(n);
            patchNavCount(n);
            return n;
          }
        } else if (root.SDLG_REPOSITORY && typeof root.SDLG_REPOSITORY.countClaims === 'function') {
          var n2 = await root.SDLG_REPOSITORY.countClaims();
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

    function boot() {
      injectCss();
      var c = readCache();
      if (c != null) patchNavCount(c);
      else patchNavCount(null);

      function onReady() {
        earlyCount();
        var tries = 0;
        var iv = setInterval(function () {
          suppressZeroKpis();
          tries++;
          if (tries > 20) clearInterval(iv);
        }, 150);
      }

      if (typeof root.waitForSupabaseReady === 'function') {
        root.waitForSupabaseReady().then(onReady).catch(onReady);
      } else {
        setTimeout(onReady, 400);
        setTimeout(onReady, 1200);
      }

      root.addEventListener('hashchange', function () {
        setTimeout(function () {
          var c2 = readCache();
          if (c2 != null) patchNavCount(c2);
          suppressZeroKpis();
        }, 200);
      });

      root.addEventListener('sdlg-session-ready', function () {
        setTimeout(onReady, 300);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { boot(); } catch (_) {} }, { once: true });
    } else {
      try { boot(); } catch (_) {}
    }

    root.SDLGOverviewLoading = { version: '1.0.0', earlyCount: earlyCount, patchNavCount: patchNavCount };
  } catch (e) {
    try { console.warn('[SDLG overview-loading] init failed (non-fatal)', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
