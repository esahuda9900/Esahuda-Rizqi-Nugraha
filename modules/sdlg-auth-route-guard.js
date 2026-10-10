/**
 * SDLG Auth Route Guard v1.2
 * - Requires real Supabase session (access_token), not just localStorage hint
 * - Empty/protected hash without session → #/login
 * - 401 / SIGNED_OUT → #/login
 * - After login → restore intent or #/overview
 */
(function (root) {
  'use strict';
  if (root.__SDLG_AUTH_ROUTE_GUARD_V12__) return;
  root.__SDLG_AUTH_ROUTE_GUARD_V12__ = true;
  root.__SDLG_AUTH_ROUTE_GUARD_V11__ = true;
  root.__SDLG_AUTH_ROUTE_GUARD_V1__ = true;

  var KEY = 'sdlg_redirect_after_login';
  var busy = false;
  var lastAuth = null;

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

  function setHash(hash, saveIntent) {
    if (busy) return;
    var target = hash.charAt(0) === '#' ? hash : '#' + hash;
    var cur = String(root.location.hash || '');
    if (cur === target) return;
    if (saveIntent) {
      var intent = currentFullHash();
      if (intent && !isPublicHash() && intent !== target) {
        try { root.localStorage.setItem(KEY, intent); } catch (_) {}
      }
    }
    busy = true;
    try {
      root.location.replace(root.location.pathname + root.location.search + target);
    } catch (_) {
      root.location.hash = target;
    }
    setTimeout(function () { busy = false; }, 80);
  }

  function goLogin(saveIntent) {
    if (isLoginHash() && !isEmptyHash()) return;
    setHash('#/login', !!saveIntent);
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

  async function sessionPresent() {
    try {
      if (typeof root.waitForSupabaseReady === 'function') {
        var c = await root.waitForSupabaseReady(8000);
        if (c && c.__SDLG_AUTHENTICATED__) return true;
        if (c && c.__SDLG_LAST_SESSION__ && c.__SDLG_LAST_SESSION__.access_token) return true;
      }
    } catch (_) {}

    var client = getClient();
    if (!client || !client.auth) return false;
    try {
      var res = await client.auth.getSession();
      var s = res && res.data ? res.data.session : null;
      if (s && s.access_token) return true;
      var hint = false;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i) || '';
          if (/sb-.*-auth-token/i.test(k)) { hint = true; break; }
        }
      } catch (_) {}
      if (hint && typeof client.auth.refreshSession === 'function') {
        var ref = await client.auth.refreshSession();
        s = ref && ref.data ? ref.data.session : null;
        if (s && s.access_token) return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  async function enforce() {
    var authed = await sessionPresent();
    lastAuth = authed;

    if (!authed) {
      if (isEmptyHash() || !isLoginHash()) {
        goLogin(!isEmptyHash());
      }
      return;
    }

    if (isEmptyHash() || isLoginHash()) {
      goAfterLogin();
    }
  }

  function wireAuthListener() {
    var client = getClient();
    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== 'function') return false;
    try {
      client.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' || (session && session.access_token)) {
          lastAuth = true;
          if (isEmptyHash() || isLoginHash()) goAfterLogin();
          return;
        }
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session) {
          lastAuth = false;
          goLogin(true);
        }
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function wire401Trap() {
    if (root.__SDLG_401_TRAP__) return;
    root.__SDLG_401_TRAP__ = true;
    var origFetch = root.fetch;
    if (typeof origFetch !== 'function') return;
    root.fetch = function () {
      var args = arguments;
      return origFetch.apply(this, args).then(function (res) {
        try {
          var url = String((args[0] && args[0].url) || args[0] || '');
          if (res && res.status === 401 && /supabase\.co/i.test(url)) {
            if (!isLoginHash()) {
              console.warn('[SDLG auth] Supabase 401 — redirecting to login');
              goLogin(true);
            }
          }
        } catch (_) {}
        return res;
      });
    };
  }

  function boot() {
    wire401Trap();
    enforce();
    root.addEventListener('hashchange', function () { enforce(); });
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (wireAuthListener() || tries > 30) clearInterval(t);
      if (tries % 3 === 0) enforce();
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try {
    var hasToken = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i) || '';
      if (/sb-.*-auth-token/i.test(k)) { hasToken = true; break; }
    }
    if (!hasToken && (isEmptyHash() || !isLoginHash())) {
      root.location.replace(root.location.pathname + root.location.search + '#/login');
    }
  } catch (_) {}

  root.SDLGAuthRouteGuard = {
    version: '1.2.0',
    enforce: enforce,
    goLogin: goLogin,
    goAfterLogin: goAfterLogin,
    sessionPresent: sessionPresent,
    isEmptyHash: isEmptyHash,
    isLoginHash: isLoginHash
  };
})(window);
