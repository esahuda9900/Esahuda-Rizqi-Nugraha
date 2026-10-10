/**
 * SDLG Auth Route Guard v1.1
 * - Empty hash + not auth → #/login (URL must show #/login)
 * - Empty hash + auth → #/overview
 * - Protected route + not auth → #/login (save intent)
 * - #/login + auth → restore intent or #/overview
 */
(function (root) {
  'use strict';
  if (root.__SDLG_AUTH_ROUTE_GUARD_V11__) return;
  root.__SDLG_AUTH_ROUTE_GUARD_V11__ = true;
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

  /** True when URL has no meaningful route hash */
  function isEmptyHash() {
    var h = rawHash().replace(/^\//, '').trim().toLowerCase();
    return !h || h === '/' || h === 'index.html';
  }

  /** True only for explicit login route */
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
    if (cur === target || cur === target.replace(/^#\//, '#') ) {
      // already there
      if (cur === target) return;
    }
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
    // Always force explicit #/login so address bar matches UI
    if (isLoginHash() && !isEmptyHash()) return;
    setHash('#/login', !!saveIntent);
  }

  function goAfterLogin() {
    var dest = null;
    try { dest = root.localStorage.getItem(KEY); } catch (_) {}
    try { root.localStorage.removeItem(KEY); } catch (_) {}
    if (!dest || /^#\/?login/i.test(dest) || dest === '#' || dest === '#/' || !dest) {
      dest = '#/overview';
    }
    setHash(dest, false);
  }

  function goOverview() {
    setHash('#/overview', false);
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

  function hasTokenHint() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (/sb-.*-auth-token/i.test(k)) return true;
      }
    } catch (_) {}
    return false;
  }

  async function enforce() {
    var authed = await sessionPresent();

    if (!authed) {
      // Empty hash OR any protected route → explicit #/login
      if (isEmptyHash() || !isLoginHash()) {
        goLogin(!isEmptyHash());
      }
      return;
    }

    // Authenticated
    if (isEmptyHash() || isLoginHash()) {
      if (isLoginHash() || isEmptyHash()) goAfterLogin();
    }
  }

  function wireAuthListener() {
    var client = getClient();
    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== 'function') return false;
    try {
      client.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' || (session && session.access_token)) {
          if (isEmptyHash() || isLoginHash()) goAfterLogin();
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
      if (wireAuthListener() || tries > 25) clearInterval(t);
      enforce();
    }, 350);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Early: empty hash + no token → #/login immediately (sync, no wait for Supabase)
  try {
    if (!hasTokenHint() && (isEmptyHash() || !isLoginHash())) {
      if (!isLoginHash()) {
        root.location.replace(root.location.pathname + root.location.search + '#/login');
      }
    }
  } catch (_) {}

  root.SDLGAuthRouteGuard = {
    version: '1.1.0',
    enforce: enforce,
    goLogin: goLogin,
    goAfterLogin: goAfterLogin,
    isEmptyHash: isEmptyHash,
    isLoginHash: isLoginHash
  };
})(window);
