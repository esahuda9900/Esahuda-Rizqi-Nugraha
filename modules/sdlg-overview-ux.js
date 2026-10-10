/**
 * SDLG Overview UX v1.1 — fail-safe (no infinite MutationObserver loop)
 * NEVER crash the app. Prefer silent skip over blank page.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_OVERVIEW_UX_V11__) return;
    root.__SDLG_OVERVIEW_UX_V11__ = true;
    root.__SDLG_OVERVIEW_UX_V1__ = true;

    var busy = false;
    var lastRun = 0;
    var MAX_RUNS_PER_MIN = 30;
    var runCount = 0;
    var runWindowStart = Date.now();

    function injectCss() {
      try {
        if (document.getElementById('sdlg-overview-ux-css')) return;
        var link = document.createElement('link');
        link.id = 'sdlg-overview-ux-css';
        link.rel = 'stylesheet';
        link.href = './modules/sdlg-overview-ux.css?v=20261010-v11';
        (document.head || document.documentElement).appendChild(link);
      } catch (e) {
        console.warn('[SDLG overview-ux] injectCss', e);
      }
    }

    function onOverview() {
      try {
        var h = String(root.location.hash || '');
        return /#\/?overview/i.test(h) || h === '' || h === '#' || h === '#/';
      } catch (_) {
        return false;
      }
    }

    function fixKpiZeros() {
      var cards = document.querySelectorAll('.metric-card');
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (card.getAttribute('data-sdlg-kpi-fixed') === '1') continue;
        var labelEl = card.querySelector('.metric-label');
        var valEl = card.querySelector('.metric-value');
        if (!valEl) continue;
        var label = labelEl ? String(labelEl.textContent || '') : '';
        var v = String(valEl.textContent || '').trim();
        var changed = false;
        if (/Rate/i.test(label) && (/^0(\.0+)?%?$/.test(v) || v === '0%')) {
          valEl.textContent = '\u2014';
          card.setAttribute('data-empty', '1');
          changed = true;
        }
        if (/Amount/i.test(label) && /USD/.test(v) && /CNY/.test(v) && valEl.getAttribute('data-sdlg-amount-fixed') !== '1') {
          var usd = v.match(/USD\s*[\d,]+(?:\.\d+)?/);
          var cny = v.match(/CNY\s*[\d,]+(?:\.\d+)?/);
          if (usd && cny) {
            valEl.textContent = usd[0] + ' (' + cny[0] + ')';
            valEl.setAttribute('data-sdlg-amount-fixed', '1');
            changed = true;
          }
        }
        if (changed) card.setAttribute('data-sdlg-kpi-fixed', '1');
      }
    }

    function fixActionToday() {
      var buttons = document.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (btn.getAttribute('data-sdlg-action-fixed') === '1') continue;
        var t = btn.textContent || '';
        if (!/P0 Critical|P1 Action Required|P2 Monitoring|Needs action/i.test(t)) continue;
        var pri = /P0 Critical/i.test(t) ? 'P0' : /P1 Action/i.test(t) ? 'P1' : /P2 Monitoring/i.test(t) ? 'P2' : 'ACTION';
        btn.setAttribute('data-sdlg-priority', pri);
        if (pri === 'P2') {
          var spans = btn.querySelectorAll('span');
          for (var j = 0; j < spans.length; j++) {
            if (String(spans[j].textContent).trim() === 'ACTION') {
              spans[j].textContent = 'MONITOR';
              spans[j].style.color = '#64748b';
            }
          }
        }
        btn.setAttribute('data-sdlg-action-fixed', '1');
      }
    }

    function fixRejectionPercents() {
      try {
        var nodes = document.querySelectorAll('div');
        var host = null;
        for (var i = 0; i < nodes.length; i++) {
          var tx = nodes[i].textContent || '';
          if (/Top Rejection Reasons/i.test(tx) && tx.length < 80) {
            host = nodes[i].parentElement;
            break;
          }
        }
        if (!host || host.getAttribute('data-sdlg-rej-fixed') === '1') return;
        var pairs = [];
        var rows = host.children;
        for (var r = 0; r < rows.length; r++) {
          var b = rows[r].querySelector && rows[r].querySelector('b');
          if (!b) continue;
          var n = parseInt(String(b.textContent).replace(/[^\d]/g, ''), 10);
          if (!isNaN(n)) pairs.push({ b: b, n: n });
        }
        var total = 0;
        for (var p = 0; p < pairs.length; p++) total += pairs[p].n;
        if (total <= 0) return;
        for (var q = 0; q < pairs.length; q++) {
          if (/%/.test(pairs[q].b.textContent || '')) continue;
          pairs[q].b.textContent = pairs[q].n + ' (' + Math.round((pairs[q].n / total) * 100) + '%)';
        }
        host.setAttribute('data-sdlg-rej-fixed', '1');
      } catch (e) {
        console.warn('[SDLG overview-ux] rejection', e);
      }
    }

    function tick() {
      if (busy) return;
      if (!onOverview()) return;
      var now = Date.now();
      if (now - lastRun < 400) return;
      if (now - runWindowStart > 60000) {
        runWindowStart = now;
        runCount = 0;
      }
      if (runCount >= MAX_RUNS_PER_MIN) return;
      lastRun = now;
      runCount++;
      busy = true;
      try {
        fixKpiZeros();
        fixActionToday();
        fixRejectionPercents();
      } catch (e) {
        console.warn('[SDLG overview-ux] tick failed (non-fatal)', e);
      } finally {
        busy = false;
      }
    }

    function boot() {
      try {
        injectCss();
        root.addEventListener('hashchange', function () {
          setTimeout(function () { try { tick(); } catch (_) {} }, 300);
        });
        root.addEventListener('sdlg-session-ready', function () {
          setTimeout(function () { try { tick(); } catch (_) {} }, 600);
        });
        setTimeout(function () { try { tick(); } catch (_) {} }, 800);
        setTimeout(function () { try { tick(); } catch (_) {} }, 2000);
        setTimeout(function () { try { tick(); } catch (_) {} }, 4000);
      } catch (e) {
        console.warn('[SDLG overview-ux] boot failed (non-fatal)', e);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { boot(); } catch (_) {} }, { once: true });
    } else {
      try { boot(); } catch (_) {}
    }

    root.SDLGOverviewUx = { version: '1.1.0', tick: tick };
  } catch (e) {
    try { console.warn('[SDLG overview-ux] module init failed (non-fatal)', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
