/**
 * Feedback Person fix v1.5 — NO-OP when unified hydrate is active.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_FB_FIX_V15__) return;
  root.__SDLG_FB_FIX_V15__ = true;

  function run() {
    if (root.__SDLG_DISABLE_FB_FIX_WRITES__ || root.SDLGInputHydrate) return;
    // legacy path disabled
  }

  root.SDLGFeedbackPersonFix = { version: '1.5.0-noop', run: run };
})(typeof window !== 'undefined' ? window : this);
