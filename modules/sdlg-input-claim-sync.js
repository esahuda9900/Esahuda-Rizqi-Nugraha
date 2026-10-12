/**
 * SDLG Input claim-id sync v1.1 — safety lock against cross-claim paste errors
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_INPUT_CLAIM_SYNC_V11__) return;
    root.__SDLG_INPUT_CLAIM_SYNC_V11__ = true;

    var LS_INPUT = 'sdlg-warranty:last-sdlginput-claim:v1';

    function isYear(s) {
      return /^\d{4}$/.test(String(s || ''));
    }

    function isClaimId(s) {
      s = String(s || '').trim();
      if (!s || isYear(s)) return false;
      return /SDLG-PFR/i.test(s) || /\d{3,4}-\d{4}/.test(s) || s.length > 8;
    }

    function fromHash() {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.claimId === 'function') {
          var id = String(root.SDLGHashRouter.claimId() || '').trim();
          if (isClaimId(id)) return id;
        }
      } catch (_) {}
      var h = String(root.location.hash || '');
      var m = h.match(/#?\/?(?:sdlg-input|sdlginput)\/([^/?#]+)/i);
      if (m) {
        var a = decodeURIComponent(m[1]).trim();
        if (isClaimId(a)) return a;
      }
      m = h.match(/#?\/?claims\/([^/?#]+)/i);
      if (m) {
        var b = decodeURIComponent(m[1]).trim();
        if (isClaimId(b)) return b;
      }
      m = h.match(/#?\/?claim\/([^/?#]+)/i);
      if (m) {
        var c = decodeURIComponent(m[1]).trim();
        if (isClaimId(c)) return c;
      }
      return '';
    }

    function resolvePreferredClaimId(explicit) {
      var ex = explicit != null ? String(explicit).trim() : '';
      if (isClaimId(ex)) return ex;
      return fromHash() || '';
    }

    function remember(id) {
      id = String(id || '').trim();
      if (!isClaimId(id)) return;
      try {
        root.localStorage.setItem(LS_INPUT, id);
      } catch (_) {}
    }

    function extractClaimFromText(t) {
      var m = String(t || '').match(/(\d{3,4}-\d{4}-SDLG-PFR)/i);
      return m ? m[1].toUpperCase() : '';
    }

    function integrityCheck() {
      try {
        var page = document.querySelector('[data-sdlg-input-helper]') || document.body;
        if (!page) return;
        var report = page.querySelector('[data-sdlg-report-body]');
        var claimBoxes = page.querySelectorAll('div');
        var headerClaim = '';
        for (var i = 0; i < claimBoxes.length; i++) {
          var lab = claimBoxes[i];
          if (/^CLAIM$/i.test(String(lab.textContent || '').trim())) {
            var next = lab.nextElementSibling;
            if (next) headerClaim = extractClaimFromText(next.textContent);
            if (!headerClaim && lab.parentElement)
              headerClaim = extractClaimFromText(lab.parentElement.textContent);
            if (headerClaim) break;
          }
        }
        var sel = page.querySelector('select');
        if (!headerClaim && sel && sel.value)
          headerClaim = extractClaimFromText(sel.value) || String(sel.value).trim();

        var reportClaim = report ? extractClaimFromText(report.textContent) : '';
        var hashClaim = fromHash();

        var warnId = 'sdlg-claim-integrity-warn';
        var existing = document.getElementById(warnId);
        if (existing) existing.remove();

        var ids = [headerClaim, reportClaim, hashClaim].filter(Boolean);
        var uniq = [];
        ids.forEach(function (x) {
          x = String(x).toUpperCase();
          if (uniq.indexOf(x) < 0) uniq.push(x);
        });
        if (uniq.length < 2) return;

        var bar = document.createElement('div');
        bar.id = warnId;
        bar.setAttribute('role', 'alert');
        bar.style.cssText =
          'position:sticky;top:0;z-index:9999;background:#7f1d1d;color:#fff;padding:10px 14px;' +
          'font:700 13px/1.4 system-ui,sans-serif;border-bottom:3px solid #fecaca';
        bar.textContent =
          '\u26a0 CLAIM MISMATCH \u2014 jangan copy ke portal. Terdeteksi lebih dari satu claim id: ' +
          uniq.join(' \u00b7 ') +
          '. Pilih ulang claim di list, atau buka dari detail claim.';
        var host = document.querySelector('[data-sdlg-input-helper]') || document.body;
        host.insertBefore(bar, host.firstChild);
      } catch (e) {
        try {
          console.warn('[SDLG integrity]', e);
        } catch (_) {}
      }
    }

    function syncFromHash() {
      var id = fromHash();
      if (id) remember(id);
      try {
        root.dispatchEvent(new CustomEvent('sdlg-input-claim', { detail: { claimId: id || null } }));
      } catch (_) {}
      setTimeout(integrityCheck, 50);
      setTimeout(integrityCheck, 400);
    }

    root.SDLGInputClaimSync = {
      version: '1.1.0',
      fromHash: fromHash,
      resolve: resolvePreferredClaimId,
      remember: remember,
      integrityCheck: integrityCheck
    };

    root.addEventListener('hashchange', function () {
      setTimeout(syncFromHash, 30);
    });
    root.addEventListener('sdlg-route', function () {
      setTimeout(syncFromHash, 30);
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(syncFromHash, 80);
      });
    } else {
      setTimeout(syncFromHash, 80);
    }
    setTimeout(integrityCheck, 1200);
    setTimeout(integrityCheck, 2500);
  } catch (e) {
    try {
      console.warn('[SDLG input-claim-sync]', e);
    } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
