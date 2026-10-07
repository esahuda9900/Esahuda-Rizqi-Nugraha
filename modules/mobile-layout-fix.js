/**
 * SDLG mobile layout fix V19 — visual only.
 * Fixes from user screenshots (Claims + Command Center dark mode):
 *  - checkbox = native control (not solid black square)
 *  - claim card checkbox left-aligned
 *  - brand title readable on dark
 *  - topbar/nav solid opaque (no title bleed-through)
 * Keeps V18 topbar: brand | tools / nav row. Metrics 2-col.
 * No business logic.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  var STYLE_ID = 'sdlg-mobile-layout-v19';
  var ATTR = 'data-sdlg-mobile-v19';

  ['sdlg-mobile-layout-v11', 'sdlg-mobile-layout-v13', 'sdlg-mobile-layout-v14',
   'sdlg-mobile-layout-v15', 'sdlg-mobile-layout-v16', 'sdlg-mobile-layout-v17',
   'sdlg-mobile-layout-v18'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });
  try {
    ['data-sdlg-mobile-v15-obs', 'data-sdlg-mobile-v16-obs',
     'data-sdlg-mobile-v17-obs', 'data-sdlg-mobile-v18-obs'].forEach(function (k) {
      if (window[k]) { window[k].disconnect(); window[k] = null; }
    });
  } catch (_) {}

  var css = [
    '@media (max-width: 900px) {',
    '  html, body { width:100%!important; max-width:100%!important; min-width:0!important; overflow-x:hidden!important; }',
    '  body { font-size:14px!important; -webkit-text-size-adjust:100%!important; }',
    '',
    '  .page, .app-shell:not(:has(.login-screen)) .page {',
    '    padding:12px 12px calc(24px + env(safe-area-inset-bottom,0px))!important;',
    '    max-width:100%!important; width:100%!important; box-sizing:border-box!important;',
    '  }',
    '',
    '  /* Topbar solid */',
    '  .topbar, .app-shell:not(:has(.login-screen)) .topbar {',
    '    height:auto!important; min-height:0!important; overflow:visible!important;',
    '    position:sticky!important; top:0!important; z-index:40!important;',
    '    background:#f5f7fb!important;',
    '    border-bottom:1px solid rgba(15,23,42,0.08)!important;',
    '  }',
    '  [data-theme="dark"] .topbar, html[data-theme="dark"] .topbar,',
    '  body[data-theme="dark"] .topbar { background:#0b1220!important; border-bottom-color:rgba(255,255,255,0.08)!important; }',
    '  .topbar-inner, .app-shell:not(:has(.login-screen)) .topbar-inner {',
    '    height:auto!important; min-height:0!important; max-width:none!important; width:100%!important;',
    '    display:flex!important; flex-wrap:wrap!important; align-items:center!important;',
    '    align-content:flex-start!important; gap:8px!important;',
    '    padding:8px 10px!important; box-sizing:border-box!important;',
    '  }',
    '',
    '  .brand { order:1!important; flex:1 1 auto!important; min-width:0!important; max-width:calc(100% - 140px)!important; overflow:hidden!important; }',
    '  .brand, .brand * { min-width:0!important; }',
    '  .brand-sub { display:none!important; }',
    '  .brand-title {',
    '    font-size:14px!important; white-space:nowrap!important; overflow:hidden!important;',
    '    text-overflow:ellipsis!important; color:#0f172a!important; opacity:1!important;',
    '  }',
    '  [data-theme="dark"] .brand-title, html[data-theme="dark"] .brand-title,',
    '  body[data-theme="dark"] .brand-title { color:#f8fafc!important; }',
    '',
    '  .nav-tools {',
    '    order:2!important; flex:0 0 auto!important; width:auto!important; max-width:none!important;',
    '    display:flex!important; flex-wrap:nowrap!important; align-items:center!important;',
    '    justify-content:flex-end!important; gap:6px!important; min-width:0!important;',
    '  }',
    '  .nav-tools .connection-pill { display:none!important; }',
    '  .nav-tools .icon-btn { flex:0 0 auto!important; min-width:36px!important; min-height:36px!important; width:36px!important; }',
    '  .nav-tools > button { flex:0 0 auto!important; white-space:nowrap!important; min-height:34px!important; font-size:11px!important; padding:6px 10px!important; }',
    '',
    '  .nav-tools .sdlg-theme-switcher, .topbar .sdlg-theme-switcher {',
    '    position:static!important; left:auto!important; right:auto!important; bottom:auto!important;',
    '    transform:none!important; max-width:none!important; opacity:1!important;',
    '    z-index:auto!important; padding:2px!important; margin:0!important; flex:0 0 auto!important;',
    '  }',
    '  .nav-tools .sdlg-theme-switcher button, .topbar .sdlg-theme-switcher button {',
    '    min-height:28px!important; padding:0 8px!important; font-size:11px!important;',
    '  }',
    '  body > .sdlg-theme-switcher { display:none!important; }',
    '',
    '  .nav-scroll, .app-shell:not(:has(.login-screen)) .nav-scroll {',
    '    order:3!important; flex:0 0 100%!important; width:100%!important; max-width:100%!important;',
    '    display:flex!important; flex-wrap:nowrap!important; overflow-x:auto!important;',
    '    -webkit-overflow-scrolling:touch!important; scrollbar-width:none!important; gap:4px!important;',
    '    background:inherit!important;',
    '  }',
    '  .nav-scroll::-webkit-scrollbar { display:none!important; }',
    '  .nav-btn, .m360-nav-btn {',
    '    flex:0 0 auto!important; white-space:nowrap!important;',
    '    min-height:36px!important; padding:6px 12px!important; font-size:12.5px!important;',
    '  }',
    '',
    '  .metric-grid { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:8px!important; width:100%!important; max-width:100%!important; }',
    '  .metric-card { min-width:0!important; width:100%!important; max-width:100%!important; overflow:hidden!important; }',
    '  .status-track { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:8px!important; width:100%!important; }',
    '',
    '  .search-wrap, .claims-filter-bar, .claims-searchbar { display:flex!important; flex-direction:column!important; gap:8px!important; width:100%!important; max-width:100%!important; }',
    '  .search-box { width:100%!important; max-width:100%!important; min-width:0!important; }',
    '  .search-box input, .claims-filter-bar input:not([type=checkbox]):not([type=radio]), .claims-filter-bar select,',
    '  .claims-searchbar input:not([type=checkbox]):not([type=radio]), .claims-searchbar select {',
    '    width:100%!important; max-width:100%!important; min-height:42px!important; font-size:16px!important;',
    '  }',
    '',
    '  .claims-table-head, .claims-table-head[role=row] { display:none!important; height:0!important; overflow:hidden!important; margin:0!important; padding:0!important; }',
    '  .claims-list { display:flex!important; flex-direction:column!important; gap:10px!important; width:100%!important; }',
    '  .claim-row {',
    '    display:flex!important; flex-direction:column!important; width:100%!important; max-width:100%!important;',
    '    min-width:0!important; box-sizing:border-box!important; overflow:hidden!important;',
    '    transform:none!important; padding:12px!important; gap:6px!important; border-radius:10px!important;',
    '    align-items:stretch!important;',
    '  }',
    '  .claim-row:hover, .claim-row:active { transform:none!important; }',
    '  /* Checkbox on claim cards — left, not centered */',
    '  .claim-row input[type=checkbox], .claim-row input[type=radio] {',
    '    align-self:flex-start!important; margin:0 0 2px 0!important;',
    '  }',
    '',
    '  .detail-grid { display:grid!important; grid-template-columns:minmax(0,1fr)!important; gap:12px!important; width:100%!important; }',
    '  .sticky-side { position:static!important; top:auto!important; width:100%!important; max-width:100%!important; }',
    '  .page h1, .page h2 { max-width:100%!important; overflow-wrap:anywhere!important; }',
    '',
    '  /* Text inputs only — NEVER stretch checkboxes */',
    '  input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea {',
    '    width:100%!important; max-width:100%!important; min-width:0!important;',
    '    min-height:42px!important; box-sizing:border-box!important; font-size:16px!important;',
    '  }',
    '  textarea { min-height:96px!important; }',
    '  button, [role=button], .primary-btn, .secondary-btn, .danger-btn { min-height:40px!important; max-width:100%!important; }',
    '',
    '  /* Native checkboxes — fix solid black square bug */',
    '  input[type=checkbox], input[type=radio] {',
    '    -webkit-appearance:checkbox!important;',
    '    appearance:auto!important;',
    '    width:18px!important; height:18px!important;',
    '    min-width:18px!important; min-height:18px!important;',
    '    max-width:18px!important; max-height:18px!important;',
    '    padding:0!important; margin:0!important;',
    '    flex:0 0 auto!important;',
    '    opacity:1!important;',
    '    accent-color:#2563eb!important;',
    '    background-color:transparent!important;',
    '    border:none!important;',
    '    box-shadow:none!important;',
    '    position:relative!important;',
    '    vertical-align:middle!important;',
    '  }',
    '  input[type=radio] { -webkit-appearance:radio!important; }',
    '',
    '  .table-wrap, .claims-table-shell { width:100%!important; max-width:100%!important; overflow-x:auto!important; }',
    '  .card, [class*=card], [class*=panel] { max-width:100%!important; min-width:0!important; box-sizing:border-box!important; }',
    '}',
    '@media (min-width: 901px) { .sdlg-mobile-only { display:none!important; } }'
  ].join('\n');

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.setAttribute('data-sdlg-mobile-layout-v19', '1');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function isMobile() {
    try { return window.matchMedia('(max-width: 900px)').matches; }
    catch (_) { return window.innerWidth <= 900; }
  }

  function force(el, props) {
    if (!el || !el.style) return;
    for (var k in props) {
      if (Object.prototype.hasOwnProperty.call(props, k)) {
        try { el.style.setProperty(k, props[k], 'important'); } catch (_) {}
      }
    }
  }

  function relocateThemeSwitcher() {
    var sw = document.querySelector('.sdlg-theme-switcher');
    var tools = document.querySelector('.nav-tools');
    if (!sw || !tools) return;
    if (sw.parentElement !== tools) {
      try { tools.appendChild(sw); } catch (_) {}
    }
    force(sw, {
      position: 'static', left: 'auto', right: 'auto', bottom: 'auto',
      transform: 'none', 'max-width': 'none', opacity: '1',
      'z-index': 'auto', margin: '0', display: 'flex'
    });
  }

  function reorderTopbarDom() {
    var brand = document.querySelector('.topbar-inner .brand');
    var tools = document.querySelector('.topbar-inner .nav-tools');
    var nav = document.querySelector('.topbar-inner .nav-scroll');
    if (!brand || !tools || !nav) return;
    if (brand.nextElementSibling !== tools) {
      try { brand.after(tools); } catch (_) {}
    }
    if (tools.nextElementSibling !== nav) {
      try { tools.after(nav); } catch (_) {}
    }
  }

  function looksLikeMetricCard(el) {
    if (!el) return false;
    var t = (el.innerText || '').trim();
    if (!t || t.length > 100) return false;
    var lines = t.split('\n').filter(Boolean);
    if (lines.length < 1 || lines.length > 5) return false;
    return /^(Klaim|USD|CNY|IDR|Total|Draft|Reject|Submit|Claim|Paid|Billing|Approved|On Hold|SDLG|Submitted|Claimed|TOTAL|APPROVAL|REJECTION|P0|P1)/i.test(lines[0]);
  }

  function forceMetricParents() {
    document.querySelectorAll('.page div, main div').forEach(function (el) {
      if (el.children.length < 4 || el.children.length > 16) return;
      var metricKids = 0;
      for (var i = 0; i < el.children.length; i++) {
        if (looksLikeMetricCard(el.children[i])) metricKids++;
      }
      if (metricKids >= 4) {
        force(el, {
          display: 'grid',
          'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
          gap: '8px',
          width: '100%',
          'max-width': '100%'
        });
        Array.prototype.forEach.call(el.children, function (c) {
          force(c, {
            width: 'auto',
            'max-width': '100%',
            'min-width': '0',
            'box-sizing': 'border-box',
            'grid-column': 'auto'
          });
        });
      }
    });
  }

  function forceCheckboxes() {
    document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(function (el) {
      force(el, {
        width: '18px',
        height: '18px',
        'min-width': '18px',
        'min-height': '18px',
        'max-width': '18px',
        'max-height': '18px',
        padding: '0',
        margin: '0',
        flex: '0 0 auto',
        opacity: '1',
        'background-color': 'transparent',
        'accent-color': '#2563eb'
      });
      // Undo any full-width stretch from other rules
      try {
        el.style.setProperty('-webkit-appearance', el.type === 'radio' ? 'radio' : 'checkbox', 'important');
        el.style.setProperty('appearance', 'auto', 'important');
      } catch (_) {}
    });
    document.querySelectorAll('.claim-row input[type="checkbox"]').forEach(function (el) {
      force(el, { 'align-self': 'flex-start', margin: '0 0 2px 0' });
    });
  }

  function forceTopbar() {
    reorderTopbarDom();
    relocateThemeSwitcher();

    document.querySelectorAll('.topbar').forEach(function (t) {
      force(t, { height: 'auto', 'min-height': '0', overflow: 'visible' });
    });
    document.querySelectorAll('.topbar-inner').forEach(function (t) {
      force(t, {
        height: 'auto', 'min-height': '0', width: '100%', 'max-width': 'none',
        display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center',
        gap: '8px', padding: '8px 10px'
      });
    });
    document.querySelectorAll('.brand').forEach(function (b) {
      force(b, {
        order: '1', flex: '1 1 auto', 'min-width': '0',
        'max-width': 'calc(100% - 140px)', overflow: 'hidden'
      });
    });
    document.querySelectorAll('.brand-sub').forEach(function (s) {
      force(s, { display: 'none' });
    });
    document.querySelectorAll('.brand-title').forEach(function (t) {
      force(t, { opacity: '1', color: '' }); // let CSS theme handle color
    });
    document.querySelectorAll('.nav-tools').forEach(function (nt) {
      force(nt, {
        order: '2', flex: '0 0 auto', width: 'auto', 'max-width': 'none',
        display: 'flex', 'flex-wrap': 'nowrap', 'align-items': 'center',
        'justify-content': 'flex-end', gap: '6px', 'min-width': '0'
      });
    });
    document.querySelectorAll('.nav-tools .connection-pill').forEach(function (p) {
      force(p, { display: 'none' });
    });
    document.querySelectorAll('.nav-scroll').forEach(function (n) {
      force(n, {
        order: '3', flex: '0 0 100%', width: '100%', 'max-width': '100%',
        display: 'flex', 'flex-wrap': 'nowrap', 'overflow-x': 'auto'
      });
    });
  }

  function enforceOnce() {
    if (!isMobile()) return;

    force(document.documentElement, { 'overflow-x': 'hidden', width: '100%', 'max-width': '100%' });
    force(document.body, { 'overflow-x': 'hidden', width: '100%', 'max-width': '100%' });

    document.querySelectorAll('.page').forEach(function (p) {
      force(p, {
        width: '100%', 'max-width': '100%', 'box-sizing': 'border-box',
        'padding-left': '12px', 'padding-right': '12px', 'padding-bottom': '24px'
      });
    });

    forceTopbar();
    forceMetricParents();
    forceCheckboxes();

    document.querySelectorAll('.status-track').forEach(function (s) {
      force(s, {
        display: 'grid',
        'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
        gap: '8px', width: '100%'
      });
    });

    document.querySelectorAll('.search-wrap, .claims-filter-bar, .claims-searchbar').forEach(function (el) {
      force(el, {
        display: 'flex', 'flex-direction': 'column', gap: '8px',
        width: '100%', 'max-width': '100%'
      });
    });

    document.querySelectorAll('.claims-table-head').forEach(function (h) {
      force(h, { display: 'none', height: '0', overflow: 'hidden', margin: '0', padding: '0' });
    });
    document.querySelectorAll('.claims-list').forEach(function (list) {
      force(list, { display: 'flex', 'flex-direction': 'column', gap: '10px', width: '100%' });
    });
    document.querySelectorAll('.claim-row').forEach(function (row) {
      force(row, {
        display: 'flex', 'flex-direction': 'column', width: '100%', 'max-width': '100%',
        'min-width': '0', 'box-sizing': 'border-box', overflow: 'hidden',
        transform: 'none', padding: '12px', gap: '6px', 'align-items': 'stretch'
      });
    });

    document.querySelectorAll('.detail-grid').forEach(function (g) {
      force(g, {
        display: 'grid', 'grid-template-columns': 'minmax(0, 1fr)', gap: '12px', width: '100%'
      });
    });
    document.querySelectorAll('.sticky-side').forEach(function (s) {
      force(s, { position: 'static', top: 'auto', width: '100%', 'max-width': '100%' });
    });

    document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea').forEach(function (el) {
      force(el, {
        width: '100%', 'max-width': '100%', 'min-width': '0',
        'min-height': '42px', 'box-sizing': 'border-box', 'font-size': '16px'
      });
    });
  }

  var scheduled = false;
  function scheduleEnforce() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      enforceOnce();
    });
  }

  function startObserver() {
    if (window[ATTR + '-obs']) return;
    var obs = new MutationObserver(function () {
      if (isMobile()) scheduleEnforce();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    window[ATTR + '-obs'] = obs;
    window.addEventListener('resize', scheduleEnforce, { passive: true });
    window.addEventListener('orientationchange', scheduleEnforce, { passive: true });
  }

  function boot() {
    injectCss();
    if (isMobile()) enforceOnce();
    startObserver();
    var ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      if (isMobile()) enforceOnce();
      if (ticks >= 60) clearInterval(iv);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
