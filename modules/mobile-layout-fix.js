/**
 * SDLG Mobile Layout Fix — V2.0 (Performance-First)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO LAG: Hapus setInterval 24 detik (Boros baterai).
 * ✅ CSS-FIRST: Gak pake inline style `!important` lagi.
 * ✅ SMART OBSERVER: Cuma ngawasin Topbar (bukan seluruh DOM).
 * ✅ DEBOUNCE: Anti layout-thrashing pas React render.
 * ✅ BUG FIXES: Checkbox native, Topbar solid, Metric 2-col.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__SDLG_MOBILE_FIX_V2__) return;
  window.__SDLG_MOBILE_FIX_V2__ = true;

  var STYLE_ID = 'sdlg-mobile-layout-v20';
  var MOBILE_BREAKPOINT = '(max-width: 900px)';
  var debounceTimer = null;

  // ─────────────────────────────────────────────────────────
  // 1. CSS INJECTION (Semua Styling di sini)
  // ─────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;

    // Hapus versi lama kalau ada (biar gak dobel)
    ['sdlg-mobile-layout-v19', 'sdlg-mobile-layout-v18'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      @media (max-width: 900px) {
        /* --- GLOBAL RESET --- */
        html, body { width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow-x: hidden !important; }
        body { font-size: 14px !important; -webkit-text-size-adjust: 100% !important; }
        .page, .app-shell:not(:has(.login-screen)) .page { padding: 14px 12px calc(28px + env(safe-area-inset-bottom, 0px)) !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; }

        /* --- TOPBAR SOLID (CSS order only, zero React DOM mutation) --- */
        .topbar,
        .app-shell:not(:has(.login-screen)) .topbar {
          height: auto !important; min-height: 0 !important; overflow: visible !important;
          position: sticky !important; top: 0 !important; z-index: 200 !important;
          background: rgba(255, 255, 255, 0.94) !important;
          border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
        }
        .topbar-inner,
        .app-shell:not(:has(.login-screen)) .topbar-inner {
          height: auto !important; min-height: 0 !important; max-width: none !important; width: 100% !important;
          display: flex !important; flex-wrap: wrap !important; align-items: center !important; justify-content: space-between !important;
          gap: 8px !important; padding: 8px 12px !important; box-sizing: border-box !important;
        }

        /* Brand & Title */
        .brand { order: 1 !important; flex: 1 1 auto !important; min-width: 0 !important; overflow: hidden !important; }
        .brand-sub { display: none !important; }
        .brand-title { font-size: 14px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; color: #0f172a !important; }

        /* Nav Tools */
        .nav-tools,
        .app-shell:not(:has(.login-screen)) .nav-tools { order: 2 !important; flex: 0 0 auto !important; width: auto !important; max-width: none !important; display: flex !important; flex-wrap: nowrap !important; align-items: center !important; justify-content: flex-end !important; gap: 6px !important; min-width: 0 !important; margin-left: auto !important; }
        .nav-tools .connection-pill { max-width: 140px !important; padding: 0 8px !important; height: 34px !important; gap: 6px !important; }
        .nav-tools .connection-pill .connection-email { display: none !important; }
        .nav-tools .icon-btn { flex: 0 0 auto !important; min-width: 34px !important; min-height: 34px !important; width: 34px !important; height: 34px !important; }
        .nav-tools > button:not(.icon-btn) { flex: 0 0 auto !important; white-space: nowrap !important; min-height: 34px !important; height: 34px !important; font-size: 11.5px !important; padding: 0 10px !important; }

        /* Nav Scroll (Row 2 full-width cleanly scrollable without clipping desktop pills) */
        .nav-scroll,
        .app-shell:not(:has(.login-screen)) .nav-scroll {
          order: 3 !important; position: static !important; top: auto !important; left: auto !important; right: auto !important;
          flex: 0 0 100% !important; width: 100% !important; max-width: 100% !important;
          display: flex !important; flex-wrap: nowrap !important; justify-content: flex-start !important;
          overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important;
          gap: 3px !important; padding: 3px !important; margin: 0 !important;
          background: #f1f5f9 !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important;
          mask-image: none !important; -webkit-mask-image: none !important;
        }
        .nav-scroll::-webkit-scrollbar { display: none !important; }
        .nav-btn, .m360-nav-btn { flex: 0 0 auto !important; white-space: nowrap !important; min-height: 32px !important; padding: 5px 11px !important; font-size: 12px !important; }

        /* --- METRICS & CARDS --- */
        .metric-grid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; width: 100% !important; max-width: 100% !important; }
        .metric-card { min-width: 0 !important; width: 100% !important; max-width: 100% !important; overflow: hidden !important; }
        .status-track { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; width: 100% !important; }
        .card, [class*=card], [class*=panel] { max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }

        /* --- CLAIMS LIST --- */
        .search-wrap, .claims-filter-bar, .claims-searchbar { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 8px !important; width: 100% !important; max-width: 100% !important; }
        .claims-table-head { display: none !important; height: 0 !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }
        .claims-list { display: flex !important; flex-direction: column !important; gap: 10px !important; width: 100% !important; }
        .claim-row { display: flex !important; flex-direction: column !important; width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; overflow: hidden !important; transform: none !important; padding: 12px !important; gap: 6px !important; border-radius: 10px !important; align-items: stretch !important; }
        .claim-row:hover, .claim-row:active { transform: none !important; }

        /* --- FORMS & INPUTS --- */
        input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea { width: 100% !important; max-width: 100% !important; min-width: 0 !important; min-height: 40px !important; box-sizing: border-box !important; font-size: 16px !important; }
        textarea { min-height: 96px !important; }
        .primary-btn, .secondary-btn, .danger-btn, .sdlg-btn:not(.sdlg-btn--compact) { min-height: 40px !important; max-width: 100% !important; }

        /* --- CHECKBOX & RADIO FIX --- */
        input[type=checkbox], input[type=radio] {
          -webkit-appearance: checkbox !important;
          appearance: auto !important;
          width: 18px !important; height: 18px !important;
          min-width: 18px !important; min-height: 18px !important;
          max-width: 18px !important; max-height: 18px !important;
          padding: 0 !important; margin: 0 !important;
          flex: 0 0 auto !important; opacity: 1 !important;
          accent-color: #1d4ed8 !important;
          background-color: transparent !important;
          border: none !important; box-shadow: none !important;
          position: relative !important; vertical-align: middle !important;
        }
        input[type=radio] { -webkit-appearance: radio !important; }
        .claim-row input[type=checkbox], .claim-row input[type=radio] { align-self: flex-start !important; margin: 0 0 2px 0 !important; }

        /* --- DETAIL & TABLES --- */
        .detail-grid { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; gap: 12px !important; width: 100% !important; }
        .sticky-side { position: static !important; top: auto !important; width: 100% !important; max-width: 100% !important; }
        .page h1, .page h2 { max-width: 100% !important; overflow-wrap: anywhere !important; }
        .table-wrap, .claims-table-shell { width: 100% !important; max-width: 100% !important; overflow-x: auto !important; }
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function start() {
    injectCss();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

})();