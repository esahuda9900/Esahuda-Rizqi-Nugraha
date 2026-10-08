/**
 * Claim detail layout fix — visual only.
 * Relative CSS path for GitHub Project Pages.
 */
(function () {
  'use strict';
  if (window.__SDLG_CLAIM_DETAIL_LAYOUT_FIX__) return;
  window.__SDLG_CLAIM_DETAIL_LAYOUT_FIX__ = true;

  var HREF = './styles/sdlg-claim-detail-clean-v2.css?v=3';

  function ensureCss() {
    var link = document.querySelector('link[data-sdlg-claim-detail-clean]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-sdlg-claim-detail-clean', '1');
      (document.head || document.documentElement).appendChild(link);
    }
    if (link.getAttribute('href') !== HREF) link.href = HREF;
  }

  function isClaimDetail() {
    return !!document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
  }

  function fixNavHighlight() {
    if (!isClaimDetail()) return;
    var btns = document.querySelectorAll('.nav-btn, [data-tab], header nav button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var label = String(b.getAttribute('data-tab') || b.textContent || '').toLowerCase();
      var isClaims = /claims|klaim|list/.test(label) && !/quality|unit|360|master|input|overview|new claim/.test(label);
      if (isClaims) {
        b.classList.add('active');
        try { b.setAttribute('aria-current', 'page'); } catch (_) {}
      } else if (/unit\s*360|\b360\b|quality|master|sdlg input|overview|new claim/.test(label)) {
        b.classList.remove('active');
        try { b.removeAttribute('aria-current'); } catch (_) {}
      }
    }
  }

  function tick() {
    try {
      ensureCss();
      fixNavHighlight();
    } catch (_) {}
  }

  tick();
  setTimeout(tick, 300);
  setTimeout(tick, 1000);
  setInterval(tick, 2500);

  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      clearTimeout(window.__sdlgLayoutFixTimer);
      window.__sdlgLayoutFixTimer = setTimeout(tick, 120);
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
})();
