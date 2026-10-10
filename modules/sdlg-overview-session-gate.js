/**
 * SDLG Overview session gate v1.2 — silent (no banner, no reload)
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_OVERVIEW_SESSION_GATE_V12__) return;
    root.__SDLG_OVERVIEW_SESSION_GATE_V12__ = true;
    root.SDLGOverviewSessionGate = { version: '1.2.0', disabled: true };
  } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
