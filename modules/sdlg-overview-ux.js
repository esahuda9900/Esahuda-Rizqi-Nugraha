/**
 * SDLG Overview UX v1
 */
(function (root) {
  'use strict';
  if (root.__SDLG_OVERVIEW_UX_V1__) return;
  root.__SDLG_OVERVIEW_UX_V1__ = true;

  function injectCss() {
    if (document.getElementById('sdlg-overview-ux-css')) return;
    var link = document.createElement('link');
    link.id = 'sdlg-overview-ux-css';
    link.rel = 'stylesheet';
    link.href = './modules/sdlg-overview-ux.css?v=20261010-v1';
    (document.head || document.documentElement).appendChild(link);
  }

  function onOverview() {
    var h = String(root.location.hash || '');
    return /#\/?overview/i.test(h) || h === '' || h === '#' || h === '#/';
  }

  function fixKpiZeros() {
    document.querySelectorAll('.metric-card').forEach(function (card) {
      var label = (card.querySelector('.metric-label') || {}).textContent || '';
      var valEl = card.querySelector('.metric-value');
      if (!valEl) return;
      var v = String(valEl.textContent || '').trim();
      if (/Rate/i.test(label) && (/^0(\.0+)?%?$/.test(v) || v === '0%')) {
        valEl.textContent = '\u2014';
        card.setAttribute('data-empty', '1');
      }
      if (/Amount/i.test(label) && /USD/.test(v) && /CNY/.test(v)) {
        var usd = v.match(/USD\s*[\d,]+(?:\.\d+)?/);
        var cny = v.match(/CNY\s*[\d,]+(?:\.\d+)?/);
        if (usd && cny) {
          valEl.innerHTML = usd[0] + ' <span style="font-size:11px;font-weight:500;color:#64748b">(' + cny[0] + ')</span>';
        }
      }
    });
  }

  function fixActionToday() {
    document.querySelectorAll('button').forEach(function (btn) {
      var t = btn.textContent || '';
      if (!/P0 Critical|P1 Action Required|P2 Monitoring|Needs action/i.test(t)) return;
      var pri = /P0 Critical/i.test(t) ? 'P0' : /P1 Action/i.test(t) ? 'P1' : /P2 Monitoring/i.test(t) ? 'P2' : 'ACTION';
      btn.setAttribute('data-sdlg-priority', pri);
      if (pri === 'P2') {
        btn.querySelectorAll('span').forEach(function (sp) {
          if (String(sp.textContent).trim() === 'ACTION') {
            sp.textContent = 'MONITOR';
            sp.style.color = '#64748b';
          }
        });
      }
    });
  }

  function fixRejectionPercents() {
    var nodes = document.querySelectorAll('div');
    var host = null;
    for (var i = 0; i < nodes.length; i++) {
      var tx = nodes[i].textContent || '';
      if (/Top Rejection Reasons/i.test(tx) && tx.length < 80) {
        host = nodes[i].parentElement;
        break;
      }
    }
    if (!host) return;
    var pairs = [];
    host.querySelectorAll(':scope > div').forEach(function (row) {
      var b = row.querySelector('b');
      if (!b) return;
      var n = parseInt(String(b.textContent).replace(/[^\d]/g, ''), 10);
      if (!isNaN(n)) pairs.push({ b: b, n: n });
    });
    var total = pairs.reduce(function (s, p) { return s + p.n; }, 0);
    if (total <= 0) return;
    pairs.forEach(function (p) {
      if (/%/.test(p.b.textContent || '')) return;
      p.b.textContent = p.n + ' (' + Math.round((p.n / total) * 100) + '%)';
    });
  }

  function tick() {
    if (!onOverview()) return;
    fixKpiZeros();
    fixActionToday();
    fixRejectionPercents();
  }

  function boot() {
    injectCss();
    root.addEventListener('hashchange', function () { setTimeout(tick, 200); });
    root.addEventListener('sdlg-session-ready', function () { setTimeout(tick, 500); });
    try {
      new MutationObserver(function () { if (onOverview()) tick(); }).observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
    setTimeout(tick, 600);
    setTimeout(tick, 1500);
    setTimeout(tick, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGOverviewUx = { version: '1.0.0', tick: tick };
})(window);
