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
        .page, .app-shell:not(:has(.login-screen)) .page { padding: 12px 12px calc(24px + env(safe-area-inset-bottom, 0px)) !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; }

        /* --- TOPBAR SOLID --- */
        .topbar { height: auto !important; min-height: 0 !important; overflow: visible !important; position: sticky !important; top: 0 !important; z-index: 40 !important; background: #f5f7fb !important; border-bottom: 1px solid rgba(15,23,42,0.08) !important; }
        [data-theme="dark"] .topbar, html[data-theme="dark"] .topbar, body[data-theme="dark"] .topbar { background: #0b1220 !important; border-bottom-color: rgba(255,255,255,0.08) !important; }
        
        .topbar-inner { height: auto !important; min-height: 0 !important; max-width: none !important; width: 100% !important; display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; padding: 8px 10px !important; box-sizing: border-box !important; }
        
        /* Brand & Title */
        .brand { order: 1 !important; flex: 1 1 auto !important; min-width: 0 !important; max-width: calc(100% - 140px) !important; overflow: hidden !important; }
        .brand-sub { display: none !important; }
        .brand-title { font-size: 14px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; color: #0f172a !important; opacity: 1 !important; }
        [data-theme="dark"] .brand-title, html[data-theme="dark"] .brand-title, body[data-theme="dark"] .brand-title { color: #f8fafc !important; }

        /* Nav Tools (Tombol kanan) */
        .nav-tools { order: 2 !important; flex: 0 0 auto !important; width: auto !important; max-width: none !important; display: flex !important; flex-wrap: nowrap !important; align-items: center !important; justify-content: flex-end !important; gap: 6px !important; min-width: 0 !important; }
        .nav-tools .connection-pill { display: none !important; }
        .nav-tools .icon-btn { flex: 0 0 auto !important; min-width: 36px !important; min-height: 36px !important; width: 36px !important; }
        .nav-tools > button { flex: 0 0 auto !important; white-space: nowrap !important; min-height: 34px !important; font-size: 11px !important; padding: 6px 10px !important; }

        /* Theme Switcher */
        .nav-tools .sdlg-theme-switcher, .topbar .sdlg-theme-switcher { position: static !important; transform: none !important; max-width: none !important; opacity: 1 !important; z-index: auto !important; padding: 2px !important; margin: 0 !important; flex: 0 0 auto !important; }
        .nav-tools .sdlg-theme-switcher button, .topbar .sdlg-theme-switcher button { min-height: 28px !important; padding: 0 8px !important; font-size: 11px !important; }
        body > .sdlg-theme-switcher { display: none !important; }

        /* Nav Scroll (Menu Tengah) */
        .nav-scroll { order: 3 !important; flex: 0 0 100% !important; width: 100% !important; max-width: 100% !important; display: flex !important; flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important; gap: 4px !important; background: inherit !important; }
        .nav-scroll::-webkit-scrollbar { display: none !important; }
        .nav-btn, .m360-nav-btn { flex: 0 0 auto !important; white-space: nowrap !important; min-height: 36px !important; padding: 6px 12px !important; font-size: 12.5px !important; }

        /* --- METRICS & CARDS --- */
        .metric-grid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; width: 100% !important; max-width: 100% !important; }
        .metric-card { min-width: 0 !important; width: 100% !important; max-width: 100% !important; overflow: hidden !important; }
        .status-track { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; width: 100% !important; }
        .card, [class*=card], [class*=panel] { max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }

        /* --- CLAIMS LIST --- */
        .search-wrap, .claims-filter-bar, .claims-searchbar { display: flex !important; flex-direction: column !important; gap: 8px !important; width: 100% !important; max-width: 100% !important; }
        .claims-table-head { display: none !important; height: 0 !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }
        .claims-list { display: flex !important; flex-direction: column !important; gap: 10px !important; width: 100% !important; }
        .claim-row { display: flex !important; flex-direction: column !important; width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; overflow: hidden !important; transform: none !important; padding: 12px !important; gap: 6px !important; border-radius: 10px !important; align-items: stretch !important; }
        .claim-row:hover, .claim-row:active { transform: none !important; }

        /* --- FORMS & INPUTS --- */
        input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea { width: 100% !important; max-width: 100% !important; min-width: 0 !important; min-height: 42px !important; box-sizing: border-box !important; font-size: 16px !important; }
        textarea { min-height: 96px !important; }
        button, [role=button], .primary-btn, .secondary-btn, .danger-btn { min-height: 40px !important; max-width: 100% !important; }

        /* --- CHECKBOX & RADIO FIX (Anti Kotak Hitam) --- */
        input[type=checkbox], input[type=radio] {
          -webkit-appearance: checkbox !important;
          appearance: auto !important;
          width: 18px !important; height: 18px !important;
          min-width: 18px !important; min-height: 18px !important;
          max-width: 18px !important; max-height: 18px !important;
          padding: 0 !important; margin: 0 !important;
          flex: 0 0 auto !important; opacity: 1 !important;
          accent-color: #2563eb !important;
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

  // ─────────────────────────────────────────────────────────
  // 2. DOM FIXES (Cuma buat urutan & elemen yang gak bisa di-CSS)
  // ─────────────────────────────────────────────────────────
  function isMobile() {
    return window.matchMedia(MOBILE_BREAKPOINT).matches;
  }

  function fixTopbarOrder() {
    var brand = document.querySelector('.topbar-inner .brand');
    var tools = document.querySelector('.topbar-inner .nav-tools');
    var nav = document.querySelector('.topbar-inner .nav-scroll');
    
    if (brand && tools && brand.nextElementSibling !== tools) {
      brand.after(tools);
    }
    if (tools && nav && tools.nextElementSibling !== nav) {
      tools.after(nav);
    }
  }

  function fixThemeSwitcher() {
    var sw = document.querySelector('.sdlg-theme-switcher');
    var tools = document.querySelector('.nav-tools');
    if (sw && tools && sw.parentElement !== tools) {
      tools.appendChild(sw);
    }
  }

  function applyDomFixes() {
    if (!isMobile()) return;
    
    // Cegah layout thrashing dengan cek apakah elemen udah bener
    try {
      fixThemeSwitcher();
      fixTopbarOrder();
    } catch (e) {
      console.warn('[SDLG Mobile] DOM fix error:', e);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. EVENT LISTENERS & OBSERVER (Debounced)
  // ─────────────────────────────────────────────────────────
  function scheduleFix() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyDomFixes, 150);
  }

  function start() {
    injectCss();
    
    // Jalanin sekali di awal
    scheduleFix();

    // 1. Observer (Cuma ngawasin Topbar, gak seluruh DOM)
    var topbar = document.querySelector('.topbar-inner');
    if (topbar && window.MutationObserver) {
      var obs = new MutationObserver(scheduleFix);
      obs.observe(topbar, { childList: true, subtree: false }); // False biar gak berat
    }

    // 2. Resize & Orientation
    window.addEventListener('resize', scheduleFix, { passive: true });
    window.addEventListener('orientationchange', scheduleFix, { passive: true });

    // 3. Jaga-jaga kalau React render lama (1x doang, bukan 60x)
    setTimeout(scheduleFix, 1000);
    setTimeout(scheduleFix, 2500);
  }

  // ─────────────────────────────────────────────────────────
  // 4. BOOT
  // ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

})();