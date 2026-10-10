/**
 * SDLG Overview session gate v1
 * If #/overview is blank because data fetched before JWT was ready,
 * soft-reload once when session becomes valid.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_OVERVIEW_SESSION_GATE__) return;
  root.__SDLG_OVERVIEW_SESSION_GATE__ = true;

  var RELOAD_KEY = 'sdlg_overview_session_reload_v1';

  function onOverview() {
    var h = String(root.location.hash || '');
    return /#\/?overview/i.test(h) || h === '' || h === '#/' || h === '#';
  }

  function hasOverviewContent() {
    try {
      var t = document.body ? document.body.innerText : '';
      if (/Total Claims|Claim Trend|My Action|KPI|metric/i.test(t)) return true;
      if (document.querySelector('.metric-card, .metric-value, [class*="kpi"]')) return true;
    } catch (_) {}
    return false;
  }

  function showBanner(msg) {
    var id = 'sdlg-overview-session-banner';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:fixed;z-index:99998;left:12px;right:12px;top:72px;padding:12px 14px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;box-shadow:0 8px 24px rgba(0,0,0,.12);';
      document.body.appendChild(el);
    }
    el.innerHTML = msg + ' <a href="#/login" style="color:#1d4ed8;font-weight:700;margin-left:8px;">Login ulang</a>';
  }

  async function tick() {
    if (!onOverview()) return;
    var c = null;
    try { c = typeof root.getSdlgSupabase === 'function' ? root.getSdlgSupabase() : null; } catch (_) {}
    if (!c || !c.auth) return;

    var session = null;
    try {
      var res = await c.auth.getSession();
      session = res && res.data ? res.data.session : null;
      if (!session && typeof root.sdlgRecheckSession === 'function') {
        session = await root.sdlgRecheckSession();
      }
    } catch (_) {}

    if (!session || !session.access_token) return;

    if (!hasOverviewContent()) {
      try {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          console.info('[SDLG overview-gate] session OK but blank UI — soft reload once');
          root.location.reload();
          return;
        }
        showBanner('Session aktif tapi data Overview gagal dimuat. Coba refresh, atau');
      } catch (_) {}
    } else {
      try { sessionStorage.removeItem(RELOAD_KEY); } catch (_) {}
      var b = document.getElementById('sdlg-overview-session-banner');
      if (b) try { b.remove(); } catch (_) {}
    }
  }

  function boot() {
    root.addEventListener('sdlg-session-ready', function () { setTimeout(tick, 400); });
    root.addEventListener('hashchange', function () { setTimeout(tick, 300); });
    setTimeout(tick, 800);
    setTimeout(tick, 2000);
    setTimeout(tick, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  root.SDLGOverviewSessionGate = { version: '1.0.0', tick: tick };
})(window);
