/**
 * SDLG Overview Loading Architecture v2.2
 * Priority progressive reveal (top-down), not fastest-first.
 * Tier 1 (KPI) → Tier 2 (Action) → Tier 3 (Analytics)
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_OVERVIEW_LOADING_V22__) return;
    root.__SDLG_OVERVIEW_LOADING_V22__ = true;
    root.__SDLG_OVERVIEW_LOADING_V21__ = true;
    root.__SDLG_OVERVIEW_LOADING_V2__ = true;

    var COUNT_KEY = 'sdlg:claims-count:v1';
    var TTL = 5 * 60 * 1000;
    var hydrateUntil = Date.now() + 10000;
    var revealed = false;
    var minSkeletonMs = 300;
    var bootAt = Date.now();

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
        '.wx-filter.is-loading .wx-filter-count{opacity:.6}',
        '.sdlg-tier{opacity:0;transform:translateY(8px);transition:opacity .28s ease,transform .28s ease;pointer-events:none}',
        'html.sdlg-revealed .sdlg-tier-1{opacity:1;transform:none;transition-delay:0ms;pointer-events:auto}',
        'html.sdlg-revealed .sdlg-tier-2{opacity:1;transform:none;transition-delay:140ms;pointer-events:auto}',
        'html.sdlg-revealed .sdlg-tier-3{opacity:1;transform:none;transition-delay:280ms;pointer-events:auto}'
      ].join('');
      (document.head || document.documentElement).appendChild(s);
    }

    function isHydrating() { return Date.now() < hydrateUntil && !revealed; }

    function hasClaimData() {
      try {
        var cards = document.querySelectorAll('.metric-card .metric-value');
        for (var i = 0; i < cards.length; i++) {
          var t = String(cards[i].textContent || '').trim().replace(/,/g, '');
          if (/^\d+$/.test(t) && parseInt(t, 10) > 0) return true;
        }
        return !!document.querySelector('.claim-row, .claims-table-shell tbody tr');
      } catch (_) { return false; }
    }

    function markTiers() {
      try {
        var page = document.querySelector('.page');
        if (!page) return;
        var metricGrids = page.querySelectorAll('[style*="minmax(180px"]');
        for (var i = 0; i < metricGrids.length; i++) {
          if (metricGrids[i].querySelector('.metric-card')) {
            metricGrids[i].classList.add('sdlg-tier', 'sdlg-tier-1');
          }
        }
        var filters = page.querySelectorAll('.wx-filter');
        for (var f = 0; f < filters.length; f++) filters[f].classList.add('sdlg-tier', 'sdlg-tier-1');
        var cards = page.querySelectorAll('.card.card-pad, .card');
        for (var c = 0; c < cards.length; c++) {
          var txt = String(cards[c].textContent || '').slice(0, 120);
          if (/My Action Today|Status Flow|Claim prioritas|Action Required|Action Center/i.test(txt)) {
            cards[c].classList.add('sdlg-tier', 'sdlg-tier-2');
          }
          if (/Claim Trend|Claims per Model|Claims per Branch|Top Failure|Top Rejection|Estimasi Total/i.test(txt)) {
            cards[c].classList.add('sdlg-tier', 'sdlg-tier-3');
          }
        }
        var shells = page.querySelectorAll('.wx-analytics-shell');
        for (var s = 0; s < shells.length; s++) shells[s].classList.add('sdlg-tier', 'sdlg-tier-3');
      } catch (_) {}
    }

    function suppressLoadingZeros() {
      if (revealed) return;
      try {
        var vals = document.querySelectorAll('.metric-value, .wx-metric-value');
        for (var i = 0; i < vals.length; i++) {
          var el = vals[i];
          var t = String(el.textContent || '').trim();
          if (t === '0' || t === '0.0%' || t === '0%' || t === 'Rp 0' || t === 'Rp0' || t === '\u2014' || t === '\u2014') {
            var page = el.closest('.page, .wx-analytics-shell, .metric-card, .card');
            if (!page) continue;
            el.textContent = '\u2026';
            if (el.parentElement) el.parentElement.classList.add('is-loading');
          }
        }
        var counts = document.querySelectorAll('.wx-filter-count');
        for (var j = 0; j < counts.length; j++) {
          var c = counts[j];
          if (!revealed) c.textContent = '\u2026 claim dalam periode';
        }
        var emptyMsgs = document.querySelectorAll('div, span, p');
        for (var k = 0; k < emptyMsgs.length; k++) {
          var em = emptyMsgs[k];
          if (em.children && em.children.length > 0) continue;
          var et = String(em.textContent || '').trim();
          if (/^Belum ada (data|tanggal|claim)/i.test(et)) {
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
          } else if (!revealed) {
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
        if (!boss || boss.__sdlgLoadingPatchedV22) return;
        var origPeriod = boss.periodFilterBar;
        var origExtra = boss.renderExtraPanels;
        if (typeof origPeriod !== 'function') return;

        function isLoading(opts) {
          if (revealed) return false;
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
            return React.createElement('div', { className: 'wx-filter is-loading sdlg-tier sdlg-tier-1' },
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
          if (isLoading(opts) && typeof origExtra === 'function') {
            function skel(w, h) {
              return React.createElement('div', { className: 'sdlg-skel', style: { width: w || '100%', height: h || 18 } });
            }
            return React.createElement('div', { className: 'wx-analytics-shell is-loading sdlg-tier sdlg-tier-3', 'aria-busy': 'true' },
              React.createElement('div', { className: 'wx-insight' },
                React.createElement('div', { className: 'wx-insight-badge' }, 'EXECUTIVE SNAPSHOT'),
                React.createElement('div', { style: { marginTop: 8 } }, skel('55%', 16))
              )
            );
          }
          if (!origExtra) return null;
          var body = origExtra(opts);
          try {
            return React.createElement('div', { className: 'wx-analytics-shell sdlg-tier sdlg-tier-3' },
              React.createElement('details', { style: { background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: '10px 14px' } },
                React.createElement('summary', { style: { cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#1d2940' } },
                  'Executive Snapshot \u00b7 18 metrik  ',
                  React.createElement('span', { style: { fontWeight: 600, color: '#64748b', fontSize: 11 } }, '(klik untuk buka)')
                ),
                React.createElement('div', { style: { marginTop: 12 } }, body)
              )
            );
          } catch (_) { return body; }
        };
        next.yearFilterBar = next.periodFilterBar;
        next.__sdlgLoadingPatched = true;
        next.__sdlgLoadingPatchedV22 = true;
        next.version = String(boss.version || '') + '+priority';
        root.SDLGBossAnalytics = Object.freeze(next);
        console.info('[SDLG overview-loading] v2.2 priority reveal + collapsed snapshot');
      } catch (e) {
        console.warn('[SDLG overview-loading] boss patch failed', e);
      }
    }

    function tryReveal() {
      if (revealed) return;
      if (!hasClaimData()) return;
      var elapsed = Date.now() - bootAt;
      var wait = Math.max(0, minSkeletonMs - elapsed);
      setTimeout(function () {
        if (revealed) return;
        revealed = true;
        hydrateUntil = Date.now();
        markTiers();
        try { document.documentElement.classList.add('sdlg-revealed', 'sdlg-data-ready'); } catch (_) {}
        try {
          var nodes = document.querySelectorAll('.is-loading');
          for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-loading');
        } catch (_) {}
        console.info('[SDLG overview-loading] progressive reveal triggered (tier 1\u21922\u21923)');
      }, wait);
    }

    function boot() {
      injectCss();
      var c = readCache();
      if (c != null) patchNavCount(c);
      else patchNavCount(null);

      function onReady() {
        hydrateUntil = Date.now() + 10000;
        bootAt = Date.now();
        revealed = false;
        try { document.documentElement.classList.remove('sdlg-revealed', 'sdlg-data-ready'); } catch (_) {}
        earlyCount();
        patchBossAnalytics();
        markTiers();
        var tries = 0;
        var iv = setInterval(function () {
          suppressLoadingZeros();
          markTiers();
          if (tries % 4 === 0) patchBossAnalytics();
          tryReveal();
          tries++;
          if (tries > 50 || revealed) clearInterval(iv);
        }, 150);
      }

      if (typeof root.waitForSupabaseReady === 'function') {
        root.waitForSupabaseReady().then(onReady).catch(onReady);
      } else {
        setTimeout(onReady, 300);
        setTimeout(onReady, 1000);
      }

      root.addEventListener('hashchange', function () {
        var h = String(root.location.hash || '');
        if (!/#\/?overview/i.test(h) && h !== '' && h !== '#' && h !== '#/') return;
        hydrateUntil = Date.now() + 6000;
        revealed = false;
        bootAt = Date.now();
        try { document.documentElement.classList.remove('sdlg-revealed', 'sdlg-data-ready'); } catch (_) {}
        setTimeout(function () {
          var c2 = readCache();
          if (c2 != null) patchNavCount(c2);
          suppressLoadingZeros();
          patchBossAnalytics();
          markTiers();
          tryReveal();
        }, 200);
      });

      root.addEventListener('sdlg-session-ready', function () {
        hydrateUntil = Date.now() + 10000;
        revealed = false;
        bootAt = Date.now();
        setTimeout(onReady, 200);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { boot(); } catch (_) {} }, { once: true });
    } else {
      try { boot(); } catch (_) {}
    }

    root.SDLGOverviewLoading = {
      version: '2.2.0',
      earlyCount: earlyCount,
      patchNavCount: patchNavCount,
      patchBossAnalytics: patchBossAnalytics,
      tryReveal: tryReveal
    };
  } catch (e) {
    try { console.warn('[SDLG overview-loading] init failed (non-fatal)', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
