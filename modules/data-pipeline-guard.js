/**
 * SDLG Data Pipeline Guard — V2.0 (Smart Health Monitor)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ SMART NOTIFICATION: Pakai SDLGNotify (bukan banner norak lagi).
 * ✅ RLS DIAGNOSTICS: Deteksi kalau error-nya karena Row Level Security.
 * ✅ SMART POLLING: Nunggu client siap tanpa setTimeout kaku.
 * ✅ SAFE TOKEN CHECK: Cek localStorage lebih cepat & aman.
 * ✅ SELF-HEALING: Auto refresh session kalau expired.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_DATA_PIPELINE_GUARD_V2__) return;
  root.__SDLG_DATA_PIPELINE_GUARD_V2__ = true;
  root.__SDLG_DATA_PIPELINE_GUARD__ = true; // Backward compatibility

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES & LOGGING
  // ─────────────────────────────────────────────────────────
  function log(msg, data) { console.log('[SDLG Pipeline] ' + msg, data || ''); }
  function warn(msg, data) { console.warn('[SDLG Pipeline] ' + msg, data || ''); }
  function err(msg, data) { console.error('[SDLG Pipeline] ' + msg, data || ''); }

  function notify(type, title, msg) {
    if (root.SDLGNotify && root.SDLGNotify[type]) {
      root.SDLGNotify[type](title, msg);
    } else {
      // Fallback kalau SDLGNotify belum siap
      if (type === 'error') err(title, msg);
      else log(title, msg);
    }
  }

  function getClient() {
    try {
      if (typeof root.getSdlgSupabase === 'function') {
        var c = root.getSdlgSupabase();
        if (c) return c;
      }
    } catch (_) {}
    if (root.sdlgSupabase && typeof root.sdlgSupabase.from === 'function') return root.sdlgSupabase;
    if (root.supabaseClient && typeof root.supabaseClient.from === 'function') return root.supabaseClient;
    return null;
  }

  function waitForClient(maxMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function check() {
        var c = getClient();
        if (c) return resolve(c);
        if (Date.now() - start > maxMs) return reject(new Error('Supabase client timeout'));
        setTimeout(check, 150);
      })();
    });
  }

  function isLoginPage() {
    try {
      return !!document.querySelector('main.login-screen, .login-screen, #login-screen');
    } catch (_) { return false; }
  }

  // ─────────────────────────────────────────────────────────
  // 2. SESSION RECOVERY (Self-Healing)
  // ─────────────────────────────────────────────────────────
  function hasStoredTokenHint() {
    try {
      if (typeof localStorage === 'undefined') return false;
      // Cek keys yang umum dipakai Supabase auth
      return Object.keys(localStorage).some(function (k) {
        return /sb-.*-auth-token/i.test(k);
      });
    } catch (_) { return false; }
  }

  async function recoverSession(supabase) {
    try {
      var res = await supabase.auth.getSession();
      var session = res && res.data ? res.data.session : null;
      if (session && session.access_token) return session;

      if (!hasStoredTokenHint()) return null;

      log('Token ditemukan tapi session kosong — mencoba refresh...');
      var refreshed = await supabase.auth.refreshSession();
      session = refreshed && refreshed.data ? refreshed.data.session : null;
      
      if (session && session.access_token) {
        log('Session berhasil dipulihkan via refreshSession.');
        return session;
      }
    } catch (e) {
      warn('Gagal recover session:', e);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────
  // 3. FETCH PROBE (Dengan Diagnostik RLS)
  // ─────────────────────────────────────────────────────────
  async function fetchClaimsProbe(limit) {
    limit = limit || 5;
    var supabase;
    
    try {
      supabase = await waitForClient(10000);
    } catch (e) {
      return { ok: false, reason: 'NO_CLIENT', message: 'Supabase client tidak ditemukan.' };
    }

    var session = await recoverSession(supabase);
    if (!session || !session.access_token) {
      return { ok: false, reason: 'NOT_AUTHENTICATED', message: 'User belum login (session kosong).' };
    }

    try {
      var result = await supabase
        .from('claims')
        .select('claim_id')
        .is('archived_at', null)
        .limit(limit);

      if (result.error) {
        var code = result.error.code;
        var msg = result.error.message;
        
        // Diagnostik Khusus RLS (Row Level Security)
        if (code === '42501' || /row-level security/i.test(msg)) {
          return { 
            ok: false, 
            reason: 'RLS_BLOCKED', 
            message: 'Akses ditolak oleh RLS Supabase. Pastikan policy tabel "claims" sudah benar untuk user ini.' 
          };
        }
        
        return { ok: false, reason: 'FETCH_ERROR', message: msg, code: code };
      }

      var rows = Array.isArray(result.data) ? result.data : [];
      if (rows.length === 0) {
        return { ok: true, reason: 'EMPTY', message: 'Query OK, tapi 0 baris data.', rows: [] };
      }

      return { ok: true, reason: 'DATA', message: 'ok', rows: rows };

    } catch (e) {
      return { ok: false, reason: 'FETCH_THROW', message: String(e && e.message || e) };
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. ORCHESTRATOR DIAGNOSTICS
  // ─────────────────────────────────────────────────────────
  async function runDiagnostics() {
    var probe = await fetchClaimsProbe(5);

    if (probe.reason === 'NOT_AUTHENTICATED') {
      if (!isLoginPage()) {
        notify('error', 'Sesi Habis', 'Belum login. Silakan login ulang untuk mengakses data.');
      }
    } 
    else if (probe.reason === 'RLS_BLOCKED') {
      notify('error', 'Akses Diblokir', probe.message);
    } 
    else if (probe.reason === 'FETCH_ERROR' || probe.reason === 'FETCH_THROW' || probe.reason === 'NO_CLIENT') {
      notify('error', 'Gagal Fetch Data', probe.message);
    } 
    else if (probe.reason === 'EMPTY') {
      notify('warning', 'Data Kosong', 'Koneksi sukses, tapi belum ada data claims.');
    } 
    else if (probe.reason === 'DATA') {
      // Silent success (gak perlu munculin notif tiap load)
      log('✅ Koneksi Database Sehat — ' + probe.rows.length + ' data terbaca.');
    }

    return probe;
  }

  // ─────────────────────────────────────────────────────────
  // 5. UTILITY EXPORT (Bawaan lu yang tetap dipertahankan)
  // ─────────────────────────────────────────────────────────
  root.SDLGDisplayValue = function SDLGDisplayValue(value, emptyText) {
    emptyText = emptyText == null ? '—' : emptyText;
    if (value == null) return emptyText;
    if (typeof value === 'string' && value.trim() === '') return emptyText;
    if (Array.isArray(value) && value.length === 0) return emptyText;
    return value;
  };

  // ─────────────────────────────────────────────────────────
  // 6. PUBLIC API & BOOT
  // ─────────────────────────────────────────────────────────
  root.SDLGDataPipeline = Object.freeze({
    version: '2.0.0',
    getClient: getClient,
    recoverSession: recoverSession,
    fetchClaimsProbe: fetchClaimsProbe,
    runDiagnostics: runDiagnostics
  });

  // Jalanin otomatis setelah halaman siap
  function boot() {
    setTimeout(function () {
      runDiagnostics().catch(function (e) { err('Diagnostics failed:', e); });
    }, 500); // Delay dikit biar React & Supabase sempet inisialisasi
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})(typeof window !== 'undefined' ? window : globalThis);