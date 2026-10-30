/**
 * SDLG Overview Session Gate — V2.0 (Silent Session Sentinel)
 * 
 * ═══════════════════════════════════════════════════════════
 * STATUS: SILENT (By Design) — No banner. No reload. No blocking.
 * 
 * FILOSOFI:
 * File ini TIDAK mem-block user untuk masuk ke Overview.
 * File ini TIDAK nge-banner error.
 * File ini TIDAK nge-reload halaman.
 * 
 * Session blocking = tanggung jawab SDLGAuthRouteGuard (single source).
 * File ini murni OBSERVER yang bisa ditanya "session valid gak?".
 * 
 * UPGRADE V2.0:
 * ✅ IMMUTABLE: Flag dikunci via Object.defineProperty.
 * ✅ ZERO SIDE-EFFECT: Gak ganggu flow React.
 * ✅ ON-DEMAND: Cek session cuma kalau dipanggil manual.
 * ✅ EVENT EMIT: Notifikasi via sdlg-session-status-changed.
 * ✅ SMART CACHE: Hasil cek disimpen 30 detik (anti spam).
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_OVERVIEW_SESSION_GATE_V2__) return;
  
  // 1. Lock Global Flags (Anti-Overwrite)
  try {
    Object.defineProperty(root, '__SDLG_OVERVIEW_SESSION_GATE_V2__', { value: true, writable: false });
    Object.defineProperty(root, '__SDLG_OVERVIEW_SESSION_GATE_V12__', { value: true, writable: false });
  } catch (_) {
    root.__SDLG_OVERVIEW_SESSION_GATE_V2__ = true;
    root.__SDLG_OVERVIEW_SESSION_GATE_V12__ = true;
  }

  // 2. State (Cached Result)
  var state = {
    lastCheck: 0,
    lastResult: null,
    cacheTtlMs: 30000 // 30 detik cache
  };

  // ─────────────────────────────────────────────────────────
  // 3. CLIENT GETTER
  // ─────────────────────────────────────────────────────────
  function getClient() {
    try {
      if (typeof root.getSdlgSupabase === 'function') {
        var c = root.getSdlgSupabase();
        if (c && c.auth) return c;
      }
    } catch (_) {}
    return root.sdlgSupabase || root.supabaseClient || null;
  }

  // ─────────────────────────────────────────────────────────
  // 4. CORE CHECKER (Pure Observer)
  // ─────────────────────────────────────────────────────────
  /**
   * Cek session user (read-only, no side effects).
   * @param {Object} opts - { force: boolean } buat bypass cache
   * @returns {Promise<{valid: boolean, email: string|null, userId: string|null, reason: string}>}
   */
  async function checkSession(opts) {
    opts = opts || {};
    var now = Date.now();
    
    // Return cache kalau masih fresh
    if (!opts.force && state.lastResult && (now - state.lastCheck) < state.cacheTtlMs) {
      return state.lastResult;
    }
    
    var result = {
      valid: false,
      email: null,
      userId: null,
      reason: 'unknown',
      at: now
    };
    
    try {
      var client = getClient();
      if (!client) {
        result.reason = 'no_client';
      } else if (!client.auth || typeof client.auth.getSession !== 'function') {
        result.reason = 'no_auth_api';
      } else {
        var res = await client.auth.getSession();
        var session = res && res.data ? res.data.session : null;
        
        if (session && session.access_token) {
          var user = session.user || {};
          result.valid = true;
          result.email = user.email || null;
          result.userId = user.id || null;
          result.reason = 'authenticated';
          result.expiresAt = session.expires_at || null;
        } else {
          result.reason = 'no_session';
        }
      }
    } catch (err) {
      result.reason = 'error: ' + (err && err.message ? err.message : String(err));
    }
    
    // Update cache
    state.lastCheck = now;
    state.lastResult = result;
    
    // Emit event untuk modul lain yang peduli
    try {
      root.dispatchEvent(new CustomEvent('sdlg-session-status-changed', {
        detail: result
      }));
    } catch (_) {}
    
    return result;
  }

  // ─────────────────────────────────────────────────────────
  // 5. SYNC HELPER (No Await, Super Cepat)
  // ─────────────────────────────────────────────────────────
  /**
   * Cek apakah ada token di localStorage (sync, super cepat).
   * Cocok buat ngecek "kira-kira user login gak?" tanpa nembak Supabase.
   */
  function hasTokenHint() {
    try {
      if (typeof localStorage === 'undefined') return false;
      return Object.keys(localStorage).some(function (k) {
        return /^sb-.*-auth-token/i.test(k);
      });
    } catch (_) { return false; }
  }

  // ─────────────────────────────────────────────────────────
  // 6. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  var SessionGateAPI = Object.freeze({
    version: '2.0.0',
    disabled: false, // Bukan "disabled" lagi, tapi "passive mode"
    passive: true,   // Gak pernah block, cuma observasi
    
    // Methods
    check: checkSession,
    hasToken: hasTokenHint,
    
    // Utilities
    getLastResult: function () { return state.lastResult; },
    reset: function () {
      state.lastCheck = 0;
      state.lastResult = null;
    },
    setCacheTtl: function (ms) {
      if (typeof ms === 'number' && ms > 0) state.cacheTtlMs = ms;
    },
    
    // Info
    info: function () {
      return {
        version: '2.0.0',
        mode: 'passive',
        description: 'Silent session observer. Never blocks, never banners, never reloads.',
        cacheAge: state.lastResult ? (Date.now() - state.lastCheck) + 'ms' : 'never checked'
      };
    }
  });

  // 7. Pasang ke Window (Read-Only)
  try {
    Object.defineProperty(root, 'SDLGOverviewSessionGate', {
      value: SessionGateAPI,
      writable: false,
      configurable: false
    });
  } catch (_) {
    root.SDLGOverviewSessionGate = SessionGateAPI;
  }

  // 8. Log sekali (informative, bukan spam)
  if (typeof console !== 'undefined' && console.info) {
    console.info(
      '%c[SDLG]%c Overview Session Gate v2.0 — passive mode (no block, no banner, no reload)',
      'background:#2f5bff;color:white;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px',
      'color:#64748b;font-size:11px'
    );
  }

})(typeof window !== 'undefined' ? window : globalThis);