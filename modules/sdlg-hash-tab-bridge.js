/**
 * SDLG Hash ↔ Tab Bridge — V3.0 (Smart Sync Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ ROUTER INTEGRATION: Rely on SDLGHashRouter (no duplicate logic).
 * ✅ ZERO HACKS: Ganti time-based (userNavUntil) jadi state flag.
 * ✅ SAFE FALLBACK: Tetap bisa simulasi klik kalau React gak punya hook.
 * ✅ DEBOUNCED: Anti loop pas URL dan Tab balapan.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_HASH_TAB_BRIDGE_V3__) return;
  root.__SDLG_HASH_TAB_BRIDGE_V3__ = true;
  root.__SDLG_HASH_TAB_BRIDGE_V23__ = true; // Backward compat

  var isApplying = false;
  var lastHash = '';

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES
  // ─────────────────────────────────────────────────────────
  
  // Cek apakah URL nunjuk ke halaman Detail Klaim (Jangan ubah nav bar)
  function isClaimDetailHash(h) {
    h = String(h || root.location.hash || '').replace(/^#/, '');
    if (h.charAt(0) !== '/') h = '/' + h;
    
    // Format legacy: #/claim/xxx
    if (/^\/claim\//i.test(h)) return true;
    
    // Format baru: #/claims/xxx (bukan tahun)
    var m = h.match(/^\/claims\/([^/]+)/i);
    if (m) {
      var seg = decodeURIComponent(m[1]);
      if (/^\d{4}$/.test(seg)) return false; // Ini tahun (misal #/claims/2026)
      return true; // Ini ID claim
    }
    
    return false;
  }

  // Ambil tab dari Hash (pakai router kalau ada)
  function getTabFromHash() {
    try {
      if (root.SDLGHashRouter && typeof root.SDLGHashRouter.tabForRoute === 'function') {
        return root.SDLGHashRouter.tabForRoute();
      }
    } catch (_) {}

    // Fallback manual (kalau router belum jalan)
    var h = String(root.location.hash || '').replace(/^#/, '');
    if (h.charAt(0) !== '/') h = '/' + h;
    var head = (h.replace(/^\//, '').split('/')[0] || 'overview').toLowerCase();
    
    var map = {
      'overview': 'dashboard', 'claims': 'list', 'list': 'list',
      'login': 'login', 'new-claim': 'paste', 'sdlg-input': 'sdlginput',
      'master-data': 'masters', 'data-quality': 'quality', 'unit360': 'unit360',
      'claim': 'claim'
    };
    return map[head] || '';
  }

  // ─────────────────────────────────────────────────────────
  // 2. APPLY TAB KE UI (Hash -> UI)
  // ─────────────────────────────────────────────────────────
  function applyTabToUI(tab) {
    if (!tab || tab === 'login' || tab === 'claim') return;

    // Cara 1: Pakai hook React (kalau tersedia)
    if (typeof root.__SDLG_APPLY_ROUTE === 'function') {
      root.__SDLG_APPLY_ROUTE(tab);
      return;
    }

    // Cara 2: Simulasi klik tombol nav (fallback)
    var labels = {
      dashboard: /^overview/i, list: /^claims/i, paste: /new claim/i,
      sdlginput: /sdlg input/i, masters: /master data/i, quality: /data quality/i, unit360: /unit 360/i
    };
    var re = labels[tab];
    if (!re) return;

    var btns = document.querySelectorAll('button.nav-btn');
    for (var i = 0; i < btns.length; i++) {
      var text = String(btns[i].textContent || '').trim();
      if (re.test(text)) {
        btns[i].click();
        return;
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. SYNC ENGINE
  // ─────────────────────────────────────────────────────────
  function syncHashToUI() {
    if (isApplying) return;
    
    var currentHash = String(root.location.hash || '');
    if (currentHash === lastHash) return; // Gak ada perubahan
    lastHash = currentHash;

    // Kalau lagi buka detail klaim, jangan sentuh nav bar
    if (isClaimDetailHash(currentHash)) return;

    var tab = getTabFromHash();
    if (!tab) return;

    isApplying = true;
    try {
      applyTabToUI(tab);
    } catch (e) {
      console.warn('[SDLG Bridge] Gagal apply tab:', e);
    } finally {
      // Beri waktu 100ms biar React selesai render
      setTimeout(function () { isApplying = false; }, 100);
    }
  }

  function syncUIToHash(tab) {
    if (isApplying) return;

    // Pakai router (lebih stabil)
    if (root.SDLGHashRouter && typeof root.SDLGHashRouter.navigate === 'function') {
      root.SDLGHashRouter.navigate(tab);
      return;
    }

    // Fallback manual
    var map = {
      dashboard: '#/overview', list: '#/claims', paste: '#/new-claim',
      sdlginput: '#/sdlg-input', masters: '#/master-data',
      quality: '#/data-quality', unit360: '#/unit360'
    };
    var next = map[tab];
    if (!next || root.location.hash === next) return;

    isApplying = true;
    try {
      root.history.replaceState(null, '', root.location.pathname + root.location.search + next);
    } catch (_) {
      root.location.hash = next.replace(/^#/, '');
    }
    setTimeout(function () { isApplying = false; }, 100);
  }

  // ─────────────────────────────────────────────────────────
  // 4. EVENT LISTENERS
  // ─────────────────────────────────────────────────────────
  function onNavClick(e) {
    var btn = e.target && e.target.closest && e.target.closest('button.nav-btn');
    if (!btn) return;

    var label = String(btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
    var tab = '';
    
    if (/^overview/.test(label)) tab = 'dashboard';
    else if (/^claims/.test(label)) tab = 'list';
    else if (/new claim/.test(label)) tab = 'paste';
    else if (/sdlg input/.test(label)) tab = 'sdlginput';
    else if (/master data/.test(label)) tab = 'masters';
    else if (/data quality/.test(label)) tab = 'quality';
    else if (/unit/.test(label)) tab = 'unit360';

    if (tab) {
      syncUIToHash(tab);
    }
  }

  function boot() {
    // 1. Dengarkan perubahan URL
    root.addEventListener('hashchange', function () {
      // Kasih delay dikit biar React punya waktu internal
      setTimeout(syncHashToUI, 50);
    });

    // 2. Dengarkan sinyal dari Router V3.0
    root.addEventListener('sdlg-route-changed', function () {
      syncHashToUI();
    });

    // 3. Dengarkan klik manual user
    document.addEventListener('click', onNavClick, false);

    // 4. Initial Sync (pas web pertama kebuka)
    setTimeout(syncHashToUI, 250);
  }

  // ─────────────────────────────────────────────────────────
  // 5. INIT & PUBLIC API
  // ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  root.SDLGHashTabBridge = Object.freeze({
    version: '3.0.0',
    apply: syncHashToUI,
    setHashFromTab: syncUIToHash
  });

})(typeof window !== 'undefined' ? window : this);