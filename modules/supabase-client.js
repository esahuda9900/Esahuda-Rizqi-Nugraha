/** SDLG Supabase singleton v2.4 — transient failures never erase stored sessions. */
(function (root) {
  'use strict';
  if (root.__SDLG_SUPABASE_SINGLETON_V24__) return;
  root.__SDLG_SUPABASE_SINGLETON_V24__ = true;
  root.__SDLG_SUPABASE_SINGLETON_V23__ = true;
  root.__SDLG_SUPABASE_SINGLETON_V22__ = true;
  root.__SDLG_SUPABASE_SINGLETON_V2__ = true;

  var SUPABASE_URL = 'https://frqvelcreczmnofldrga.supabase.co';
  var SUPABASE_ANON = root.__SDLG_SUPABASE_ANON__ ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycXZlbGNyZWN6bW5vZmxkcmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzQyMDksImV4cCI6MjEwMzkxMDIwOX0.EQoGxEu8cNDF84tObZH13rwHiYt9EGcqnJiT3yRMa-w';
  var STORAGE_KEY = 'sb-frqvelcreczmnofldrga-auth-token';
  var SESSION_TIMEOUT_MS = 4000;

  var client = null;
  var readyPromise = null;
  var originalCreateClient = null;

  function log() {
    try { console.info.apply(console, ['[SDLG supabase-client]'].concat([].slice.call(arguments))); } catch (_) {}
  }
  function warn() {
    try { console.warn.apply(console, ['[SDLG supabase-client]'].concat([].slice.call(arguments))); } catch (_) {}
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

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error(label || 'timeout'));
      }, ms);
      Promise.resolve(promise).then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }, function (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  function clearAuthStorage() {
    // Explicit recovery affects this project only, never other Supabase apps.
    try { root.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
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
      log('client ready (v2.3 timeout)');
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
      if (existing) return existing;
      var c = createRaw(SUPABASE_URL, SUPABASE_ANON, opts);
      wireAuthRecheck(c);
      return remember(c);
    };
    root.__SDLG_CREATE_CLIENT_PATCHED__ = true;
    return true;
  }

  function hasTokenHint() {
    try { return !!root.localStorage.getItem(STORAGE_KEY); } catch (_) { return false; }
  }

  function applySessionFlags(c, session) {
    c.__SDLG_LAST_SESSION__ = session || null;
    c.__SDLG_AUTHENTICATED__ = !!(session && session.access_token);
  }

  function checkSession(c) {
    if (!c || !c.auth || typeof c.auth.getSession !== 'function') {
      return Promise.resolve({ session: null, error: new Error('No auth API') });
    }

    var authVersion = c.__SDLG_AUTH_VERSION__ || 0;
    function finish(session, error) {
      // A slow previous check must not overwrite a newer sign-in/sign-out event.
      if ((c.__SDLG_AUTH_VERSION__ || 0) !== authVersion) {
        return { session: c.__SDLG_LAST_SESSION__, error: null };
      }
      applySessionFlags(c, session);
      return { session: session, error: error };
    }

    return withTimeout(c.auth.getSession(), SESSION_TIMEOUT_MS, 'getSession timeout')
      .then(function (res) {
        var session = res && res.data ? res.data.session : null;
        if ((c.__SDLG_AUTH_VERSION__ || 0) !== authVersion) return finish(session, null);
        var error = res ? res.error : null;
        if (error) warn('getSession error', error);

        if (!session && hasTokenHint() && typeof c.auth.refreshSession === 'function') {
          log('token hint without session — refresh once (4s cap)');
          return withTimeout(c.auth.refreshSession(), SESSION_TIMEOUT_MS, 'refreshSession timeout')
            .then(function (ref) {
              session = ref && ref.data ? ref.data.session : null;
              error = ref ? ref.error : null;
              if (session) {
                log('session recovered', session.user && session.user.email);
              } else {
                warn('refresh unavailable — keep stored session for retry');
              }
              return finish(session, error);
            })
            .catch(function (err) {
              warn('refresh timeout/throw — keep stored session', err && err.message);
              return finish(null, err);
            });
        }

        return finish(session, error);
      })
      .catch(function (err) {
        warn('getSession timeout/throw — keep stored session', err && err.message);
        return finish(null, err);
      });
  }

  function wireAuthRecheck(c) {
    if (!c || !c.auth || c.__SDLG_AUTH_RECHECK__) return;
    c.__SDLG_AUTH_RECHECK__ = true;
    try {
      c.auth.onAuthStateChange(function (event, session) {
        c.__SDLG_AUTH_VERSION__ = (c.__SDLG_AUTH_VERSION__ || 0) + 1;
        log('auth event', event);
        applySessionFlags(c, session);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
          readyPromise = null;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setTimeout(function () {
            // Listeners may query Supabase; run after its auth callback releases the lock.
            if (c.__SDLG_LAST_SESSION__ !== session) return;
            try { root.dispatchEvent(new CustomEvent('sdlg-session-ready', {
              detail: { email: session && session.user && session.user.email, event: event }
            })); } catch (_) {}
          }, 0);
        }
      });
    } catch (_) {}
  }

  root.getSdlgSupabase = function getSdlgSupabase() {
    patchCreateClient();
    return ensureClient();
  };

  root.waitForSupabaseReady = function waitForSupabaseReady(timeoutMs) {
    timeoutMs = timeoutMs || 8000;
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
        checkSession(c).then(function () { resolve(c); }).catch(reject);
      }
      attempt();
    });
    return readyPromise;
  };

  root.sdlgRecheckSession = function sdlgRecheckSession() {
    readyPromise = null;
    var c = root.getSdlgSupabase();
    if (!c) return Promise.resolve(null);
    return checkSession(c).then(function (r) { return r.session; });
  };

  root.sdlgClearAuthStorage = clearAuthStorage;

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
