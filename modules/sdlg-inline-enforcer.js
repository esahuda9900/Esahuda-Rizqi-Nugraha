/**
 * SDLG Inline Enforcer v4 — disabled compatibility shim.
 * It previously competed with React by mutating the same fields on an interval.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_INLINE_ENFORCER_DISABLED_V4__) return;
  root.__SDLG_INLINE_ENFORCER_DISABLED_V4__ = true;
  root.__SDLG_DISABLE_INLINE_ENFORCER_WRITES__ = true;
  root.SDLGInlineEnforcer = {
    version: '4.0.0-disabled',
    disabled: true,
    tick: function () { return false; }
  };
})(typeof window !== 'undefined' ? window : this);
