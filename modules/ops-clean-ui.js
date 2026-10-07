/**
 * SDLG ops-clean UI — CSS layer + Phase C core bridge loader + Repair Date inject.
 */
(function () {
  'use strict';
  var MARKER = 'data-sdlg-ops-clean';
  var HREF = '/styles/sdlg-ops-clean-v1.css';
  function loadScript(src, marker) {
    if (typeof document === 'undefined') return;
    if (document.querySelector('script[' + marker + ']')) return;
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute(marker, '1');
    (document.head || document.documentElement).appendChild(s);
  }
  function inject() {
    if (typeof document === 'undefined') return;
    loadScript('/modules/sdlg-core-bridge.js', 'data-sdlg-core-bridge');
    loadScript('/modules/sdlg-repair-date-inject.js?v=1.3.2', 'data-sdlg-repair-date');
    if (document.querySelector('link[' + MARKER + '], style[' + MARKER + ']')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    link.setAttribute(MARKER, '1');
    (document.head || document.documentElement).appendChild(link);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
