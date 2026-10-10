/**
 * SDLG Auth Route Guard v1
 * - Logged out + protected route → #/login (save intent)
 * - Logged in + #/login → restore intent or #/overview
 * - URL always matches visible auth state
 */
(function (root) {
  'use strict';
  if (root.__SDLG_AUTH_ROUTE_GUARD_V1__) return;
  root.__SDLG_AUTH_ROUTE_GUARD_V1__ = true;

  var KEY = 'sdlg_redirect_after_login';
  var busy = false;

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

  function isLoginHash() {
    var h = rawHash().replace(/^\//, '').toLowerCase();
    return !h || h === 'login' || h === '/' || h.indexOf('login') === 0;
  }

  function currentFullHash() {
    var h = String(root.location.hash || '');
    return h || '#/overview';
  }

  function goLogin(saveIntent) {
    if (busy) return;
    var cur = currentFullHash();
    if (saveIntent && cur && !/^#\/?login/i.test(cur) && cur !== '#' && cur !== '#/') {
      try { root.localStorage.setItem(KEY, cur); } catch (_) {}
    }
    if (isLoginHash()) return;
    busy = true;
    try {
      root.location.replace(root.location.pathname + root.location.search + '#/login');
    } catch (_) {
      root.location.hash = '#/login';
    }
    setTimeout(function () { busy = false; }, 50);
  }

  function goAfterLogin() {
    if (busy) return;
    var dest = null;
    try { dest = root.localStorage.getItem(KEY); } catch (_) {}
    try { root.localStorage.removeItem(KEY); } catch (_) {}
    if (!dest || /^#\/?login/i.test(dest) || dest === '#' || dest === '#/') {
      dest = '#/overview';
    }
    busy = true;
    try {
      root.location.replace(root.location.pathname + root.location.search + dest);
    } catch (_) {
      root.location.hash = dest;
    }
    setTimeout(function () { busy = false; }, 50);
  }

  async function sessionPresent() {
    var client = getClient();
    if (!client || !client.auth) return false;
    try {
      var res = await client.auth.getSession();
      var s = res && res.data ? res.data.session : null;
      return !!(s && s.access_token);
    } catch (_) {
      return false;
    }
  }

  async function enforce() {
    var authed = await sessionPresent();
    if (!authed) {
      if (!isLoginHash()) goLogin(true);
      return;
    }
    if (isLoginHash()) goAfterLogin();
  }

  function wireAuthListener() {
    var client = getClient();
    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== 'function') return false;
    try {
      client.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' || (session && session.access_token)) {
          if (isLoginHash()) goAfterLogin();
          return;
        }
        if (event === 'SIGNED_OUT' || !session) {
          goLogin(true);
        }
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function boot() {
    enforce();
    root.addEventListener('hashchange', function () { enforce(); });
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (wireAuthListener() || tries > 20) clearInterval(t);
      enforce();
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Early sync redirect when no auth token and hash is protected (reduces wrong-URL flash)
  try {
    var hasToken = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i) || '';
      if (/sb-.*-auth-token/i.test(k)) { hasToken = true; break; }
    }
    if (!hasToken && !isLoginHash()) {
      try { localStorage.setItem(KEY, currentFullHash()); } catch (_) {}
      root.location.replace(root.location.pathname + root.location.search + '#/login');
    }
  } catch (_) {}

  root.SDLGAuthRouteGuard = {
    version: '1.0.0',
    enforce: enforce,
    goLogin: goLogin,
    goAfterLogin: goAfterLogin
  };
})(window);
