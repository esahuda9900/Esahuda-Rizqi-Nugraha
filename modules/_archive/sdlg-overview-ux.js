/**
 * SDLG Overview UX — V2.0 (Smart Visual Patcher)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ MUTATION OBSERVER: Gak ada setTimeout nebak-nebak lagi.
 * ✅ DEBOUNCE: Anti loop tanpa rem darurat (MAX_RUNS).
 * ✅ PRE-COMPILED REGEX: Parsing jadi super cepat.
 * ✅ REACT-SAFE: Modifikasi DOM tanpa ngerusak Virtual DOM.
 * ✅ SMART CSS: Inline style diganti jadi CSS class.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_OVERVIEW_UX_V2__) return;
  root.__SDLG_OVERVIEW_UX_V2__ = true;
  root.__SDLG_OVERVIEW_UX_V11__ = true; // Backward compat

  var STYLE_ID = 'sdlg-overview-ux-css';
  var CSS_HREF = './modules/sdlg-overview-ux.css?v=20261021-v2';
  
  var debounceTimer = null;
  var isRunning = false;

  // Pre-compiled Regex
  var RE_RATE_ZERO = /^0(\.0+)?%?$/;
  var RE_USD = /USD\s*[\d,]+(?:\.\d+)?/;
  var RE_CNY = /CNY\s*[\d,]+(?:\.\d+)?/;
  var RE_PRIORITY = /P0 Critical|P1 Action Required|P2 Monitoring|Needs action/i;

  // ─────────────────────────────────────────────────────────
  // 1. STYLES (Inject 1x aja)
  // ─────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    (document.head || document.documentElement).appendChild(link);
  }

  // ─────────────────────────────────────────────────────────
  // 2. PAGE DETECTION
  // ─────────────────────────────────────────────────────────
  function isOnOverview() {
    var h = String(root.location.hash || '');
    return /#\/?overview/i.test(h) || h === '' || h === '#' || h === '#/';
  }

  // ─────────────────────────────────────────────────────────
  // 3. FIX KPI CARDS (Angka 0 & Amount)
  // ─────────────────────────────────────────────────────────
  function fixKpiCards() {
    var cards = document.querySelectorAll('.metric-card:not([data-sdlg-kpi-fixed])');
    if (!cards.length) return;

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var labelEl = card.querySelector('.metric-label');
      var valEl = card.querySelector('.metric-value');
      if (!valEl) continue;

      var label = labelEl ? String(labelEl.textContent || '') : '';
      var v = String(valEl.textContent || '').trim();
      var changed = false;

      // A. Rate 0% -> Ubah jadi strip "—"
      if (/Rate/i.test(label) && RE_RATE_ZERO.test(v)) {
        valEl.textContent = '—';
        card.setAttribute('data-empty', '1');
        changed = true;
      }

      // B. Amount USD + CNY -> Ubah format biar rapi
      if (/Amount/i.test(label) && v.indexOf('USD') >= 0 && v.indexOf('CNY') >= 0) {
        var usdMatch = v.match(RE_USD);
        var cnyMatch = v.match(RE_CNY);
        if (usdMatch && cnyMatch) {
          valEl.textContent = usdMatch[0] + ' (' + cnyMatch[0] + ')';
          changed = true;
        }
      }

      // Tandai biar gak diproses ulang (React-safe)
      if (changed) card.setAttribute('data-sdlg-kpi-fixed', '1');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. FIX ACTION PRIORITY BUTTONS
  // ─────────────────────────────────────────────────────────
  function fixActionButtons() {
    var buttons = document.querySelectorAll('button:not([data-sdlg-action-fixed])');
    if (!buttons.length) return;

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var text = btn.textContent || '';
      
      if (!RE_PRIORITY.test(text)) continue;

      // Tentukan priority
      var pri = 'ACTION';
      if (/P0 Critical/i.test(text)) pri = 'P0';
      else if (/P1 Action/i.test(text)) pri = 'P1';
      else if (/P2 Monitoring/i.test(text)) pri = 'P2';

      btn.setAttribute('data-sdlg-priority', pri);

      // Ganti teks "ACTION" jadi "MONITOR" untuk P2 (via CSS class)
      if (pri === 'P2') {
        var spans = btn.querySelectorAll('span');
        for (var j = 0; j < spans.length; j++) {
          var span = spans[j];
          if (String(span.textContent).trim() === 'ACTION') {
            // React-safe: Cek dulu apakah udah diganti
            if (!span.hasAttribute('data-sdlg-monitor')) {
              span.setAttribute('data-sdlg-monitor', '1');
              span.textContent = 'MONITOR';
              span.classList.add('sdlg-priority-monitor-text'); // Styling pindah ke CSS
            }
          }
        }
      }

      btn.setAttribute('data-sdlg-action-fixed', '1');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. FIX REJECTION PERCENTAGES
  // ─────────────────────────────────────────────────────────
  function fixRejectionPercents() {
    // Cari container spesifik (bukan semua div)
    var hosts = document.querySelectorAll('.card, .wx-panel, [data-sdlg-panel]');
    
    for (var h = 0; h < hosts.length; h++) {
      var host = hosts[h];
      if (host.getAttribute('data-sdlg-rej-fixed') === '1') continue;

      var text = host.textContent || '';
      if (!/Top Rejection Reasons/i.test(text) || text.length > 2000) continue;

      // Kumpulin semua <b> yang isinya angka
      var bolds = host.querySelectorAll('b');
      var pairs = [];
      var total = 0;

      for (var i = 0; i < bolds.length; i++) {
        var b = bolds[i];
        var raw = String(b.textContent || '');
        
        // Skip kalau udah ada persen
        if (/%/.test(raw)) continue;
        
        var n = parseInt(raw.replace(/[^\d]/g, ''), 10);
        if (isNaN(n)) continue;

        pairs.push({ el: b, n: n });
        total += n;
      }

      if (total <= 0 || !pairs.length) continue;

      // Update text pakai persentase
      for (var p = 0; p < pairs.length; p++) {
        var pct = Math.round((pairs[p].n / total) * 100);
        pairs[p].el.textContent = pairs[p].n + ' (' + pct + '%)';
      }

      host.setAttribute('data-sdlg-rej-fixed', '1');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 6. RUN ENGINE
  // ─────────────────────────────────────────────────────────
  function run() {
    if (isRunning || !isOnOverview()) return;
    
    isRunning = true;
    try {
      injectCss();
      fixKpiCards();
      fixActionButtons();
      fixRejectionPercents();
    } catch (e) {
      console.warn('[SDLG Overview UX] run error:', e);
    } finally {
      isRunning = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 7. SMART SCHEDULER (Debounced)
  // ─────────────────────────────────────────────────────────
  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 300);
  }

  // ─────────────────────────────────────────────────────────
  // 8. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    injectCss();
    
    // 1. Initial run (kasih delay 1 frame)
    requestAnimationFrame(schedule);

    // 2. Mutation Observer (Cuma jalan kalau DOM berubah)
    if (root.MutationObserver && document.body) {
      var obs = new MutationObserver(schedule);
      obs.observe(document.body, { childList: true, subtree: true });
    }

    // 3. Event dari Router / Sinyal lain
    root.addEventListener('hashchange', schedule);
    root.addEventListener('sdlg-route-changed', schedule);
    root.addEventListener('sdlg-session-ready', schedule);
    root.addEventListener('sdlg-overview-ready', schedule);
  }

  // ─────────────────────────────────────────────────────────
  // 9. INIT
  // ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 10. PUBLIC API
  // ─────────────────────────────────────────────────────────
  root.SDLGOverviewUx = Object.freeze({
    version: '2.0.0',
    tick: run,
    refresh: schedule
  });

})(typeof window !== 'undefined' ? window : globalThis);