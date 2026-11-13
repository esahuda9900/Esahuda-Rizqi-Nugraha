/**
 * SDLG UI Polish v3.5 — login helpers only (no archived CSS inject).
 * 2026-10-30: sdlg-ui-polish-v3/v4.css moved to modules/_archive.
 * Active styles already live under styles/ (ux-polish-v3, modern-refresh, etc.).
 */
(function (root) {
  'use strict';
  if (root.__SDLG_UI_POLISH_V35__) return;
  root.__SDLG_UI_POLISH_V35__ = true;
  root.__SDLG_UI_POLISH_V3__ = true;

  function onLoginPage() {
    return !!document.querySelector('main.login-screen, .login-screen');
  }

  function hidePipelineBannerOnLogin() {
    var el = document.getElementById('sdlg-data-pipeline-banner');
    if (!el) return;
    if (onLoginPage()) {
      el.setAttribute('data-login-hide', '1');
      el.style.display = 'none';
      try { el.remove(); } catch (_) {}
    } else {
      el.removeAttribute('data-login-hide');
    }
  }

  function autoFocusLogin() {
    if (!onLoginPage()) return;
    var el = document.getElementById('login-email');
    if (!el) return;
    try {
      if (document.activeElement === el) return;
      if (el.getAttribute('data-sdlg-autofocused') === '1') return;
      el.setAttribute('data-sdlg-autofocused', '1');
      setTimeout(function () {
        try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
      }, 80);
    } catch (_) {}
  }

  function tick() {
    if (!onLoginPage()) return false;
    hidePipelineBannerOnLogin();
    autoFocusLogin();
    return true;
  }

  function boot() {
    tick();
    if (typeof MutationObserver !== 'undefined') {
      var t = null;
      var target = document.getElementById('root') || document.body || document.documentElement;
      if (target) {
        var obs = new MutationObserver(function () {
          if (!onLoginPage()) {
            if (document.querySelector('.topbar')) obs.disconnect();
            return;
          }
          clearTimeout(t);
          t = setTimeout(tick, 100);
        });
        obs.observe(target, { childList: true, subtree: true });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try {
    var prev = root.SDLGDataPipeline && root.SDLGDataPipeline.runDiagnostics;
    if (typeof prev === 'function' && !root.__SDLG_PIPELINE_LOGIN_PATCH__) {
      root.__SDLG_PIPELINE_LOGIN_PATCH__ = true;
      root.SDLGDataPipeline.runDiagnostics = async function () {
        var result = await prev.apply(this, arguments);
        if (onLoginPage()) hidePipelineBannerOnLogin();
        return result;
      };
    }
  } catch (_) {}

  root.SDLGUiPolish = { version: '3.5.0-clean', refresh: tick };
})(window);
