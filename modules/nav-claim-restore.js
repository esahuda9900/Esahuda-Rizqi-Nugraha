/**
 * SDLG Nav Claim Restore — V2.0 (Smart Navigation Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO POLLING: Gak ada setTimeout 40x lagi (Hemat baterai).
 * ✅ SMART OBSERVER: Cuma ngawasin area list klaim (bukan seluruh DOM).
 * ✅ ROBUST REGEX: Nangkep semua format ID (SDLG, SDLG-PFR, dll).
 * ✅ SAFE CLICK: Pakai dispatchEvent biar React pasti nangkep.
 * ✅ POPSTATE: Handle tombol Back/Forward browser dengan benar.
 * ✅ USER FEEDBACK: Muncul notif "Memulihkan klaim..." saat restore.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_NAV_CLAIM_RESTORE_V2__) return;
  window.__SDLG_NAV_CLAIM_RESTORE_V2__ = true;
  window.__SDLG_NAV_CLAIM_RESTORE__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & STATE
  // ─────────────────────────────────────────────────────────
  var KEY = 'sdlg-warranty:last-claim:v2';
  var SKIP_KEY = 'sdlg-warranty:skip-claim-restore:v2';
  var CLAIM_REGEX = /\b(\d{3,4}-\d{4}-SDLG(?:-PFR)?)\b/i;
  
  var state = {
    restoring: false,
    lastSaved: '',
    retryCount: 0,
    maxRetry: 15, // Maksimal 15x coba (3 detik), bukan 40x
    retryTimer: null
  };

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
  // ─────────────────────────────────────────────────────────
  function extractClaimId(text) {
    var m = String(text || '').match(CLAIM_REGEX);
    return m ? m[1].toUpperCase() : '';
  }

  function getStored() {
    try {
      // Prioritas 1: Cek URL Hash (#claim/ID)
      var h = String(window.location.hash || '').replace(/^#/, '');
      var hm = h.match(/^claim\/([^/?#]+)/i);
      if (hm) {
        var idFromHash = decodeURIComponent(hm[1]);
        if (CLAIM_REGEX.test(idFromHash)) return idFromHash;
      }
      // Prioritas 2: Cek LocalStorage
      var s = window.localStorage.getItem(KEY) || '';
      if (CLAIM_REGEX.test(s)) return s;
    } catch (_) {}
    return '';
  }

  function saveStored(id) {
    if (!id || state.lastSaved === id) return;
    try {
      window.localStorage.setItem(KEY, id);
      window.localStorage.removeItem(SKIP_KEY);
      
      // Update URL tanpa reload
      var nextHash = '#claim/' + encodeURIComponent(id);
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
      state.lastSaved = id;
    } catch (_) {}
  }

  function markSkip() {
    try {
      window.localStorage.setItem(SKIP_KEY, '1');
      if (window.location.hash && /claim\//i.test(window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (_) {}
  }

  function shouldSkip() {
    try { return window.localStorage.getItem(SKIP_KEY) === '1'; } catch (_) { return false; }
  }

  // ─────────────────────────────────────────────────────────
  // 3. DOM DETECTION
  // ─────────────────────────────────────────────────────────
  function isDetailPage() {
    return !!document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
  }

  function getDetailClaimId() {
    var root = document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
    if (!root) return '';
    return extractClaimId(root.innerText || '');
  }

  function findClaimRow(claimId) {
    // Cari di list modern
    var rows = document.querySelectorAll('.claim-row');
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i].textContent || '').indexOf(claimId) >= 0) return rows[i];
    }
    // Cari di tabel legacy
    var trs = document.querySelectorAll('.claims-table-shell tbody tr, table tbody tr');
    for (var j = 0; j < trs.length; j++) {
      if ((trs[j].textContent || '').indexOf(claimId) >= 0) return trs[j];
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────
  // 4. RESTORE ENGINE
  // ─────────────────────────────────────────────────────────
  function attemptRestore() {
    if (state.restoring || isDetailPage() || shouldSkip()) return;
    
    var id = getStored();
    if (!id) return;

    var row = findClaimRow(id);
    
    // Kalau row belum ada (list masih loading), tunggu bentar
    if (!row) {
      if (state.retryCount < state.maxRetry) {
        state.retryCount++;
        clearTimeout(state.retryTimer);
        state.retryTimer = setTimeout(attemptRestore, 200);
      }
      return;
    }

    // Eksekusi Klik
    state.restoring = true;
    console.info('[SDLG Restore] 🎯 Memulihkan klaim:', id);
    
    if (window.SDLGNotify) {
      window.SDLGNotify.info('Memulihkan Klaim', 'Kembali ke klaim terakhir: ' + id);
    }

    try {
      // Pakai MouseEvent biar React pasti nangkep
      var evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      row.dispatchEvent(evt);
    } catch (_) {
      row.click(); // Fallback
    }

    setTimeout(function () {
      state.restoring = false;
    }, 1500);
  }

  function onNavigate() {
    if (isDetailPage()) {
      var id = getDetailClaimId();
      if (id) saveStored(id);
    } else {
      // Reset retry counter kalo pindah halaman
      state.retryCount = 0;
      attemptRestore();
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. EVENT LISTENERS (No Polling!)
  // ─────────────────────────────────────────────────────────
  
  // A. Klik manual (User navigasi)
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;

    // Cek apakah user klik tombol "Back" / "Semua Klaim"
    var btn = t.closest('button, a, .nav-btn');
    if (btn) {
      var label = String(btn.textContent || '');
      if (/kembali|back to list|semua klaim|claims|dashboard/i.test(label) && isDetailPage()) {
        markSkip();
      }
    }

    // Cek apakah user klik baris klaim
    var row = t.closest('.claim-row, tr');
    if (row && !isDetailPage()) {
      var cid = extractClaimId(row.textContent || '');
      if (cid) {
        try { window.localStorage.removeItem(SKIP_KEY); } catch (_) {}
        saveStored(cid);
      }
    }
  }, true);

  // B. Browser Back/Forward Button
  window.addEventListener('popstate', onNavigate);

  // C. Smart Observer (Cuma ngawasin container list, bukan seluruh DOM)
  function setupObserver() {
    var container = document.querySelector('.claims-list, .claims-table-shell, .page');
    if (!container || !window.MutationObserver) return;

    var debounce;
    var obs = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(onNavigate, 150);
    });
    
    // Cuma ngawasin kalau childList berubah (ada list baru masuk)
    obs.observe(container, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────
  // 6. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    onNavigate();
    setupObserver();

    // Jaga-jaga kalau React render super lama (cuma 2x, bukan 40x)
    setTimeout(onNavigate, 500);
    setTimeout(onNavigate, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 7. PUBLIC API
  // ─────────────────────────────────────────────────────────
  window.SDLGNavClaimRestore = Object.freeze({
    version: '2.0.0',
    get: getStored,
    save: saveStored,
    clear: markSkip,
    restore: attemptRestore,
    isDetail: isDetailPage
  });

})();