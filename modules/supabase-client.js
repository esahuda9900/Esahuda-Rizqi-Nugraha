/**
 * SDLG Supabase singleton v2.3 — legacy anon JWT + session recheck on SIGNED_IN
 * Root cause of blank Overview: REST grants only to authenticated; requests without JWT → 401.
 * v2.3: dedupe identical auth event logs (no SIGNED_IN spam).
 */
(function (root) {
  'use strict';
  if (root.__SDLG_SUPABASE_SINGLETON_V23__) return;
  root.__SDLG_SUPABASE_SINGLETON_V23__ = true;
  root.__SDLG_SUPABASE_SINGLETON_V22__ = true;
  root.__SDLG_SUPABASE_SINGLETON_V2__ = true;

  var SUPABASE_URL = 'https://frqvelcreczmnofldrga.supabase.co';
  var SUPABASE_ANON = root.__SDLG_SUPABASE_ANON__ ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycXZlbGNyZWN6bW5vZmxkcmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzQyMDksImV4cCI6MjEwMzkxMDIwOX0.EQoGxEu8cNDF84tObZH13rwHiYt9EGcqnJiT3yRMa-w';
  var STORAGE_KEY = 'sb-frqvelcreczmnofldrga-auth-token';

  var client = null;
  var readyPromise = null;
  var originalCreateClient = null;

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[SDLG supabase-client]');
    try { console.info.apply(console, args); } catch (_) {}
  }
  function warn() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[SDLG supabase-client]');
    try { console.warn.apply(console, args); } catch (_) {}
  }

  function isClient(c) {
    return !!(c && typeof c.from === 'function' && typeof c.rpc === 'function' && c.auth);
  }

  function remember(c) {
    if (!isClient(c)) return null;
    client = c;
    root.supabaseClient = c;
    root.__SDLG_SUPABASE_CLIENT = c;
    root.__SUPABASE_CLIENT = c;
    root.sdlgSupabase = c;
    root.SDLGSupabase = c;
    return c;
  }

  function findExisting() {
    var candidates = [client, root.sdlgSupabase, root.supabaseClient, root.__SDLG_SUPABASE_CLIENT, root.__SUPABASE_CLIENT, root.SDLGSupabase];
    for (var i = 0; i < candidates.length; i++) {
      if (isClient(candidates[i])) return remember(candidates[i]);
    }
    return null;
  }

  function defaultOptions() {
    var storage = null;
    try { storage = root.localStorage; } catch (_) {}
    return {
      db: { retry: false },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: STORAGE_KEY,
        storage: storage || undefined,
        flowType: 'implicit'
      },
      global: {
        headers: { 'X-Client-Info': 'sdlg-warranty-singleton-v23' }
      }
    };
  }

  function mergeAuthOptions(opts) {
    opts = opts || {};
    var auth = Object.assign({}, defaultOptions().auth, opts.auth || {});
    auth.storageKey = STORAGE_KEY;
    try { if (!auth.storage) auth.storage = root.localStorage; } catch (_) {}
    return Object.assign({}, defaultOptions(), opts, { auth: auth });
  }

  function createRaw(url, key, opts) {
    if (!root.supabase || typeof root.supabase.createClient !== 'function') {
      throw new Error('Supabase JS CDN not loaded');
    }
    var fn = originalCreateClient || root.supabase.createClient.bind(root.supabase);
    return fn(url || SUPABASE_URL, key || SUPABASE_ANON, mergeAuthOptions(opts));
  }

  function ensureClient() {
    var existing = findExisting();
    if (existing) return existing;
    if (!root.supabase || typeof root.supabase.createClient !== 'function') return null;
    try {
      var c = createRaw(SUPABASE_URL, SUPABASE_ANON, defaultOptions());
      log('Supabase client initialized (singleton v2.3, legacy anon JWT)');
      wireAuthRecheck(c);
      return remember(c);
    } catch (err) {
      warn('createClient failed', err);
      return null;
    }
  }

  function patchCreateClient() {
    if (!root.supabase || typeof root.supabase.createClient !== 'function') return false;
    if (root.__SDLG_CREATE_CLIENT_PATCHED__) return true;
    originalCreateClient = root.supabase.createClient.bind(root.supabase);
    root.supabase.createClient = function patchedCreateClient(url, key, opts) {
      var existing = findExisting();
      if (existing) {
        log('createClient reused singleton');
        return existing;
      }
      var c = createRaw(SUPABASE_URL, SUPABASE_ANON, opts);
      log('createClient first instance stored as singleton');
      wireAuthRecheck(c);
      return remember(c);
    };
    root.__SDLG_CREATE_CLIENT_PATCHED__ = true;
    return true;
  }

  function applySessionFlags(c, session) {
    if (!c) return;
    try {
      c.__SDLG_LAST_SESSION__ = session || null;
      c.__SDLG_AUTHENTICATED__ = !!(session && session.access_token);
    } catch (_) {}
  }

  function getSessionSafe(c) {
    if (!c || !c.auth || typeof c.auth.getSession !== 'function') {
      return Promise.resolve({ session: null, error: new Error('no auth') });
    }
    return Promise.resolve()
      .then(function () { return c.auth.getSession(); })
      .then(function (res) {
        var session = res && res.data ? res.data.session : null;
        var error = res ? res.error : null;
        if (error) {
          warn('getSession error', error);
          applySessionFlags(c, null);
          return { session: null, error: error };
        }
        if (!session) {
          warn('USER NOT AUTHENTICATED — RLS WILL BLOCK DATA (empty arrays, zeros)');
        } else {
          log('authenticated', session.user && session.user.email);
        }
        applySessionFlags(c, session);
        return { session: session, error: null };
      })
      .catch(function (err) {
        warn('getSession threw', err);
        applySessionFlags(c, null);
        return { session: null, error: err };
      });
  }

  function wireAuthRecheck(c) {
    if (!c || !c.auth || c.__SDLG_AUTH_RECHECK__) return;
    c.__SDLG_AUTH_RECHECK__ = true;
    var lastAuthLog = '';
    try {
      c.auth.onAuthStateChange(function (event, session) {
        var email = session && session.user && session.user.email;
        var key = event + '|' + (email || '');
        if (key !== lastAuthLog) {
          lastAuthLog = key;
          log('auth event', event, email);
        }
        applySessionFlags(c, session);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
          readyPromise = null;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          try {
            root.dispatchEvent(new CustomEvent('sdlg-session-ready', {
              detail: { email: email, event: event }
            }));
          } catch (_) {}
        }
      });
    } catch (_) {}
  }

  root.getSdlgSupabase = function getSdlgSupabase() {
    patchCreateClient();
    return ensureClient();
  };

  root.waitForSupabaseReady = function waitForSupabaseReady(timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    if (readyPromise) return readyPromise;
    var start = Date.now();
    readyPromise = new Promise(function (resolve, reject) {
      (function tick() {
        patchCreateClient();
        var c = ensureClient();
        if (c) {
          getSessionSafe(c).then(function () { resolve(c); });
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          reject(new Error('Supabase client not ready within timeout'));
          return;
        }
        setTimeout(tick, 40);
      })();
    });
    return readyPromise;
  };

  // Early boot
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        patchCreateClient();
        ensureClient();
      }, { once: true });
    } else {
      patchCreateClient();
      ensureClient();
    }
  } catch (_) {
    try { patchCreateClient(); ensureClient(); } catch (__) {}
  }
})(typeof window !== 'undefined' ? window : this);
