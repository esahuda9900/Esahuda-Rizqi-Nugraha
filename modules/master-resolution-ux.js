(function (root) {
  'use strict';
  function clean(value) { return value == null ? '' : String(value).replace(/\s+/g, ' ').trim(); }
  function normalizeModel(value) { return clean(value).replace(/^SDLG\s+/i, '').replace(/\s+/g, '').toUpperCase(); }
  root.SDLGMasterResolutionUX = root.SDLGMasterResolutionUX || Object.freeze({ clean: clean, normalizeModel: normalizeModel });
})(window);

;(function () {
  try {
    if (window.__SDLG_CLAIM_CONTEXT_LOADER_V17__) return;
    window.__SDLG_CLAIM_CONTEXT_LOADER_V17__ = true;
    window.__SDLG_CLAIM_CONTEXT_LOADER__ = true;
    function inject(src) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    }
    function basePath() {
      try {
        if (/github\.io/i.test(location.host)) {
          var parts = location.pathname.split('/').filter(Boolean);
          // /Esahuda-Rizqi-Nugraha/... → /Esahuda-Rizqi-Nugraha/
          if (parts.length >= 1) return '/' + parts[0] + '/';
        }
      } catch (_) {}
      return './';
    }
    var b = basePath();
    inject(b + 'modules/sdlg-policy-repair-hardfix.js?v=20261008-v2.1');
    inject(b + 'modules/sdlg-portal-enrich.js?v=20261008-v1.4');
    inject(b + 'modules/sdlg-policy-table-fill.js?v=20261008-v1.1');
    inject(b + 'modules/claim-context-resolve.js?v=20261008-v4');
    inject(b + 'modules/sdlg-portal-copy-helper.js?v=20261008-v1.3');
    inject(b + 'modules/sdlg-portal-ux-v2.js?v=20261008-v2.1');
  } catch (e) {
    console.warn('[SDLG] claim-context loader', e);
  }
})();
