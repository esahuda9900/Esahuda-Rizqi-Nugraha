/**
 * Load pure core modules early (Phase C). Visual/logic-safe strangle.
 * index.html already calls window.SDLGNormalizeClaimCurrency when defined.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  if (window.__SDLG_CORE_BRIDGE__) return;
  window.__SDLG_CORE_BRIDGE__ = true;

  function load(src, marker) {
    if (document.querySelector('script[' + marker + ']')) return;
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.setAttribute(marker, '1');
    (document.head || document.documentElement).appendChild(s);
  }

  load('/modules/core/constants.js', 'data-sdlg-core-constants');
  load('/modules/core/date.js', 'data-sdlg-core-date');
  load('/modules/core/currency.js', 'data-sdlg-core-currency');

  window.SDLGCore = {
    version: '1.0.0-phase-c',
    ready: function () {
      return !!(window.SDLGCoreDate && window.SDLGCoreCurrency && window.SDLGCoreConstants);
    }
  };
})();
