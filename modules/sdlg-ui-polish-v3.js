/**
 * SDLG UI Polish v3.3 — force login fixes + hide pipeline banner + autofocus.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_UI_POLISH_V33__) return;
  root.__SDLG_UI_POLISH_V33__ = true;
  root.__SDLG_UI_POLISH_V3__ = true;

  var HREF = './modules/sdlg-ui-polish-v3.css?v=20261010-v33';

  function injectCss() {
    var existing = document.getElementById('sdlg-ui-polish-v3');
    if (existing) {
      existing.href = HREF;
      return;
    }
    var link = document.createElement('link');
    link.id = 'sdlg-ui-polish-v3';
    link.rel = 'stylesheet';
    link.href = HREF;
    (document.head || document.documentElement).appendChild(link);
    // also refresh static link if present
    var st = document.getElementById('sdlg-ui-polish-v3-static');
    if (st) st.href = HREF;
  }

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

  function ensureStatusPill() {
    if (!onLoginPage()) return;
    var intro = document.querySelector('.login-intro');
    if (!intro) return;
    if (intro.querySelector('.login-status-pill')) return;
    var trust = intro.querySelector('.login-trust-list');
    var pill = document.createElement('div');
    pill.className = 'login-status-pill';
    pill.setAttribute('role', 'status');
    pill.innerHTML =
      '<span class="login-status-dot" aria-hidden="true"></span>' +
      '<span>Sistem siap · Silakan login</span>';
    if (trust && trust.parentNode) {
      trust.parentNode.insertBefore(pill, trust);
    } else {
      intro.appendChild(pill);
    }
  }

  function tick() {
    hidePipelineBannerOnLogin();
    ensureStatusPill();
    autoFocusLogin();
  }

  function boot() {
    injectCss();
    tick();
    if (typeof MutationObserver !== 'undefined') {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(tick, 120);
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
    setInterval(tick, 1500);
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

  root.SDLGUiPolish = { version: '3.3.0', refresh: tick };
})(window);
