(function (root) {
  'use strict';
  function clean(value) { return value == null ? '' : String(value).replace(/\s+/g, ' ').trim(); }
  function normalizeModel(value) { return clean(value).replace(/^SDLG\s+/i, '').replace(/\s+/g, '').toUpperCase(); }
  root.SDLGMasterResolutionUX = root.SDLGMasterResolutionUX || Object.freeze({ clean: clean, normalizeModel: normalizeModel });
})(window);

;(function () {
  try {
    if (window.__SDLG_CLAIM_CONTEXT_LOADER_V14__) return;
    window.__SDLG_CLAIM_CONTEXT_LOADER_V14__ = true;
    window.__SDLG_CLAIM_CONTEXT_LOADER__ = true;
    function inject(src) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    }
    inject('./modules/claim-context-resolve.js?v=20261008-v4');
    inject('./modules/sdlg-portal-copy-helper.js?v=20261008-v1.3');
    inject('./modules/sdlg-portal-ux-v2.js?v=20261008-v2.1');
    inject('./modules/sdlg-portal-enrich.js?v=20261008-v1.3');
    if (/github\.io/i.test(location.host)) {
      var base = (location.pathname.split('/').slice(0, 2).join('/') || '');
      inject(base + '/modules/claim-context-resolve.js?v=20261008-v4');
      inject(base + '/modules/sdlg-portal-copy-helper.js?v=20261008-v1.3');
      inject(base + '/modules/sdlg-portal-ux-v2.js?v=20261008-v2.1');
      inject(base + '/modules/sdlg-portal-enrich.js?v=20261008-v1.3');
    }
  } catch (e) {
    console.warn('[SDLG] claim-context loader', e);
  }
})();
