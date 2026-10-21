/**
 * SDLG Claim Detail Layout Fix — V2.0 (Smart & Zero-Lag)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO LAG: Hapus setInterval, ganti jadi Event-Driven.
 * ✅ SMART OBSERVER: Gak ngawasin perubahan CSS (anti-loop).
 * ✅ DEBOUNCE: Nunggu DOM stabil 150ms baru eksekusi.
 * ✅ SAFE INJECTION: CSS di-load sekali aja di awal.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';
  if (window.__SDLG_CLAIM_DETAIL_LAYOUT_FIX_V2__) return;
  window.__SDLG_CLAIM_DETAIL_LAYOUT_FIX_V2__ = true;
  
  // Tetap pakai flag lama biar file lain gak bingung
  window.__SDLG_CLAIM_DETAIL_LAYOUT_FIX__ = true;

  var HREF = './styles/sdlg-claim-detail-clean-v2.css?v=3';
  var debounceTimer = null;

  // ─────────────────────────────────────────────────────────
  // 1. CSS INJECTION (Jalan sekali aja di awal)
  // ─────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // 2. LOGIC: Nyalain Menu "Claims"
  // ─────────────────────────────────────────────────────────
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
        if (!b.classList.contains('active')) {
          b.classList.add('active');
          try { b.setAttribute('aria-current', 'page'); } catch (_) {}
        }
      } else if (/unit\s*360|\b360\b|quality|master|sdlg input|overview|new claim/.test(label)) {
        if (b.classList.contains('active')) {
          b.classList.remove('active');
          try { b.removeAttribute('aria-current'); } catch (_) {}
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. ORCHESTRATOR (Debounced Tick)
  // ─────────────────────────────────────────────────────────
  function tick() {
    try {
      ensureCss();
      fixNavHighlight();
    } catch (_) {}
  }

  // Fungsi debounce: Nunggu 150ms baru jalan setelah perubahan terakhir
  function scheduleTick() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tick, 150);
  }

  // ─────────────────────────────────────────────────────────
  // 4. SMART TRIGGERS (Tanpa setInterval!)
  // ─────────────────────────────────────────────────────────
  
  // Jalan pertama kali pas di-load
  tick();

  // Jalan setiap ada klik (misal user pindah menu/detail)
  document.addEventListener('click', scheduleTick, true);

  // Observer pintar: Cuma ngecek kalau ada elemen baru masuk, gak ngecek atribut class (biar gak loop)
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(scheduleTick);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Pengaman: Jalan sekali lagi setelah 1 detik (jaga-jaga kalau React telat render)
  setTimeout(tick, 1000);

})();