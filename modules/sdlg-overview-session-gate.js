/**
 * SDLG Overview session gate v1.1 — NO soft-reload (was causing blank flash)
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_OVERVIEW_SESSION_GATE_V11__) return;
    root.__SDLG_OVERVIEW_SESSION_GATE_V11__ = true;
    root.__SDLG_OVERVIEW_SESSION_GATE__ = true;

    function onOverview() {
      var h = String(root.location.hash || '');
      return /#\/?overview/i.test(h) || h === '' || h === '#' || h === '#/';
    }

    function hasOverviewContent() {
      try {
        var t = document.body ? document.body.innerText : '';
        if ((t || '').length < 80) return false;
        if (/Total Claims|Claim Trend|My Action|KPI|metric|Command Center/i.test(t)) return true;
        if (document.querySelector('.metric-card, .metric-value, [class*="kpi"]')) return true;
      } catch (_) {}
      return false;
    }

    function showBanner(msg) {
      try {
        var id = 'sdlg-overview-session-banner';
        var el = document.getElementById(id);
        if (!el) {
          el = document.createElement('div');
          el.id = id;
          el.style.cssText = 'position:fixed;z-index:99998;left:12px;right:12px;top:72px;padding:12px 14px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;';
          if (document.body) document.body.appendChild(el);
        }
        el.innerHTML = msg + ' <a href="#/login" style="color:#1d4ed8;font-weight:700;margin-left:8px;">Login ulang</a>';
      } catch (_) {}
    }

    async function tick() {
      try {
        if (!onOverview()) return;
        var c = typeof root.getSdlgSupabase === 'function' ? root.getSdlgSupabase() : null;
        if (!c || !c.auth) return;
        var res = await c.auth.getSession();
        var session = res && res.data ? res.data.session : null;
        if (!session || !session.access_token) return;
        if (!hasOverviewContent()) {
          showBanner('Session aktif tapi Overview belum memuat data. Coba refresh manual, atau');
        } else {
          var b = document.getElementById('sdlg-overview-session-banner');
          if (b) try { b.remove(); } catch (_) {}
        }
      } catch (e) {
        console.warn('[SDLG overview-gate] non-fatal', e);
      }
    }

    function boot() {
      try {
        root.addEventListener('sdlg-session-ready', function () { setTimeout(tick, 800); });
        root.addEventListener('hashchange', function () { setTimeout(tick, 500); });
        setTimeout(tick, 2000);
        setTimeout(tick, 5000);
      } catch (_) {}
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }

    root.SDLGOverviewSessionGate = { version: '1.1.0', tick: tick };
  } catch (e) {
    try { console.warn('[SDLG overview-gate] init failed', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
