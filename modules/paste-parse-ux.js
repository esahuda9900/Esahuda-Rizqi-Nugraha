/** paste-parse-ux — stub (observer disabled). Log only if ?debug=1 */
(function (root) {
  'use strict';
  if (root.__SDLG_PASTE_STUB__) return;
  root.__SDLG_PASTE_STUB__ = true;
  root.SDLGPasteParseUx = { version: 'stub-2026-10-30' };
  try {
    var dbg =
      /[?&]debug=1(?:&|$)/.test(String(root.location && root.location.search)) ||
      (root.localStorage && root.localStorage.getItem('sdlg-debug') === '1');
    if (dbg) console.info('[SDLG] paste-parse-ux stub (debug)');
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
