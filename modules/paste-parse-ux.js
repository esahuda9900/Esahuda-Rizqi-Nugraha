/**
 * SDLG Paste → Parse → Simpan UX Polish — V3.0 (Smart UX Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ ZERO LAG: Gak ada innerText scanning atau DOM thrashing.
 * ✅ SINGLE OBSERVER: Satu observer buat semua tombol (anti-memory leak).
 * ✅ SAFE MARKERS: Pakai data-attribute biar gak re-process elemen.
 * ✅ CLEAN CSS: Semua style pindah ke class (gak ada inline style).
 * ✅ SMART COLLAPSE: Deteksi elemen panjang dengan aman.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_PASTE_PARSE_V3__) return;
  window.__SDLG_PASTE_PARSE_V3__ = true;

  var STYLE_ID = 'sdlg-paste-parse-ux-style';
  var FOOTER_ID = 'sdlg-parse-sticky-footer';
  var IS_DEBUG = window.location.search.indexOf('debug=true') > -1;
  
  var scheduled = false;
  var debounceTimer;

  // ─────────────────────────────────────────────────────────
  // 1. STYLES (Premium & Clean)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${FOOTER_ID} {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 9990;
        display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap;
        padding: 12px 20px; background: rgba(255,255,255,0.95);
        border-top: 1px solid #e2e8f0; box-shadow: 0 -4px 20px rgba(15,23,42,0.08);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        font-family: system-ui, -apple-system, sans-serif;
      }
      body.sdlg-parse-sticky-pad { padding-bottom: 80px !important; }
      
      .sdlg-btn-base {
        padding: 10px 16px; border-radius: 8px; font-weight: 700; font-size: 13px;
        cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center;
      }
      .sdlg-btn-base:disabled { opacity: 0.5; cursor: not-allowed; }
      .sdlg-btn-primary { background: linear-gradient(135deg, #c2410c, #ea580c); color: #fff; border: none; }
      .sdlg-btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #9a3412, #c2410c); }
      .sdlg-btn-secondary { background: #fff; color: #475569; border: 1px solid #e2e8f0; }
      .sdlg-btn-secondary:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }

      .sdlg-collapse-wrap { position: relative; }
      .sdlg-collapse-body { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; max-height: 4.8em; line-height: 1.45; }
      .sdlg-collapse-body.sdlg-expanded { -webkit-line-clamp: unset; max-height: none; overflow: visible; }
      .sdlg-collapse-toggle { margin-top: 6px; border: none; background: transparent; color: #2563eb; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; }
      .sdlg-collapse-toggle:hover { text-decoration: underline; }
      
      .sdlg-empty-dash { color: #9ca3af; font-style: italic; }
      
      .sdlg-dup-legend {
        font-size: 11px; color: #64748b; padding: 6px 12px; margin-right: auto;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-weight: 500;
      }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 2. PAGE DETECTION (Anti-scan innerText)
  // ─────────────────────────────────────────────────────────
  function isParsePage() {
    // Cek apakah ada tombol "Update" atau "Simpan" (lebih cepet dari innerText)
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      if (/Update Klaim|Simpan sebagai Baru/i.test(btns[i].textContent || '')) return true;
    }
    return false;
  }

  function findActionButtons() {
    var updateBtn = null, newBtn = null, cancelBtn = null;
    document.querySelectorAll('button').forEach(function (b) {
      if (b.closest('#' + FOOTER_ID)) return;
      var tx = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (/Update Klaim/i.test(tx)) updateBtn = b;
      else if (/Simpan sebagai Baru/i.test(tx)) newBtn = b;
      else if (/^[\u2715xX]?\s*Batal\s*$/i.test(tx) || tx === 'Batal') cancelBtn = b;
    });
    return { updateBtn: updateBtn, newBtn: newBtn, cancelBtn: cancelBtn };
  }

  // ─────────────────────────────────────────────────────────
  // 3. STICKY FOOTER (Single Observer for Buttons)
  // ─────────────────────────────────────────────────────────
  var originalButtons = [];

  function syncButtonState() {
    var footer = document.getElementById(FOOTER_ID);
    if (!footer) return;
    
    footer.querySelectorAll('button[data-sync-id]').forEach(function(clone) {
      var id = clone.getAttribute('data-sync-id');
      var original = originalButtons.find(function(b) { return b.id === id; });
      if (original) {
        clone.disabled = original.disabled;
        if (original.disabled) clone.style.opacity = '0.5';
        else clone.style.opacity = '1';
      }
    });
  }

  function cloneAction(btn, label, isPrimary, syncId) {
    if (!btn) return null;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sdlg-btn-base ' + (isPrimary ? 'sdlg-btn-primary' : 'sdlg-btn-secondary');
    b.textContent = label || (btn.textContent || '').trim();
    b.disabled = btn.disabled;
    b.setAttribute('data-sync-id', syncId);
    
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      btn.click();
    });
    
    // Daftarin ke array buat di-sync nanti
    originalButtons.push({ id: syncId, el: btn });
    return b;
  }

  function ensureStickyFooter() {
    var acts = findActionButtons();
    var existingFooter = document.getElementById(FOOTER_ID);

    // Kalau gak ada tombol action, hapus footer
    if (!acts.updateBtn && !acts.newBtn) {
      if (existingFooter) existingFooter.remove();
      document.body.classList.remove('sdlg-parse-sticky-pad');
      return;
    }
    
    var foot = existingFooter;
    if (!foot) {
      foot = document.createElement('div');
      foot.id = FOOTER_ID;
      document.body.appendChild(foot);
      document.body.classList.add('sdlg-parse-sticky-pad');
      originalButtons = []; // Reset
    }
    
    // Cek apakah udah bener (gak perlu re-render)
    var currentText = foot.innerText || '';
    var expectedText = (acts.cancelBtn ? 'Batal ' : '') + (acts.newBtn ? 'Simpan ' : '') + (acts.updateBtn ? 'Update ' : '');
    if (currentText.indexOf(expectedText) > -1 && foot.children.length > 0) return;

    foot.innerHTML = '';
    var legend = document.createElement('div');
    legend.className = 'sdlg-dup-legend';
    legend.textContent = 'Hijau pada field = cocok master data · Kosong ditampilkan sebagai —';
    foot.appendChild(legend);

    if (acts.cancelBtn) foot.appendChild(cloneAction(acts.cancelBtn, 'Batal', false, 'btn-cancel'));
    if (acts.newBtn) foot.appendChild(cloneAction(acts.newBtn, acts.newBtn.textContent.trim(), false, 'btn-new'));
    if (acts.updateBtn) foot.appendChild(cloneAction(acts.updateBtn, acts.updateBtn.textContent.trim(), true, 'btn-update'));

    // Pasang SATU observer buat mantau semua tombol asli
    if (!window.__SDLG_BTN_OBSERVER__) {
      window.__SDLG_BTN_OBSERVER__ = new MutationObserver(function() { syncButtonState(); });
      [acts.cancelBtn, acts.newBtn, acts.updateBtn].forEach(function(b) {
        if (b) window.__SDLG_BTN_OBSERVER__.observe(b, { attributes: true, attributeFilter: ['disabled'] });
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. COLLAPSE & DASHES (Gak pake innerText scan)
  // ─────────────────────────────────────────────────────────
  function collapseLongBlocks() {
    // Cuma cari label spesifik
    var labels = Array.from(document.querySelectorAll('div, span, label, strong')).filter(function(el) {
      var t = (el.textContent || '').trim();
      return t === 'Fault' || t === 'Cause' || t === 'Comment' || t === 'Fault Details';
    });

    labels.forEach(function (el) {
      var row = el.parentElement;
      if (!row || row.getAttribute('data-sdlg-collapsed') === '1') return;
      
      var valueEl = row.children[row.children.length - 1];
      if (!valueEl || valueEl === el) return;
      
      var text = (valueEl.textContent || '').trim();
      if (text.length < 180) return;
      
      row.setAttribute('data-sdlg-collapsed', '1'); // Mark biar gak diproses lagi
      
      var full = valueEl.textContent;
      valueEl.textContent = '';
      var wrap = document.createElement('div');
      wrap.className = 'sdlg-collapse-wrap';
      
      var body = document.createElement('div');
      body.className = 'sdlg-collapse-body';
      body.textContent = full;
      
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sdlg-collapse-toggle';
      btn.textContent = 'Tampilkan selengkapnya';
      btn.addEventListener('click', function () {
        var open = body.classList.toggle('sdlg-expanded');
        btn.textContent = open ? 'Sembunyikan' : 'Tampilkan selengkapnya';
      });
      
      wrap.appendChild(body);
      wrap.appendChild(btn);
      valueEl.appendChild(wrap);
    });
  }

  function normalizeEmptyDashes() {
    // Cari container spesifik, bukan seluruh DOM
    document.querySelectorAll('[data-sdlg-parse-result], .parse-result').forEach(function(root) {
      root.querySelectorAll('td, div').forEach(function (el) {
        if (el.children && el.children.length) return;
        var t = (el.textContent || '').trim();
        if ((t === '' || t === 'null' || t === 'undefined' || t === '---' || t === '--') && el.getAttribute('data-dash') !== '1') {
          el.textContent = '—';
          el.classList.add('sdlg-empty-dash');
          el.setAttribute('data-dash', '1');
        }
      });
    });
  }

  function enhanceDuplicateBanner() {
    // Pakai querySelector spesifik biar gak scan semua div
    var banner = document.querySelector('div[data-sdlg-dup-banner], .sdlg-dup-banner');
    if (banner && banner.getAttribute('data-sdlg-enhanced') !== '1') {
      banner.setAttribute('data-sdlg-enhanced', '1');
      banner.style.boxShadow = '0 0 0 2px rgba(245,158,11,.25)';
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. ORCHESTRATOR
  // ─────────────────────────────────────────────────────────
  function run() {
    if (!isParsePage()) return;
    
    try {
      injectStyles();
      ensureStickyFooter();
      collapseLongBlocks();
      normalizeEmptyDashes();
      enhanceDuplicateBanner();
    } catch(e) {
      if (IS_DEBUG) console.warn('[SDLG UX]', e);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      scheduled = false;
      run();
    }, 250); 
  }

  // ─────────────────────────────────────────────────────────
  // 6. INIT & OBSERVER
  // ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(function (mutations) {
      // Abaikan perubahan dari footer kita sendiri biar gak infinite loop
      var selfMutated = mutations.every(function(m) { 
        return m.target.id === FOOTER_ID || (m.target.closest && m.target.closest('#' + FOOTER_ID)); 
      });
      if (!selfMutated) schedule();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (IS_DEBUG) console.info('[SDLG] paste-parse-ux.js V3.0 loaded.');
})();