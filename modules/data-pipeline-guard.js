/**
 * data-pipeline-guard — EMERGENCY STUB 2026-10-22
 * Full diagnostics deferred: auto-boot fetch on login was extra work during freeze.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_DATA_PIPELINE_GUARD__) return;
  root.__SDLG_DATA_PIPELINE_GUARD__ = true;

  root.SDLGDataPipeline = {
    version: 'stub-2026-10-22',
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

  try { console.info('[SDLG] data-pipeline-guard emergency stub'); } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
