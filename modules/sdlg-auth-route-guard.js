/**
 * SDLG Auth Route Guard — V2.0 (Smart Auth Sentinel)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ VISUAL FEEDBACK: Notif "Sesi Berakhir" sebelum redirect.
 * ✅ SMART WATCHDOG: Pause kalau tab gak aktif (hemat baterai).
 * ✅ DEBOUNCED HASH: Anti-overlap pas cek session.
 * ✅ SAFE FETCH: Interceptor 401 yang lebih stabil.
 * ✅ FAST TOKEN CHECK: Cek sb-* keys secara efisien.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_AUTH_ROUTE_GUARD_V2__) return;
  root.__SDLG_AUTH_ROUTE_GUARD_V2__ = true;

  const KEY = 'sdlg_redirect_after_login';
  let busy = false;
  let clearing = false;
  let lastAuth = null;
  let lastLogKey = '';
  let enforceTimer = null;

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES & LOGGING
  // ─────────────────────────────────────────────────────────
  function log(msg, data) {
    if (window.__SDLG_DEBUG_AUTH__) console.info('[SDLG Auth] ' + msg, data || '');
  }
  
  function logOnce(key, msg, data) {
    if (key && key === lastLogKey) return;
    lastLogKey = key || lastLogKey;
    log(msg, data);
  }

  function notifyUser(type, title, msg) {
    if (root.SDLGNotify && root.SDLGNotify[type]) {
      root.SDLGNotify[type](title, msg);
    }
  }

  function getClient() {
    try {
      if (typeof root.getSdlgSupabase === 'function') {
        return root.getSdlgSupabase();
      }
    } catch (_) {}
    return root.sdlgSupabase || root.supabaseClient || null;
  }

  // ─────────────────────────────────────────────────────────
  // 2. HASH & ROUTING HELPERS
  // ─────────────────────────────────────────────────────────
  function rawHash() {
    return String(root.location.hash || '').replace(/^#\/?/, '').toLowerCase();
  }

  function isEmptyHash() {
    const h = rawHash().trim();
    return !h || h === '/' || h === 'index.html';
  }

  function isLoginHash() {
    const h = rawHash();
    return h === 'login' || h.indexOf('login/') === 0 || h === 'signin' || h === 'auth';
  }

  function setHash(hash, saveIntent) {
    if (busy) return;
    const target = hash.charAt(0) === '#' ? hash : '#' + hash;
    const cur = String(root.location.hash || '');
    if (cur === target) return;

    if (saveIntent) {
      const intent = cur;
      if (intent && !isEmptyHash() && !isLoginHash()) {
        try { root.localStorage.setItem(KEY, intent); } catch (_) {}
      }
    }
    
    busy = true;
    try {
      root.location.replace(root.location.pathname + root.location.search + target);
    } catch (_) {
      root.location.hash = target;
    }
    setTimeout(() => { busy = false; }, 150);
  }

  function goLogin(saveIntent, clearSession) {
    if (clearSession) clearAllSbKeys();
    if (isLoginHash() && !isEmptyHash()) return; // Udah di login
    setHash('#/login', !!saveIntent && !clearSession);
  }

  function goAfterLogin() {
    let dest = null;
    try { dest = root.localStorage.getItem(KEY); } catch (_) {}
    try { root.localStorage.removeItem(KEY); } catch (_) {}
    
    if (!dest || /^#\/?login/i.test(dest) || dest === '#' || dest === '#/') {
      dest = '#/overview';
    }
    setHash(dest, false);
  }

  // ─────────────────────────────────────────────────────────
  // 3. SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────
  function hasTokenHint() {
    try {
      // Cek cepet pake Object.keys().some()
      return Object.keys(localStorage).some(k => /^sb-.*-auth-token/i.test(k));
    } catch (_) { return false; }
  }

  function clearAllSbKeys() {
    if (clearing) return;
    clearing = true;
    
    try {
      const keys = Object.keys(localStorage).filter(k => /^sb-/i.test(k));
      keys.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
      if (keys.length) log('Cleared ' + keys.length + ' sb-* localStorage keys');
    } catch (_) {}

    try {
      const client = getClient();
      if (client?.auth?.signOut) {
        client.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      if (client) {
        client.__SDLG_LAST_SESSION__ = null;
        client.__SDLG_AUTHENTICATED__ = false;
      }
    } catch (_) {}

    root.dispatchEvent(new CustomEvent('sdlg-auth-cleared', { detail: { reason: 'dead-session' } }));
    setTimeout(() => { clearing = false; }, 300);
  }

  async function getValidSession() {
    let client = getClient();
    if (!client?.auth && typeof root.waitForSupabaseReady === 'function') {
      try { client = await root.waitForSupabaseReady(6000); } catch (_) {}
    }
    if (!client?.auth) return null;

    try {
      const res = await client.auth.getSession();
      let s = res?.data?.session;

      if (s?.access_token) {
        // Cek expired (kasih toleransi 5 detik)
        if (s.expires_at && s.expires_at * 1000 < Date.now() - 5000) {
          log('Token expired by clock, attempting refresh...');
          s = null; 
        } else {
          return s;
        }
      }

      // Kalau expired tapi ada token di storage, coba refresh
      if (hasTokenHint() && client.auth.refreshSession) {
        log('Attempting refreshSession...');
        const ref = await client.auth.refreshSession();
        s = ref?.data?.session;
        
        if (s?.access_token) {
          log('refreshSession OK');
          client.__SDLG_LAST_SESSION__ = s;
          client.__SDLG_AUTHENTICATED__ = true;
          return s;
        }
        log('refreshSession failed — dead token');
        clearAllSbKeys();
        return null;
      }

      if (hasTokenHint()) clearAllSbKeys();
      return null;
    } catch (e) {
      log('getValidSession error', e);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. ENFORCE (Penegakan Aturan)
  // ─────────────────────────────────────────────────────────
  async function enforce() {
    const session = await getValidSession();
    const authed = !!session?.access_token;
    lastAuth = authed;

    if (!authed) {
      if (isLoginHash()) return;
      
      // Kalau sebelumnya login, kasih tau user
      if (lastAuth === true) {
        notifyUser('warning', 'Sesi Berakhir', 'Sesi login Anda telah habis. Silakan login kembali.');
      }
      
      goLogin(!isEmptyHash(), hasTokenHint());
      return;
    }

    // Kalau udah login tapi di halaman kosong/login, lempar ke overview
    if (isEmptyHash() || isLoginHash()) {
      goAfterLogin();
    }
  }

  // Fungsi debounce buat enforce (biar gak overlap)
  function safeEnforce() {
    if (enforceTimer) clearTimeout(enforceTimer);
    enforceTimer = setTimeout(() => { enforce().catch(() => {}); }, 100);
  }

  // ─────────────────────────────────────────────────────────
  // 5. NETWORK INTERCEPTOR (Anti 401)
  // ─────────────────────────────────────────────────────────
  function wire401Trap() {
    if (root.__SDLG_401_TRAP_V2__) return;
    root.__SDLG_401_TRAP_V2__ = true;

    const origFetch = root.fetch;
    if (typeof origFetch !== 'function') return;
    
    let last401 = 0;

    root.fetch = function () {
      const args = arguments;
      const url = String((args[0]?.url) || args[0] || '');

      return origFetch.apply(this, args).then(async (res) => {
        if (res?.status === 401 && /supabase\.co/i.test(url)) {
          const now = Date.now();
          if (now - last401 > 2000) {
            last401 = now;
            if (!isLoginHash()) {
              log('Supabase 401 — clearing session');
              notifyUser('error', 'Sesi Ditinjau', 'Koneksi database menolak. Sesi akan di-reset.');
              clearAllSbKeys();
              goLogin(true, true);
            }
          }
        }
        return res;
      }).catch((err) => {
        // Handle network failure tanpa ngerusak promise aslinya
        throw err;
      });
    };
  }

  // ─────────────────────────────────────────────────────────
  // 6. WATCHDOG (Smart Polling)
  // ─────────────────────────────────────────────────────────
  function startWatchdog() {
    if (root.__SDLG_SESSION_WATCHDOG_V2__) return;
    root.__SDLG_SESSION_WATCHDOG_V2__ = true;

    let intervalId = null;

    function checkSession() {
      if (isLoginHash() || document.hidden) return;
      getValidSession().then(s => {
        if (!s) {
          log('Watchdog: session gone');
          clearAllSbKeys();
          goLogin(true, true);
        }
      });
    }

    function startInterval() {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(checkSession, 5 * 60 * 1000); // 5 menit
    }

    // Pause kalau tab hidden, resume kalau aktif
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (intervalId) clearInterval(intervalId);
      } else {
        checkSession(); // Cek langsung pas tab aktif
        startInterval();
      }
    });

    startInterval();
  }

  // ─────────────────────────────────────────────────────────
  // 7. AUTH LISTENER (Supabase Events)
  // ─────────────────────────────────────────────────────────
  function wireAuthListener() {
    const client = getClient();
    if (!client?.auth?.onAuthStateChange) return false;
    if (root.__SDLG_AUTH_LISTENER_V2__) return true;

    try {
      client.auth.onAuthStateChange((event, session) => {
        const email = session?.user?.email || '';
        logOnce(event + '|' + email, 'Auth Event: ' + event + ' ' + email);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session?.access_token) {
            lastAuth = true;
            client.__SDLG_LAST_SESSION__ = session;
            client.__SDLG_AUTHENTICATED__ = true;
            
            if (isEmptyHash() || isLoginHash()) goAfterLogin();
            return;
          }
          if (event === 'INITIAL_SESSION' && !session) {
            lastAuth = false;
            if (!isLoginHash()) goLogin(true, false);
          }
          return;
        }

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          lastAuth = false;
          lastLogKey = '';
          client.__SDLG_LAST_SESSION__ = null;
          client.__SDLG_AUTHENTICATED__ = false;
          
          root.dispatchEvent(new CustomEvent('sdlg-auth-cleared', { detail: { reason: event } }));
          notifyUser('info', 'Logout Berhasil', 'Anda telah keluar dari sistem.');
          goLogin(true, false);
        }
      });
      
      root.__SDLG_AUTH_LISTENER_V2__ = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 8. BOOT SEQUENCE
  // ─────────────────────────────────────────────────────────
  function boot() {
    wire401Trap();
    wireAuthListener();
    startWatchdog();
    
    // Initial check
    safeEnforce();

    // Listen ke hashchange
    root.addEventListener('hashchange', safeEnforce);

    // Retry wire listener kalau client belum siap
    let tries = 0;
    const timer = setInterval(() => {
      if (wireAuthListener() || ++tries > 12) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 9. EXPORT API
  // ─────────────────────────────────────────────────────────
  root.SDLGAuthRouteGuard = {
    version: '2.0.0',
    enforce: enforce,
    goLogin: goLogin,
    goAfterLogin: goAfterLogin,
    getValidSession: getValidSession,
    clearAllSbKeys: clearAllSbKeys,
    isEmptyHash: isEmptyHash,
    isLoginHash: isLoginHash
  };

})(window);