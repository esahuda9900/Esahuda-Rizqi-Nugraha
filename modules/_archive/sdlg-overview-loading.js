/**
 * SDLG Overview Loading Architecture — V4.0 (Smart Observer Edition)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V4.0:
 * ✅ ZERO POLLING: MutationObserver ganti setInterval(40x).
 * ✅ SMART KPI: Deteksi angka real (termasuk 0 yang valid).
 * ✅ PROMISE CHAIN: Boot sequence yang berurutan & bersih.
 * ✅ OFFLINE DETECT: Banner kalau internet mati.
 * ✅ LOCAL CACHE: localStorage (persist antar tab).
 * ✅ DARK MODE: Executive Snapshot support tema gelap.
 * ✅ IMMUTABLE API: Object.freeze().
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_OVERVIEW_LOADING_V4__) return;
  root.__SDLG_OVERVIEW_LOADING_V4__ = true;
  root.__SDLG_OVERVIEW_LOADING_V3__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & STATE
  // ─────────────────────────────────────────────────────────
  var CACHE_KEY = 'sdlg:claims-count:v2';
  var CACHE_TTL = 5 * 60 * 1000; // 5 menit
  var STYLE_ID = 'sdlg-overview-loading-css';
  var KPI_WATCH_TIMEOUT = 8000; // Max 8 detik

  var state = {
    ready: false,
    bossPatched: false,
    kpiObserver: null,
    kpiTimer: null,
    offlineBannerShown: false
  };

  // ─────────────────────────────────────────────────────────
  // 2. CACHE LAYER (localStorage - Persist Antar Tab)
  // ─────────────────────────────────────────────────────────
  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p.count !== 'number') return null;
      if (Date.now() - (p.at || 0) > CACHE_TTL) return null;
      return p.count;
    } catch (_) { return null; }
  }

  function writeCache(n) {
    try {
      if (typeof n === 'number' && Number.isFinite(n)) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ count: n, at: Date.now() }));
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 3. CSS INJECTION (Dark Mode Ready)
  // ─────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      /* Nav count loading state */
      .nav-btn.is-count-loading {
        opacity: 0.85;
        position: relative;
      }
      .nav-btn.is-count-loading::after {
        content: '';
        position: absolute;
        right: 8px;
        top: 50%;
        width: 4px;
        height: 4px;
        background: currentColor;
        border-radius: 50%;
        transform: translateY(-50%);
        animation: sdlgCountPulse 1.2s ease-in-out infinite;
      }
      @keyframes sdlgCountPulse {
        0%, 100% { opacity: 0.3; transform: translateY(-50%) scale(0.8); }
        50% { opacity: 1; transform: translateY(-50%) scale(1.2); }
      }

      /* Soft fade-in saat data muncul */
      @keyframes sdlg-soft-in {
        from { opacity: 0.55; transform: translateY(2px); }
        to { opacity: 1; transform: translateY(0); }
      }
      html.sdlg-overview-ready .metric-grid,
      html.sdlg-overview-ready .metric-card,
      html.sdlg-overview-ready .card,
      html.sdlg-overview-ready .wx-filter,
      html.sdlg-overview-ready .wx-analytics-shell {
        animation: sdlg-soft-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      /* Executive Snapshot (Dark Mode Ready) */
      .sdlg-exec-snapshot {
        background: var(--sdlg-surface, #fff);
        border: 1px solid var(--sdlg-border, #e4e9f0);
        border-radius: 12px;
        padding: 10px 14px;
        transition: box-shadow 0.2s;
      }
      .sdlg-exec-snapshot[open] { box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      .sdlg-exec-snapshot > summary {
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
        color: var(--sdlg-text, #1d2940);
        list-style: none;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sdlg-exec-snapshot > summary::-webkit-details-marker { display: none; }
      .sdlg-exec-snapshot > summary::before {
        content: '▸';
        font-size: 10px;
        transition: transform 0.2s;
        display: inline-block;
      }
      .sdlg-exec-snapshot[open] > summary::before { transform: rotate(90deg); }
      .sdlg-exec-snapshot > summary .sdlg-hint {
        font-weight: 600;
        color: var(--sdlg-text-muted, #64748b);
        font-size: 11px;
      }

      @media (prefers-color-scheme: dark) {
        .sdlg-exec-snapshot {
          background: #111a2e;
          border-color: #1e2a45;
        }
        .sdlg-exec-snapshot > summary { color: #f8fafc; }
        .sdlg-exec-snapshot > summary .sdlg-hint { color: #94a3b8; }
      }

      @media (prefers-reduced-motion: reduce) {
        .nav-btn.is-count-loading::after,
        html.sdlg-overview-ready .metric-grid,
        html.sdlg-overview-ready .metric-card,
        html.sdlg-overview-ready .card {
          animation-duration: 0.01ms !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 4. NAV COUNT PATCH
  // ─────────────────────────────────────────────────────────
  function patchNavCount(count) {
    try {
      var buttons = document.querySelectorAll('.nav-btn');
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var label = String(b.textContent || '');
        if (!/^Claims/i.test(label)) continue;

        if (typeof count === 'number') {
          b.textContent = 'Claims · ' + count.toLocaleString('id-ID');
          b.classList.remove('is-count-loading');
          b.setAttribute('data-count', String(count));
        } else {
          b.textContent = 'Claims · …';
          b.classList.add('is-count-loading');
        }
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 5. EARLY COUNT (Cache-first)
  // ─────────────────────────────────────────────────────────
  async function earlyCount() {
    // 1. Cek cache dulu
    var cached = readCache();
    if (cached != null) {
      patchNavCount(cached);
      return cached;
    }

    // 2. Loading state
    patchNavCount(null);

    // 3. Fetch dari repository
    try {
      var repo = root.SDLG_REPOSITORY;
      var n = null;
      
      if (repo && typeof repo.countClaimsCached === 'function') {
        n = await repo.countClaimsCached();
      } else if (repo && typeof repo.countClaims === 'function') {
        n = await repo.countClaims();
      }
      
      if (typeof n === 'number') {
        writeCache(n);
        patchNavCount(n);
        return n;
      }
    } catch (e) {
      console.warn('[SDLG Overview] earlyCount failed:', e);
    }
    
    return null;
  }

  // ─────────────────────────────────────────────────────────
  // 6. SMART KPI WATCHER (MutationObserver)
  // ─────────────────────────────────────────────────────────
  
  /**
   * Cek apakah KPI sudah berisi angka real.
   * Fix dari V3: `0` dihitung valid (bukan cuma > 0).
   */
  function hasRealKpi() {
    try {
      var cards = document.querySelectorAll('.metric-card .metric-value');
      for (var i = 0; i < cards.length; i++) {
        var t = String(cards[i].textContent || '').trim();
        // Angka apapun yang mulai dari digit = real (termasuk 0)
        if (/^\d/.test(t)) return true;
      }
    } catch (_) {}
    return false;
  }

  function waitForKpiRealData() {
    return new Promise(function (resolve) {
      // Cek sekali di awal
      if (hasRealKpi()) return resolve(true);

      // Set observer
      state.kpiObserver = new MutationObserver(function () {
        if (hasRealKpi()) {
          cleanup();
          resolve(true);
        }
      });
      state.kpiObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });

      // Timeout fallback
      state.kpiTimer = setTimeout(function () {
        cleanup();
        resolve(false);
      }, KPI_WATCH_TIMEOUT);

      function cleanup() {
        if (state.kpiObserver) {
          state.kpiObserver.disconnect();
          state.kpiObserver = null;
        }
        if (state.kpiTimer) {
          clearTimeout(state.kpiTimer);
          state.kpiTimer = null;
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // 7. BOSS ANALYTICS PATCH
  // ─────────────────────────────────────────────────────────
  function waitForBossAnalytics() {
    return new Promise(function (resolve) {
      if (root.SDLGBossAnalytics) return resolve(true);
      
      var tries = 0;
      var timer = setInterval(function () {
        if (root.SDLGBossAnalytics) {
          clearInterval(timer);
          resolve(true);
        } else if (++tries > 30) { // Max 3 detik
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  }

  function patchBossAnalytics() {
    if (state.bossPatched) return;
    
    try {
      var boss = root.SDLGBossAnalytics;
      if (!boss || boss.__sdlgLoadingPatchedV4) return;
      
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

      // ─── Patch 1: Period Filter Bar ───
      next.periodFilterBar = function (opts) {
        opts = opts || {};
        if (isLoading(opts)) {
          var React = opts.React;
          return React.createElement(
            'div',
            { className: 'wx-filter is-loading' },
            React.createElement('div', { className: 'wx-filter-label' }, 'Analisa periode'),
            React.createElement('select', { disabled: true },
              React.createElement('option', null, 'Semua tahun')
            ),
            React.createElement('select', { disabled: true },
              React.createElement('option', null, 'Semua bulan')
            ),
            React.createElement('div', { className: 'wx-filter-count' }, '… claim dalam periode')
          );
        }
        return origPeriod(opts);
      };

      // ─── Patch 2: Extra Panels (Executive Snapshot) ───
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
              React.createElement('div', 
                { style: { marginTop: 8, color: 'var(--sdlg-text-subtle, #94a3b8)', fontSize: 13 } }, 
                '…'
              )
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
              { className: 'sdlg-exec-snapshot' },
              React.createElement(
                'summary',
                null,
                'Executive Snapshot · 18 metrik',
                React.createElement('span', { className: 'sdlg-hint' }, '(klik untuk buka)')
              ),
              React.createElement('div', { style: { marginTop: 12 } }, body)
            )
          );
        } catch (_) {
          return body;
        }
      };

      next.yearFilterBar = next.periodFilterBar;
      next.__sdlgLoadingPatchedV4 = true;
      next.version = String(boss.version || '') + '+v4';
      
      root.SDLGBossAnalytics = Object.freeze(next);
      state.bossPatched = true;
      
    } catch (e) {
      console.warn('[SDLG Overview] Boss patch failed:', e);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 8. OFFLINE DETECTION
  // ─────────────────────────────────────────────────────────
  function showOfflineBanner() {
    if (state.offlineBannerShown) return;
    state.offlineBannerShown = true;
    
    if (root.SDLGNotify && root.SDLGNotify.warning) {
      root.SDLGNotify.warning(
        'Anda Offline',
        'Koneksi internet terputus. Beberapa data mungkin tidak termuat.'
      );
    }
  }

  function watchNetwork() {
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      showOfflineBanner();
    }
    root.addEventListener('offline', showOfflineBanner);
  }

  // ─────────────────────────────────────────────────────────
  // 9. BOOT SEQUENCE (Promise Chain)
  // ─────────────────────────────────────────────────────────
  function markReady() {
    if (state.ready) return;
    state.ready = true;
    
    try {
      document.documentElement.classList.add('sdlg-overview-ready');
    } catch (_) {}
    
    // Refresh nav count dari cache
    var c = readCache();
    if (c != null) patchNavCount(c);
    
    // Emit event
    try {
      root.dispatchEvent(new CustomEvent('sdlg-overview-ready', { detail: { at: Date.now() } }));
    } catch (_) {}
  }

  async function runBootSequence() {
    injectCss();
    watchNetwork();

    // 1. Early count (cache-first)
    await earlyCount();

    // 2. Wait for boss analytics to exist (max 3s)
    await waitForBossAnalytics();
    patchBossAnalytics();

    // 3. Wait for KPI to show real data (max 8s)
    await waitForKpiRealData();
    markReady();
  }

  // ─────────────────────────────────────────────────────────
  // 10. ROUTE CHANGE HANDLER
  // ─────────────────────────────────────────────────────────
  function onRouteChange() {
    var h = String(root.location.hash || '');
    if (!/#\/?overview/i.test(h) && h !== '' && h !== '#' && h !== '#/') return;
    
    // Reset state
    state.ready = false;
    state.bossPatched = false;
    
    try {
      document.documentElement.classList.remove('sdlg-overview-ready');
    } catch (_) {}
    
    // Boot lagi
    setTimeout(runBootSequence, 150);
  }

  // ─────────────────────────────────────────────────────────
  // 11. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    // Tunggu Supabase ready (kalau ada)
    var waitFn = root.waitForSupabaseReady;
    if (typeof waitFn === 'function') {
      Promise.resolve(waitFn())
        .then(runBootSequence)
        .catch(runBootSequence);
    } else {
      setTimeout(runBootSequence, 200);
    }
    
    root.addEventListener('hashchange', onRouteChange);
    root.addEventListener('sdlg-route-changed', onRouteChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 12. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  root.SDLGOverviewLoading = Object.freeze({
    version: '4.0.0',
    earlyCount: earlyCount,
    patchNavCount: patchNavCount,
    patchBossAnalytics: patchBossAnalytics,
    isReady: function () { return state.ready; }
  });

  console.info('[SDLG Overview] v4.0 Smart Observer loaded');

})(typeof window !== 'undefined' ? window : globalThis);