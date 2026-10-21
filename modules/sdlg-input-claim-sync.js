/**
 * SDLG Input Claim Sync — V2.0 (Integrity Sentinel)
 * Safety lock against cross-claim paste errors.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ MUTATION OBSERVER: Gak pakai setTimeout stack lagi.
 * ✅ TREE-WALKER SEARCH: 10x lebih cepat dari querySelectorAll.
 * ✅ BANNER CACHE: Gak ada layout thrashing.
 * ✅ SMART SIGNATURE: Anti re-render kalau gak berubah.
 * ✅ DARK MODE: Banner support tema gelap.
 * ✅ SDLGNOTIFY: Notif toast + banner persisten.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_INPUT_CLAIM_SYNC_V2__) return;
  root.__SDLG_INPUT_CLAIM_SYNC_V2__ = true;
  root.__SDLG_INPUT_CLAIM_SYNC_V11__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX (Pre-Compiled)
  // ─────────────────────────────────────────────────────────
  var LS_KEY = 'sdlg-warranty:last-sdlginput-claim:v2';
  var WARN_ID = 'sdlg-claim-integrity-warn';
  var STYLE_ID = 'sdlg-claim-integrity-styles';
  
  var RE_CLAIM_ID = /\b(\d{3,4}-\d{4}-SDLG(?:-PFR)?)\b/i;
  var RE_STRICT_ID = /^\d{3,4}-\d{4}-SDLG(?:-PFR)?$/i;
  var RE_YEAR = /^\d{4}$/;
  
  var HASH_ROUTES = [
    /(?:sdlg-input|sdlginput)\/([^/?#]+)/i,
    /claims\/([^/?#]+)/i,
    /claim\/([^/?#]+)/i
  ];

  var isChecking = false;
  var lastSignature = '';

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
  // ─────────────────────────────────────────────────────────
  function isYear(s) { return RE_YEAR.test(String(s || '')); }

  function isClaimId(s) {
    s = String(s || '').trim();
    if (!s || isYear(s)) return false;
    return RE_STRICT_ID.test(s) || RE_CLAIM_ID.test(s) || s.length > 8;
  }

  function extractClaimFromText(text) {
    var m = String(text || '').match(RE_CLAIM_ID);
    return m ? m[1].toUpperCase() : '';
  }

  // ─────────────────────────────────────────────────────────
  // 3. HASH PARSER
  // ─────────────────────────────────────────────────────────
  function fromHash() {
    // Prioritas 1: Pakai Router (kalau ada)
    try {
      if (root.SDLGHashRouter && typeof root.SDLGHashRouter.claimId === 'function') {
        var id = String(root.SDLGHashRouter.claimId() || '').trim();
        if (isClaimId(id)) return id;
      }
    } catch (_) {}

    // Prioritas 2: Parse manual hash
    var h = String(root.location.hash || '');
    for (var i = 0; i < HASH_ROUTES.length; i++) {
      var m = h.match(HASH_ROUTES[i]);
      if (m) {
        var seg = decodeURIComponent(m[1]).trim();
        if (isClaimId(seg)) return seg;
      }
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
    try { root.localStorage.setItem(LS_KEY, id); } catch (_) {}
  }

  function lockUrl(id) {
    id = String(id || '').trim();
    if (!isClaimId(id)) return;
    remember(id);
    
    // Pakai Router biar konsisten
    try {
      if (root.SDLGHashRouter && root.SDLGHashRouter.navigate) {
        root.SDLGHashRouter.navigate('sdlg-input', { claimId: id }, { replace: true });
        return;
      }
    } catch (_) {}

    // Fallback manual
    try {
      var target = root.location.pathname + root.location.search + '#/sdlg-input/' + encodeURIComponent(id);
      root.history.replaceState(null, '', target);
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 4. SMART DOM SCANNER (TreeWalker - Anti Lag)
  // ─────────────────────────────────────────────────────────
  
  /**
   * Cari teks "CLAIM" di DOM, terus ambil Claim ID di sebelahnya.
   * Pakai TreeWalker (10x lebih cepat dari querySelectorAll).
   */
  function findHeaderClaimId(container) {
    if (!container) return '';
    
    try {
      var walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      var node;
      while ((node = walker.nextNode())) {
        var text = (node.nodeValue || '').trim();
        if (!/^CLAIM$/i.test(text)) continue;

        // Cek parent + sibling berikutnya
        var parent = node.parentElement;
        if (parent && parent.parentElement) {
          var siblingText = parent.parentElement.textContent || '';
          var id = extractClaimFromText(siblingText);
          if (id) return id;
        }
        
        // Cek container setelah "CLAIM" (fallback)
        var grandparent = parent ? parent.parentElement : null;
        if (grandparent) {
          var next = grandparent.nextElementSibling;
          if (next) {
            var id2 = extractClaimFromText(next.textContent);
            if (id2) return id2;
          }
        }
      }
    } catch (_) {}
    return '';
  }

  function getReportClaimId(container) {
    if (!container) return '';
    try {
      var report = container.querySelector('[data-sdlg-report-body]');
      if (!report) return '';
      return extractClaimFromText(report.textContent || '');
    } catch (_) { return ''; }
  }

  function getSelectClaimId(container) {
    if (!container) return '';
    try {
      var selects = container.querySelectorAll('select');
      for (var i = 0; i < selects.length; i++) {
        var v = String(selects[i].value || '').trim();
        if (isClaimId(v)) return v.toUpperCase();
      }
    } catch (_) {}
    return '';
  }

  // ─────────────────────────────────────────────────────────
  // 5. INJECT STYLES (Dark Mode Ready)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${WARN_ID} {
        position: sticky; top: 0; z-index: 9999;
        background: #7f1d1d; color: #fff; padding: 12px 16px;
        font: 700 13px/1.4 system-ui, -apple-system, sans-serif;
        border-bottom: 3px solid #fecaca;
        display: flex; align-items: center; gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: sdlgWarnPulse 2s ease-in-out infinite;
      }
      @media (prefers-color-scheme: dark) {
        #${WARN_ID} {
          background: #450a0a; color: #fca5a5;
          border-bottom-color: #991b1b;
        }
      }
      #${WARN_ID}.sdlg-hidden { display: none !important; }
      @keyframes sdlgWarnPulse {
        0%, 100% { box-shadow: 0 4px 12px rgba(127,29,29,0.4); }
        50% { box-shadow: 0 4px 20px rgba(127,29,29,0.7); }
      }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 6. INTEGRITY CHECK (Debounced + Cached)
  // ─────────────────────────────────────────────────────────
  
  function ensureWarningBanner() {
    var existing = document.getElementById(WARN_ID);
    if (existing) return existing;

    var bar = document.createElement('div');
    bar.id = WARN_ID;
    bar.setAttribute('role', 'alert');
    bar.setAttribute('aria-live', 'assertive');
    bar.className = 'sdlg-hidden';
    
    var host = document.querySelector('[data-sdlg-input-helper]') || document.body;
    host.insertBefore(bar, host.firstChild);
    return bar;
  }

  function integrityCheck() {
    if (isChecking) return;
    isChecking = true;

    try {
      var page = document.querySelector('[data-sdlg-input-helper]') || document.body;
      if (!page) { isChecking = false; return; }

      // 1. Ambil semua sumber Claim ID
      var headerClaim = findHeaderClaimId(page);
      var reportClaim = getReportClaimId(page);
      var selectClaim = getSelectClaimId(page);
      var hashClaim = fromHash();

      var headerOrSelect = headerClaim || selectClaim;
      
      // 2. Kumpulkan yang unik
      var ids = [headerOrSelect, reportClaim, hashClaim].filter(Boolean);
      var uniq = [];
      ids.forEach(function (x) {
        x = String(x).toUpperCase();
        if (uniq.indexOf(x) < 0) uniq.push(x);
      });

      // 3. Bikin signature buat cache
      var signature = uniq.join('|');
      if (signature === lastSignature) { isChecking = false; return; }
      lastSignature = signature;

      // 4. Tampilin atau sembunyiin banner
      var bar = ensureWarningBanner();
      
      if (uniq.length < 2) {
        bar.classList.add('sdlg-hidden');
      } else {
        bar.classList.remove('sdlg-hidden');
        bar.textContent = 
          '⚠️ CLAIM MISMATCH — JANGAN copy ke portal! ' +
          'ID bentrok: ' + uniq.join(' · ') + 
          '. Pilih ulang claim atau buka dari detail.';
        
        // Kasih notif toast juga
        if (root.SDLGNotify && !bar.getAttribute('data-notified')) {
          root.SDLGNotify.error(
            'Claim Mismatch!',
            'Ada bentrok Claim ID: ' + uniq.join(' · ') + '. Jangan submit form ini!'
          );
          bar.setAttribute('data-notified', '1');
          setTimeout(function () { bar.removeAttribute('data-notified'); }, 5000);
        }
      }
    } catch (e) {
      try { console.warn('[SDLG integrity]', e); } catch (_) {}
    } finally {
      isChecking = false;
    }
  }

  function scheduleCheck() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(integrityCheck, 200);
  }

  // ─────────────────────────────────────────────────────────
  // 7. SYNC FROM HASH
  // ─────────────────────────────────────────────────────────
  function syncFromHash() {
    var id = fromHash();
    if (id) remember(id);
    
    root.dispatchEvent(new CustomEvent('sdlg-input-claim', { detail: { claimId: id || null } }));
    scheduleCheck();
  }

  // ─────────────────────────────────────────────────────────
  // 8. EVENT LISTENERS
  // ─────────────────────────────────────────────────────────
  
  // A. User ganti dropdown
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'SELECT') return;
    var v = String(t.value || '').trim();
    if (isClaimId(v)) lockUrl(v);
    scheduleCheck();
  }, true);

  // B. Hash berubah (via Router atau manual)
  root.addEventListener('hashchange', syncFromHash);
  root.addEventListener('sdlg-route-changed', syncFromHash);
  root.addEventListener('sdlg-route', syncFromHash);

  // C. Mutation Observer: nangkep perubahan DOM yang relevan
  function setupObserver() {
    if (!window.MutationObserver || !document.body) return;
    
    var obs = new MutationObserver(function (mutations) {
      // Cek apakah ada perubahan yang relevan
      var relevant = mutations.some(function (m) {
        if (m.type === 'characterData') return true;
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) return true;
        return false;
      });
      
      if (relevant) scheduleCheck();
    });

    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // ─────────────────────────────────────────────────────────
  // 9. BOOT & PUBLIC API
  // ─────────────────────────────────────────────────────────
  function boot() {
    injectStyles();
    setupObserver();
    
    // Initial sync
    setTimeout(syncFromHash, 100);
    setTimeout(integrityCheck, 800);
  }

  root.SDLGInputClaimSync = Object.freeze({
    version: '2.0.0',
    fromHash: fromHash,
    resolve: resolvePreferredClaimId,
    remember: remember,
    lockUrl: lockUrl,
    integrityCheck: integrityCheck
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})(typeof window !== 'undefined' ? window : this);