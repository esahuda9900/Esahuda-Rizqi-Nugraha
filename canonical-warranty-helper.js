(function () {
  'use strict';

  // Canonical portal helper v1.4.1 (Bulletproof Edition)
  // Fixes: Restored full select for warranty panel, added Supabase abortSignal fallback, React DOM protection.
  
  var IS_DEBUG = window.location.search.indexOf('debug=true') > -1;
  var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;
  var scheduled = false;
  var lastAppliedKey = '';
  var applying = false;
  var activeAbortController = null;

  function log() {
    if (IS_DEBUG) console.info.apply(console, ['[SDLG Helper v1.4.1]', ...arguments]);
  }

  // 1. CSS Injection untuk Notifikasi (Aman dari React)
  function injectStyles() {
    if (document.getElementById('sdlg-toast-styles')) return;
    var style = document.createElement('style');
    style.id = 'sdlg-toast-styles';
    style.textContent = `
      .sdlg-toast {
        position: fixed; bottom: 20px; right: 20px; padding: 12px 20px;
        border-radius: 6px; color: white; font-family: sans-serif;
        font-size: 14px; z-index: 99999; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        opacity: 0; transform: translateY(10px); transition: opacity 0.3s, transform 0.3s;
        pointer-events: none; max-width: 300px; word-wrap: break-word;
      }
      .sdlg-toast.show { opacity: 1; transform: translateY(0); }
      .sdlg-toast-success { background-color: #10b981; }
      .sdlg-toast-error { background-color: #ef4444; }
    `;
    document.head.appendChild(style);
  }

  function showToast(message, type) {
    injectStyles();
    var toast = document.createElement('div');
    toast.className = 'sdlg-toast ' + (type === 'error' ? 'sdlg-toast-error' : 'sdlg-toast-success');
    toast.textContent = message;
    
    // Tempel ke body
    document.body.appendChild(toast);
    
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { if (toast) toast.classList.add('show'); });
    });
    
    setTimeout(function() {
      if (toast) toast.classList.remove('show');
      setTimeout(function() { 
        // Cek parentNode untuk mencegah error jika React sudah menghapusnya
        if (toast && toast.parentNode) toast.parentNode.removeChild(toast); 
      }, 300);
    }, 3000);
  }

  // KEMBALIKAN KE DEFAULT ASLI (Agar panel Warranty tidak blank)
  var DEFAULT_CLAIM_SELECT = [
    'claim_id','model','serial_no','customer','repair_method','technical_personnel',
    'causing_part_no','causing_part_desc','failure_part_location','fault_description',
    'cause_analyze','comment','parts','hm_failure','hm_completion','sales_date',
    'failure_date','dealer_repair_date','completion_date','dealer_claim_date',
    'labour_amount','mileage_amount','other_amount','total_amount','mileage_km'
  ].join(',');

  function claimSelect() {
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.CLAIM_SELECT) {
        return window.SDLG_CLAIM_FIELDS.CLAIM_SELECT;
      }
    } catch (_) {}
    return DEFAULT_CLAIM_SELECT;
  }

  function clean(v) { return v == null ? '' : String(v).trim(); }

  function findClaimId() {
    try {
      var h = String(location.hash || '');
      var hm = h.match(/(?:sdlg-input|sdlginput|claims|claim)\/(\d{3,4}-\d{4}-SDLG-PFR)/i);
      if (hm) return clean(hm[1]);
    } catch (_) {}
    try {
      if (window.SDLGInputClaimLock && window.SDLGInputClaimLock.activeClaimId) {
        var locked = window.SDLGInputClaimLock.activeClaimId();
        if (locked) return clean(locked);
      }
    } catch (_) {}
    try {
      if (window.__SDLG_LIVE_CLAIM__ && window.__SDLG_LIVE_CLAIM__.claim_id) {
        var lid = clean(window.__SDLG_LIVE_CLAIM__.claim_id);
        if (RE.test(lid)) return lid;
      }
    } catch (_) {}
    return '';
  }

  function getClient() {
    if (typeof window.getSdlgSupabase === 'function') {
      var c = window.getSdlgSupabase();
      if (c) return c;
    }
    return window.sdlgSupabase || window.supabaseClient || null;
  }

  function isPortalInputPage() {
    try {
      if (document.querySelector('[data-sdlg-input-helper]')) return true;
      if (/sdlg-input|sdlginput/i.test(String(location.hash || ''))) return true;
      if (window.__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__) return true;
      if (window.SDLGInputHydrate) return true;
    } catch (_) {}
    return false;
  }

  // 2. Fitur AbortController + Kompatibilitas Versi Supabase Lama
  async function loadClaim(claimId) {
    var c = getClient();
    if (!c) throw new Error('No Supabase client');
    
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch(_) {}
    }
    activeAbortController = new AbortController();

    var query = c.from('claims')
      .select(claimSelect())
      .eq('claim_id', claimId);

    // Cek apakah Supabase versi ini mendukung abortSignal
    if (typeof query.abortSignal === 'function') {
      query = query.abortSignal(activeAbortController.signal);
    }

    var res = await query.maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }

  async function run() {
    if (scheduled || applying) return;
    if (isPortalInputPage()) return;
    scheduled = true;
    
    try {
      var claimId = findClaimId();
      if (!claimId) return;
      if (lastAppliedKey === claimId) return;
      
      applying = true;
      log('Fetching claim data for:', claimId);
      
      var claim = await loadClaim(claimId);
      
      if (!claim) {
        showToast('Data klaim tidak ditemukan di database', 'error');
        return;
      }
      if (findClaimId() !== claimId) return; 
      
      lastAppliedKey = claimId;
      log('Claim loaded successfully', claim.claim_id);
      
      showToast('✓ Data klaim berhasil dimuat', 'success');

    } catch (err) {
      if (err.name === 'AbortError') {
        log('Fetch aborted because user navigated away.');
        return;
      }
      
      var msg = err && err.message ? err.message : err;
      log('Error:', msg);
      showToast('Gagal memuat data klaim. Cek koneksi.', 'error');
    } finally {
      applying = false;
      scheduled = false;
    }
  }

  function schedule() {
    if (scheduled || applying) return;
    if (isPortalInputPage()) return;
    setTimeout(run, 250);
  }

  window.addEventListener('hashchange', function () { 
    lastAppliedKey = ''; 
    schedule(); 
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  setTimeout(schedule, 800);
})();