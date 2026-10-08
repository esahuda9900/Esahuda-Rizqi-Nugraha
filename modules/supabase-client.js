/**
 * Single shared Supabase client for the whole SPA.
 * Load AFTER supabase-js CDN. Never call createClient in other modules.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_SUPABASE_SINGLETON__) return;
  root.__SDLG_SUPABASE_SINGLETON__ = true;

  var SUPABASE_URL = 'https://frqvelcreczmnofldrga.supabase.co';
  var SUPABASE_ANON = root.__SDLG_SUPABASE_ANON__ ||
    'sb_publishable_5TrTvCR8ymE3VNLhthYFMg_vWRRMHMi';
  var STORAGE_KEY = 'sb-frqvelcreczmnofldrga-auth-token';

  function getExisting() {
    var candidates = [
      root.supabaseClient,
      root.sdlgSupabase,
      root.__SUPABASE_CLIENT,
      root.__SDLG_SUPABASE_CLIENT,
      root.SDLGSupabase
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c && typeof c.from === 'function' && typeof c.rpc === 'function') return c;
    }
    return null;
  }

  function createOnce() {
    var existing = getExisting();
    if (existing) return existing;
    if (!root.supabase || typeof root.supabase.createClient !== 'function') {
      return null;
    }
    var client = root.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: STORAGE_KEY
      }
    });
    root.supabaseClient = client;
    root.__SDLG_SUPABASE_CLIENT = client;
    root.sdlgSupabase = client;
    root.__SUPABASE_CLIENT = client;
    return client;
  }

  root.getSdlgSupabase = function () {
    return getExisting() || createOnce();
  };

  if (root.supabase) {
    createOnce();
  } else {
    var tries = 0;
    var t = setInterval(function () {
      tries += 1;
      if (root.supabase || tries > 40) {
        clearInterval(t);
        if (root.supabase) createOnce();
      }
    }, 50);
  }
})(typeof window !== 'undefined' ? window : globalThis);
