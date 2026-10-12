/**
 * SDLG repository v3.1 — count cache key bumped (v2) to clear stale 100.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_REPOSITORY_V31__) return;
  root.__SDLG_REPOSITORY_V31__ = true;

  var COUNT_CACHE_KEY = 'sdlg:claims-count:v2';
  var COUNT_CACHE_TTL_MS = 5 * 60 * 1000;
  var PAGE_SIZE = 100;

  function getClient() {
    return (typeof root.getSdlgSupabase === 'function' && root.getSdlgSupabase())
      || root.supabaseClient || root.sdlgSupabase || null;
  }

  function readCountCache() {
    try {
      var raw = root.sessionStorage.getItem(COUNT_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.count !== 'number') return null;
      if (Date.now() - (parsed.at || 0) > COUNT_CACHE_TTL_MS) return null;
      return parsed.count;
    } catch (_) { return null; }
  }

  function writeCountCache(count) {
    try {
      if (typeof count !== 'number') return;
      root.sessionStorage.setItem(
        COUNT_CACHE_KEY,
        JSON.stringify({ count: count, at: Date.now() })
      );
    } catch (_) {}
  }

  // Drop legacy v1 cache that may hold 100
  try { root.sessionStorage.removeItem('sdlg:claims-count:v1'); } catch (_) {}

  var repo = {
    async countClaims() {
      var client = getClient();
      if (!client) return null;
      var result = await client.from('claims').select('*', { count: 'exact', head: true });
      if (result.error) throw result.error;
      var count = typeof result.count === 'number' ? result.count : null;
      if (count != null) writeCountCache(count);
      return count;
    },

    async countClaimsCached(forceRefresh) {
      if (!forceRefresh) {
        var cached = readCountCache();
        if (cached != null) return cached;
      }
      return repo.countClaims();
    },

    async listClaimsPage(page) {
      var client = getClient();
      if (!client) return [];
      var from = Math.max(0, (page || 0) * PAGE_SIZE);
      var result = await client
        .from('claims')
        .select('*')
        .order('claim_id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (result.error) throw result.error;
      return result.data || [];
    },

    async listClaims() {
      var client = getClient();
      if (!client) return [];
      var all = [];
      var page = 0;
      while (page < 30) {
        var rows = await client
          .from('claims')
          .select('*')
          .order('claim_id', { ascending: false })
          .range(page * 200, page * 200 + 199);
        if (rows.error) throw rows.error;
        var chunk = rows.data || [];
        all = all.concat(chunk);
        if (chunk.length < 200) break;
        page += 1;
      }
      return all;
    },

    async listClaimsHydrated() {
      var pageRows = [];
      try {
        pageRows = await repo.listClaimsPage(0);
      } catch (_) {}
      var full = null;
      try {
        full = await repo.listClaims();
      } catch (_) {}
      return full && full.length ? full : pageRows;
    }
  };

  root.SDLGRepository = repo;
  root.sdlgRepository = repo;
  try { console.info('[SDLG] sdlg-repository.js v3.1 loaded (count cache v2)'); } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
