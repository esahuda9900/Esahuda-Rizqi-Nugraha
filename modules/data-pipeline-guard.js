/**
 * data-pipeline-guard — lightweight stub (full diagnostics deferred)
 * Log only when ?debug=1 or localStorage sdlg-debug=1
 */
(function (root) {
  'use strict';
  if (root.__SDLG_DATA_PIPELINE_GUARD__) return;
  root.__SDLG_DATA_PIPELINE_GUARD__ = true;

  function isDebug() {
    try {
      if (/[?&]debug=1(?:&|$)/.test(String(root.location && root.location.search))) return true;
      if (root.localStorage && root.localStorage.getItem('sdlg-debug') === '1') return true;
    } catch (_) {}
    return false;
  }

  root.SDLGDataPipeline = {
    version: 'stub-2026-10-30',
    getClient: function () { return null; },
    recoverSession: function () { return Promise.resolve(null); },
    fetchClaimsProbe: function () { return Promise.resolve({ reason: 'STUB', rows: [] }); },
    runDiagnostics: function () { return Promise.resolve(null); }
  };

  root.SDLGDisplayValue = function SDLGDisplayValue(value, emptyText) {
    emptyText = emptyText == null ? '\u2014' : emptyText;
    if (value == null) return emptyText;
    if (typeof value === 'string' && value.trim() === '') return emptyText;
    if (Array.isArray(value) && value.length === 0) return emptyText;
    return value;
  };

  if (isDebug()) {
    try { console.info('[SDLG] data-pipeline-guard stub (debug)'); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
