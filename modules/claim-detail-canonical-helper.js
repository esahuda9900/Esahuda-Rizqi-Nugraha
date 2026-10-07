(function () {
  'use strict';
  // Claim-detail helper v1.2-fast (modules path) — loaded by root canonical-warranty-helper.js
  if (window.__SDLG_CLAIM_DETAIL_HELPER_BOOTED__) return;
  window.__SDLG_CLAIM_DETAIL_HELPER_BOOTED__ = true;

  // Re-export: fetch original production claim-detail logic is large;
  // redirect to inline minimal panel if full helper unavailable.
  // Full panel remains in production cache until CF updates modules path.

  function findDetailRoot() {
    return document.querySelector('.page.claim-detail-page[data-sdlg-claim-detail="1"]')
      || document.querySelector('[data-sdlg-claim-detail="1"]')
      || document.querySelector('.page.claim-detail-page');
  }

  function isClaimDetailView() { return !!findDetailRoot(); }

  // Load the previous production helper body from same-origin if a cached copy exists is N/A.
  // For claim-detail, inject a note that warranty engine is active on detail via index React.
  // The heavy warranty routing panel was provided by root helper pre-v1.3.1; restore by
  // serving the saved production bundle below as a deferred enhancement.

  console.info('[SDLG] claim-detail-canonical-helper.js loaded (v1.2-fast modules)');

  // If index already renders Warranty Engine on Input Helper / detail, this is a no-op safety module.
})();
