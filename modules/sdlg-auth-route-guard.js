/**
 * SDLG Auth Route Guard v1.3 — nuclear session sync
 * - Dead token (storage but getSession null) → clear sb-* keys → #/login
 * - 401 → clear session first → #/login (no loop)
 * - Login hash never auto-redirects unless real access_token present
 * - Watchdog every 5 min
 */
(function (root) {
  'use strict';
  if (root.__SDLG_AUTH_ROUTE_GUARD_V13__) return;
  root.__SDLG_AUTH_ROUTE_GUARD_V13__ = true;
  root.__SDLG_AUTH_ROUTE_GUARD_V12__ = true;
  root.__SDLG_AUTH_ROUTE_GUARD_V1__ = true;

  var KEY = 'sdlg_redirect_after_login';
  var busy = false;
  var clearing = false;
  var lastAuth = null;

  function log() {
    try {
      var a = ['[SDLG auth-guard]'].concat([].slice.call(arguments));
      console.info.apply(console, a);
    } catch (_) {}
  }
  function warn() {
    try {
      var a = ['[SDLG auth-guard]'].concat([].slice.call(arguments));
      console.warn.apply(console, a);
    } catch (_) {}
  }

  function getClient() {
    try {
      if (typeof root.getSdlgSupabase === 'function') {
        var c = root.getSdlgSupabase();
        if (c) return c;
      }
    } catch (_) {}
    return root.sdlgSupabase || root.supabaseClient || null;
  }

  function rawHash() {
    return String(root.location.hash || '').replace(/^#/, '');
  }

  function isEmptyHash() {
    var h = rawHash().replace(/^\//, '').trim().toLowerCase();
    return !h || h === '/' || h === 'index.html';
  }

  function isLoginHash() {
    var h = rawHash().replace(/^\//, '').toLowerCase();
    return h === 'login' || h.indexOf('login/') === 0 || h === 'signin' || h === 'auth';
  }

  function isPublicHash() {
    return isEmptyHash() || isLoginHash();
  }

  function currentFullHash() {
    var h = String(root.location.hash || '');
    if (!h || h === '#' || h === '#/') return '';
    return h;
  }

  function clearAllSbKeys() {
    if (clearing) return;
    clearing = true;
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^sb-/i.test(k)) keys.push(k);
      }
      keys.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      log('Cleared', keys.length, 'sb-* localStorage keys');
    } catch (_) {}
    try {
      var client = getClient();
      if (client && client.auth && typeof client.auth.signOut === 'function') {
        client.auth.signOut({ scope: 'local' }).catch(function () {});
      }
      if (client) {
        client.__SDLG_LAST_SESSION__ = null;
        client.__SDLG_AUTHENTICATED__ = false;
      }
    } catch (_) {}
    try {
      root.dispatchEvent(new CustomEvent('sdlg-auth-cleared', { detail: { reason: 'dead-session' } }));
    } catch (_) {}
    setTimeout(function () { clearing = false; }, 300);
  }

  function setHash(hash, saveIntent) {
    if (busy) return;
    var target = hash.charAt(0) === '#' ? hash : '#' + hash;
    var cur = String(root.location.hash || '');
    if (cur === target) return;
    if (saveIntent) {
      var intent = currentFullHash();
      if (intent && !isPublicHash() && intent !== target && !/^#\/?login/i.test(intent)) {
        try { root.localStorage.setItem(KEY, intent); } catch (_) {}
      }
    }
    busy = true;
    try {
      root.location.replace(root.location.pathname + root.location.search + target);
    } catch (_) {
      root.location.hash = target;
    }
    setTimeout(function () { busy = false; }, 100);
  }

  function goLogin(saveIntent, clearSession) {
    if (clearSession) clearAllSbKeys();
    if (isLoginHash() && !isEmptyHash()) return;
    setHash('#/login', !!saveIntent && !clearSession);
  }

  function goAfterLogin() {
    var dest = null;
    try { dest = root.localStorage.getItem(KEY); } catch (_) {}
    try { root.localStorage.removeItem(KEY); } catch (_) {}
    if (!dest || /^#\/?login/i.test(dest) || dest === '#' || dest === '#/') {
      dest = '#/overview';
    }
    setHash(dest, false);
  }

  function hasTokenHint() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (/sb-.*-auth-token/i.test(k)) return true;
      }
    } catch (_) {}
    return false;
  }

  async function getValidSession() {
    var client = getClient();
    if (!client || !client.auth) {
      try {
        if (typeof root.waitForSupabaseReady === 'function') {
          client = await root.waitForSupabaseReady(6000);
        }
      } catch (_) {}
    }
    if (!client || !client.auth) return null;

    try {
      var res = await client.auth.getSession();
      var s = res && res.data ? res.data.session : null;
      if (s && s.access_token) {
        if (s.expires_at && s.expires_at * 1000 < Date.now() - 5000) {
          log('access_token expired by clock — try refresh');
          s = null;
        } else {
          return s;
        }
      }

      if (hasTokenHint() && typeof client.auth.refreshSession === 'function') {
        log('Attempting refreshSession');
        var ref = await client.auth.refreshSession();
        s = ref && ref.data ? ref.data.session : null;
        if (s && s.access_token) {
          log('refreshSession OK');
          client.__SDLG_LAST_SESSION__ = s;
          client.__SDLG_AUTHENTICATED__ = true;
          return s;
        }
        warn('refreshSession failed — dead token');
        clearAllSbKeys();
        return null;
      }

      if (hasTokenHint()) {
        clearAllSbKeys();
      }
      return null;
    } catch (e) {
      warn('getValidSession error', e);
      return null;
    }
  }

  async function enforce() {
    var session = await getValidSession();
    var authed = !!(session && session.access_token);
    lastAuth = authed;

    if (!authed) {
      if (isLoginHash()) return;
      goLogin(!isEmptyHash(), hasTokenHint());
      return;
    }

    if (isEmptyHash() || isLoginHash()) {
      goAfterLogin();
    }
  }

  function wireAuthListener() {
    var client = getClient();
    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== 'function') return false;
    if (root.__SDLG_AUTH_LISTENER_V13__) return true;
    try {
      client.auth.onAuthStateChange(function (event, session) {
        log('onAuthStateChange', event, session && session.user && session.user.email);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session && session.access_token) {
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
          client.__SDLG_LAST_SESSION__ = null;
          client.__SDLG_AUTHENTICATED__ = false;
          try { root.dispatchEvent(new CustomEvent('sdlg-auth-cleared', { detail: { reason: event } })); } catch (_) {}
          goLogin(true, false);
        }
      });
      root.__SDLG_AUTH_LISTENER_V13__ = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  function wire401Trap() {
    if (root.__SDLG_401_TRAP_V13__) return;
    root.__SDLG_401_TRAP_V13__ = true;
    var origFetch = root.fetch;
    if (typeof origFetch !== 'function') return;
    var last401 = 0;
    root.fetch = function () {
      var args = arguments;
      return origFetch.apply(this, args).then(function (res) {
        try {
          var url = String((args[0] && args[0].url) || args[0] || '');
          if (res && res.status === 401 && /supabase\.co/i.test(url)) {
            var now = Date.now();
            if (now - last401 < 2000) return res;
            last401 = now;
            if (!isLoginHash()) {
              warn('Supabase 401 — clear session + login');
              goLogin(true, true);
            }
          }
        } catch (_) {}
        return res;
      });
    };
  }

  function startWatchdog() {
    if (root.__SDLG_SESSION_WATCHDOG__) return;
    root.__SDLG_SESSION_WATCHDOG__ = true;
    setInterval(function () {
      if (isLoginHash()) return;
      getValidSession().then(function (s) {
        if (!s) {
          warn('Watchdog: session gone');
          goLogin(true, true);
        }
      });
    }, 5 * 60 * 1000);
  }

  function boot() {
    wire401Trap();
    wireAuthListener();
    startWatchdog();
    enforce();
    root.addEventListener('hashchange', function () { enforce(); });
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (wireAuthListener() || tries > 25) clearInterval(t);
      if (tries <= 8) enforce();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try {
    if (!hasTokenHint() && !isLoginHash()) {
      root.location.replace(root.location.pathname + root.location.search + '#/login');
    }
  } catch (_) {}

  root.SDLGAuthRouteGuard = {
    version: '1.3.0',
    enforce: enforce,
    goLogin: goLogin,
    goAfterLogin: goAfterLogin,
    getValidSession: getValidSession,
    clearAllSbKeys: clearAllSbKeys,
    isEmptyHash: isEmptyHash,
    isLoginHash: isLoginHash
  };
})(window);
