/**
 * SDLG Feedback Person Fix — V2.0 (Smart Fallback Guardian)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ SMART WATCHDOG: Aktif ngecek kalau form kosong (2 detik).
 * ✅ ZERO COST: Diem aja kalau sistem utama (SDLGHydrate) jalan.
 * ✅ AUTO-SANITIZE: Bersihin teks "Technician :" dari nama.
 * ✅ VISUAL CUE: Highlight kuning pas berhasil auto-fill.
 * ✅ API EXPORT: Bisa dipanggil manual kapan aja.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_FB_FIX_V2__) return;
  root.__SDLG_FB_FIX_V2__ = true;
  root.__SDLG_FB_FIX_V15__ = true; // Backward compatibility

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES
  // ─────────────────────────────────────────────────────────
  function clean(val) {
    return val == null ? '' : String(val).replace(/\s+/g, ' ').trim();
  }

  function sanitizeName(raw) {
    var s = clean(raw);
    if (!s) return '';
    // Hapus prefix "Technician", "Teknisi", "Feedback Person", dll
    return s.replace(/^(?:technician|teknisi|feedback\s*person|mekanik|mechanic)\s*[\:\-–—]\s*/i, '').trim();
  }

  function getClient() {
    if (typeof root.getSdlgSupabase === 'function') return root.getSdlgSupabase();
    return root.sdlgSupabase || root.supabaseClient || null;
  }

  // Cari ID klaim dari URL (misal: ?claim_id=0256-2026-SDLG-PFR)
  function getClaimId() {
    try {
      var q = new URLSearchParams(location.search || '');
      return q.get('claim_id') || q.get('claimId') || q.get('id') || '';
    } catch (_) { return ''; }
  }

  // ─────────────────────────────────────────────────────────
  // 2. DOM FINDERS & FILLERS
  // ─────────────────────────────────────────────────────────
  function findFeedbackInput() {
    // Cari lewat label text
    var labels = document.querySelectorAll('label, .sdlg-portal-field label, [data-sdlg-field]');
    for (var i = 0; i < labels.length; i++) {
      var txt = clean(labels[i].textContent).toLowerCase();
      if (/feedback\s*person|person\s*feedback|nama\s*teknisi|technician\s*name/i.test(txt)) {
        var forId = labels[i].getAttribute('for');
        if (forId) {
          var el = document.getElementById(forId);
          if (el && el.matches('input,select,textarea')) return el;
        }
        var wrap = labels[i].closest('.sdlg-portal-field, .sdlg-field-wrap') || labels[i].parentElement;
        var inner = wrap ? wrap.querySelector('input, select, textarea') : null;
        if (inner) return inner;
      }
    }
    // Fallback: Cari lewat name/id attribute
    return document.querySelector('input[name="feedback_person"], input[id="feedback_person"], [data-sdlg-field="Feedback Person"] input');
  }

  function fillInput(el, value) {
    if (!el || !value) return false;
    
    // Cek dulu kalau udah ada isinya (jangan nimpa ketikan user)
    if (el.value && el.value.trim().length > 0) return false;

    el.value = value;
    el.setAttribute('value', value);

    // Highlight visual (efek kuning sekilas)
    var prevBg = el.style.transition;
    var prevColor = el.style.backgroundColor;
    el.style.transition = 'background-color 0.5s ease';
    el.style.backgroundColor = '#fef9c3'; // Kuning soft
    setTimeout(function () {
      el.style.backgroundColor = prevColor || '';
    }, 1500);

    // Pancing event biar React nganggep ini perubahan resmi
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // 3. CORE ORCHESTRATOR
  // ─────────────────────────────────────────────────────────
  async function runFallback() {
    var input = findFeedbackInput();
    if (!input) return; // Bukan di halaman input, skip.

    // Kalau udah keisi, gak usah dilanjutin
    if (input.value && input.value.trim().length > 0) return;

    var claimId = getClaimId();
    if (!claimId) return; // Gak ada ID klaim, skip.

    var client = getClient();
    if (!client) return;

    try {
      // Tarik data dari database
      var res = await client.from('claims').select('technical_personnel').eq('claim_id', claimId).maybeSingle();
      if (res.error || !res.data) return;

      var rawName = res.data.technical_personnel;
      var cleanName = sanitizeName(rawName);

      if (cleanName) {
        var success = fillInput(input, cleanName);
        if (success && root.SDLGNotify) {
          root.SDLGNotify.info('Auto-fill', 'Feedback Person berhasil diisi otomatis dari database.');
        }
      }
    } catch (err) {
      console.warn('[SDLG FB Fix] Gagal ambil data:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. WATCHDOG & INIT
  // ─────────────────────────────────────────────────────────
  function run() {
    // Kalau sistem hydrate utama jalan, kita cuma ngecek 1x. 
    // Kalau dia berhasil ngisi, kita batalin. Kalau dia gagal, kita gas.
    if (root.SDLGInputHydrate && !root.__SDLG_DISABLE_FB_FIX_WRITES__) {
      // Tunggu sistem utama jalan dulu (kasih delay 2 detik)
      setTimeout(function () {
        var input = findFeedbackInput();
        // Kalau setelah 2 detik form MASIH kosong, baru kita isi (Fallback)
        if (input && (!input.value || input.value.trim() === '')) {
          runFallback();
        }
      }, 2000);
    } else {
      // Kalau sistem utama gak ada (misal versi lama), langsung jalan aja
      setTimeout(runFallback, 500);
    }
  }

  // Jalanin pas DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  // Export API
  root.SDLGFeedbackPersonFix = Object.freeze({
    version: '2.0.0',
    run: run,
    runFallback: runFallback,
    sanitizeName: sanitizeName
  });

})(typeof window !== 'undefined' ? window : globalThis);