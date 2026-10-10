/**
 * SDLG UI Polish v3 — inject industrial ops stylesheet (anti-slop).
 */
(function (root) {
  'use strict';
  if (root.__SDLG_UI_POLISH_V3__) return;
  root.__SDLG_UI_POLISH_V3__ = true;

  var HREF = './modules/sdlg-ui-polish-v3.css?v=20261010-v3';
  function inject() {
    if (document.getElementById('sdlg-ui-polish-v3')) return;
    var link = document.createElement('link');
    link.id = 'sdlg-ui-polish-v3';
    link.rel = 'stylesheet';
    link.href = HREF;
    (document.head || document.documentElement).appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }

  setTimeout(function () {
    try {
      var link = document.getElementById('sdlg-ui-polish-v3');
      if (!link) return;
      var ok = false;
      try {
        ok = !!(link.sheet && link.sheet.cssRules && link.sheet.cssRules.length);
      } catch (_) {
        return;
      }
      if (!ok) {
        var s = document.createElement('style');
        s.id = 'sdlg-ui-polish-v3-inline';
        s.textContent =
          '.login-screen{background:#eef1f6!important;background-image:none!important}' +
          '.login-card{border-radius:12px!important;border:1px solid #d5dbe6!important;background:#fff!important;' +
          'box-shadow:0 1px 1px rgba(15,23,42,.04),0 10px 28px rgba(15,23,42,.06)!important;backdrop-filter:none!important}' +
          '.claim-row:hover{transform:none!important;box-shadow:none!important;background:#f8fafc!important}' +
          '.app-shell:not(:has(.login-screen)) .topbar{backdrop-filter:none!important;background:#fff!important;box-shadow:none!important}';
        document.head.appendChild(s);
      }
    } catch (_) {}
  }, 2500);

  root.SDLGUiPolish = { version: '3.0.0' };
})(window);
