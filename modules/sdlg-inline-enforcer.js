/**
 * SDLG Inline Enforcer v4 — intentionally disabled.
 * React owns report/date/location; SDLGInputHydrate is event-driven for remaining fields.
 * Kept as a compatibility file so an old script reference cannot reintroduce a writer loop.
 */
(function (root) {
  'use strict';
  root.__SDLG_INLINE_ENFORCER_V4_DISABLED__ = true;
  root.__SDLG_INLINE_ENFORCER__ = false;
  root.SDLGInlineEnforcer = { version: '4.0.0-disabled', active: false };
})(typeof window !== 'undefined' ? window : this);
