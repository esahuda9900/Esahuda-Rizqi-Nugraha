/**
 * SDLG Supabase singleton v2 — one GoTrueClient only.
 * Load AFTER supabase-js CDN, BEFORE index app bundle / other modules that call createClient.
 *
 * Public API:
 *   window.getSdlgSupabase()
 *   window.waitForSupabaseReady() -> Promise<client>
 *   window.sdlgSupabase / window.supabaseClient (same instance)
 */
(function (root) {
  'use strict';
  if (root.__SDLG_SUPABASE_SINGLETON_V2__) return;
  root.__SDLG_SUPABASE_SINGLETON_V2__ = true;

  var SUPABASE_URL = 'https://frqvelcreczmnofldrga.supabase.co';
  var SUPABASE_ANON = root.__SDLG_SUPABASE_ANON__ ||
    'sb_publishable_5TrTvCR8ymE3VNLhthYFMg_vWRRMHMi';
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
    var candidates = [
      client,
      root.sdlgSupabase,
      root.supabaseClient,
      root.__SDLG_SUPABASE_CLIENT,
      root.__SUPABASE_CLIENT,
      root.SDLGSupabase
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (isClient(candidates[i])) return remember(candidates[i]);
    }
    return null;
  }

  function defaultOptions() {
    return {
      db: { retry: false },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: STORAGE_KEY
      },
      global: {
        headers: { 'X-Client-Info': 'sdlg-warranty-singleton-v2' }
      }
    };
  }

  function mergeAuthOptions(opts) {
    opts = opts || {};
    var auth = Object.assign({}, (defaultOptions().auth), opts.auth || {});
    auth.storageKey = STORAGE_KEY;
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
    if (!root.supabase || typeof root.supabase.createClient !== 'function') {
      return null;
    }
    try {
      var c = createRaw(SUPABASE_URL, SUPABASE_ANON, defaultOptions());
      log('Supabase client initialized (singleton)');
      return remember(c);
    } catch (err) {
      warn('createClient failed', err);
      return null;
    }
  }

  /**
   * Patch window.supabase.createClient so the React app + helpers
   * always reuse the same GoTrueClient (same storageKey / session).
   */
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
      var c = originalCreateClient(url || SUPABASE_URL, key || SUPABASE_ANON, mergeAuthOptions(opts));
      log('createClient first instance stored as singleton');
      return remember(c);
    };
    root.__SDLG_CREATE_CLIENT_PATCHED__ = true;
    return true;
  }

  function checkSession(c) {
    if (!c || !c.auth || typeof c.auth.getSession !== 'function') {
      return Promise.resolve({ session: null, error: new Error('No auth API') });
    }
    return c.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      var error = res ? res.error : null;
      if (error) warn('getSession error', error);
      if (!session) {
        warn('USER NOT AUTHENTICATED — RLS WILL BLOCK DATA (empty arrays, zeros)');
      } else {
        log('Supabase client initialized & authenticated', session.user && session.user.email);
      }
      return { session: session, error: error };
    }).catch(function (err) {
      warn('getSession threw', err);
      return { session: null, error: err };
    });
  }

  root.getSdlgSupabase = function getSdlgSupabase() {
    patchCreateClient();
    return ensureClient();
  };

  /**
   * Resolves when client exists and getSession() has completed (session may still be null).
   */
  root.waitForSupabaseReady = function waitForSupabaseReady(timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    if (readyPromise) return readyPromise;

    readyPromise = new Promise(function (resolve, reject) {
      var started = Date.now();

      function attempt() {
        patchCreateClient();
        var c = ensureClient();
        if (!c) {
          if (Date.now() - started > timeoutMs) {
            reject(new Error('waitForSupabaseReady: CDN/client timeout'));
            return;
          }
          setTimeout(attempt, 50);
          return;
        }
        checkSession(c).then(function (result) {
          c.__SDLG_LAST_SESSION__ = result.session;
          c.__SDLG_AUTHENTICATED__ = !!(result.session && result.session.user);
          resolve(c);
        }).catch(reject);
      }

      attempt();
    });

    return readyPromise;
  };

  // Boot: patch as soon as CDN is present
  function boot() {
    if (patchCreateClient()) {
      ensureClient();
      root.waitForSupabaseReady().catch(function (e) { warn(e); });
      return;
    }
    var tries = 0;
    var t = setInterval(function () {
      tries += 1;
      if (patchCreateClient()) {
        clearInterval(t);
        ensureClient();
        root.waitForSupabaseReady().catch(function (e) { warn(e); });
      } else if (tries > 80) {
        clearInterval(t);
        warn('Supabase CDN never appeared');
      }
    }, 50);
  }

  boot();
})(typeof window !== 'undefined' ? window : globalThis);
