/**
 * SDLG Input Empty-State Guard — V2.0 (Smart Sentinel)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO INTERVAL: Gak pakai setInterval (hemat baterai).
 * ✅ SMART OBSERVER: Cuma ngawasin .page dengan debounce.
 * ✅ DARK MODE: Kotak panduan support tema gelap.
 * ✅ XSS PROTECTED: Claim ID di-escape.
 * ✅ ROUTER INTEGRATED: Tombol langsung ke router.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_INPUT_EMPTY_GUARD_V2__) return;
  root.__SDLG_INPUT_EMPTY_GUARD_V2__ = true;
  root.__SDLG_INPUT_EMPTY_GUARD_V1__ = true; // Backward compat

  var GUARD_ID = 'sdlg-input-empty-guard';
  var STYLE_ID = 'sdlg-input-empty-guard-style';
  var OBSERVER_DELAY = 300;   // Debounce DOM changes
  var RENDER_DELAY = 1500;    // Waktu tunggu React render form

  var lastCheckTime = 0;
  var checkTimer = null;

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES
  // ─────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isSdlgInputTab() {
    var h = String(root.location.hash || '');
    return /#\/?(sdlg-input|sdlginput)/i.test(h);
  }

  function hasHelperContent() {
    // Cek elemen utama (paling cepat)
    if (document.querySelector('[data-sdlg-input-helper] [data-sdlg-field], [data-sdlg-input-helper] [data-sdlg-copy]')) return true;
    if (document.querySelector('.page input[placeholder*="Cari Claim"], .page select[size]')) return true;
    if (document.querySelector('.page #sdlg_serviceType, .page [data-label="Service Type"]')) return true;
    
    // Fallback: cek title + input apapun di dalam .page
    var page = document.querySelector('.page');
    if (!page) return false;
    
    var title = page.querySelector('.page-title');
    if (title && /Input Helper/i.test(title.textContent || '')) {
      if (page.querySelector('select, input[type="text"], textarea, [data-sdlg-field]')) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────
  // 2. STYLES (Dark Mode Ready)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${GUARD_ID} {
        max-width: 640px; margin: 24px auto;
        padding: 24px 28px;
        border: 1px solid #e2e8f0; border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 10px 30px -10px rgba(15,23,42,0.1);
        font-family: system-ui, -apple-system, sans-serif;
        animation: sdlgGuardFadeIn 0.4s ease-out;
      }
      @keyframes sdlgGuardFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      
      @media (prefers-color-scheme: dark) {
        #${GUARD_ID} {
          background: #111a2e; border-color: #1e2a45;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.4);
        }
      }
      
      #${GUARD_ID} .sg-badge {
        display: inline-block; font-size: 10px; font-weight: 800;
        color: #2f5bff; background: rgba(47,91,255,0.1);
        letter-spacing: 0.08em; text-transform: uppercase;
        padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
      }
      #${GUARD_ID} .sg-title {
        font-size: 22px; font-weight: 800; color: #0f172a;
        margin-bottom: 10px; letter-spacing: -0.02em;
      }
      #${GUARD_ID} .sg-desc {
        font-size: 14px; color: #64748b; line-height: 1.6;
        margin: 0 0 20px;
      }
      #${GUARD_ID} .sg-desc b { color: #0f172a; }
      #${GUARD_ID} .sg-code {
        font-family: monospace; background: rgba(15,23,42,0.06);
        padding: 2px 6px; border-radius: 4px; font-weight: 700;
      }
      #${GUARD_ID} .sg-actions {
        display: flex; flex-wrap: wrap; gap: 10px;
      }
      #${GUARD_ID} button {
        font: inherit; font-size: 13px; font-weight: 700;
        padding: 10px 18px; border-radius: 10px; cursor: pointer;
        transition: all 0.2s; border: 1px solid transparent;
      }
      #${GUARD_ID} .sg-btn-primary {
        background: #2f5bff; color: #ffffff;
      }
      #${GUARD_ID} .sg-btn-primary:hover { background: #1e40af; }
      #${GUARD_ID} .sg-btn-secondary {
        background: transparent; color: #0f172a; border-color: #cbd5e1;
      }
      #${GUARD_ID} .sg-btn-secondary:hover { background: #f8fafc; }
      
      @media (prefers-color-scheme: dark) {
        #${GUARD_ID} .sg-title { color: #f8fafc; }
        #${GUARD_ID} .sg-desc { color: #94a3b8; }
        #${GUARD_ID} .sg-desc b { color: #f8fafc; }
        #${GUARD_ID} .sg-code { background: rgba(255,255,255,0.1); color: #e2e8f0; }
        #${GUARD_ID} .sg-btn-secondary { color: #f8fafc; border-color: #334155; }
        #${GUARD_ID} .sg-btn-secondary:hover { background: #1e293b; }
      }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 3. GUARD INJECTION
  // ─────────────────────────────────────────────────────────
  function removeGuard() {
    var g = document.getElementById(GUARD_ID);
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }

  function injectGuard() {
    // Kalau bukan tab SDLG Input, atau form-nya udah muncul → bersihin
    if (!isSdlgInputTab() || hasHelperContent()) {
      removeGuard();
      return;
    }

    var page = document.querySelector('.page') || document.querySelector('#root') || document.body;
    if (!page) return;
    
    // Kalau udah ada, jangan bikin lagi
    if (document.getElementById(GUARD_ID)) return;

    injectStyles();

    var claimId = '';
    try {
      claimId = root.localStorage.getItem('sdlg-warranty:last-sdlginput-claim:v2') ||
                root.localStorage.getItem('sdlg-warranty:last-claim:v2') || '';
    } catch (_) {}

    var box = document.createElement('div');
    box.id = GUARD_ID;
    box.setAttribute('role', 'status');
    
    var safeClaimId = escapeHtml(claimId);
    
    var descHtml = claimId
      ? ('Klaim <span class="sg-code">' + safeClaimId + '</span> belum termuat. Buka tab <b>Claims</b>, klik klaim tersebut, lalu tekan <b>SDLG Input</b> lagi.')
      : 'Belum ada klaim yang dipilih. Buka tab <b>Claims</b> &rarr; klik satu klaim &rarr; tekan tombol <b>SDLG Input</b>.';

    box.innerHTML = `
      <div class="sg-badge">SDLG Dealer Portal</div>
      <div class="sg-title">SDLG Input Helper</div>
      <p class="sg-desc">${descHtml}</p>
      <div class="sg-actions">
        <button type="button" class="sg-btn-primary" data-go-claims>Buka Daftar Claims</button>
        <button type="button" class="sg-btn-secondary" data-reload>Muat Ulang</button>
      </div>
    `;

    page.appendChild(box);

    // Event: Buka Claims
    var goBtn = box.querySelector('[data-go-claims]');
    if (goBtn) {
      goBtn.addEventListener('click', function () {
        if (root.SDLGHashRouter && root.SDLGHashRouter.navigate) {
          root.SDLGHashRouter.navigate('claims');
        } else {
          root.location.hash = '#/claims';
        }
      });
    }

    // Event: Reload
    var reloadBtn = box.querySelector('[data-reload]');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', function () {
        root.location.reload();
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. SMART SCHEDULER
  // ─────────────────────────────────────────────────────────
  function scheduleCheck(force) {
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = setTimeout(function () {
      lastCheckTime = Date.now();
      try { injectGuard(); } catch (e) { console.warn('[SDLG Guard]', e); }
    }, force ? 0 : OBSERVER_DELAY);
  }

  // Cek pertama (kasih delay 1.5 detik biar React sempet render)
  function initialCheck() {
    setTimeout(function () {
      try { injectGuard(); } catch (_) {}
    }, RENDER_DELAY);
  }

  // ─────────────────────────────────────────────────────────
  // 5. EVENT LISTENERS
  // ─────────────────────────────────────────────────────────
  
  // A. Hash berubah (via Router)
  root.addEventListener('hashchange', function () {
    // Hapus guard dulu (biar gak nyangkut pas ganti tab)
    removeGuard();
    scheduleCheck(true);
    initialCheck();
  });

  root.addEventListener('sdlg-route-changed', function () {
    removeGuard();
    scheduleCheck(true);
    initialCheck();
  });

  // B. Mutation Observer (Cuma ngawasin .page)
  function setupObserver() {
    if (!root.MutationObserver || !document.body) return;
    
    var page = document.querySelector('.page') || document.body;
    var obs = new MutationObserver(function () {
      scheduleCheck(false);
    });
    
    obs.observe(page, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────
  // 6. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    setupObserver();
    initialCheck();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})(typeof window !== 'undefined' ? window : globalThis);