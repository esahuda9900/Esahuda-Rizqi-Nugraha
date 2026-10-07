/**
 * Phase C bridge — load flat core modules (Workers cannot serve modules/core/* yet).
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
  load('/modules/sdlg-core-constants.js', 'data-sdlg-core-constants');
  load('/modules/sdlg-core-date.js', 'data-sdlg-core-date');
  load('/modules/sdlg-core-currency.js', 'data-sdlg-core-currency');
  window.SDLGCore = {
    version: '1.0.1-phase-c',
    ready: function () {
      return !!(window.SDLGCoreDate && window.SDLGCoreCurrency && window.SDLGCoreConstants);
    }
  };
})();
