/**
 * SDLG_REPOSITORY — data access layer
 * v3: countClaimsCached (sessionStorage 5min) + no intermediate page for Overview KPIs
 */
(function (global) {
  'use strict';

  var PAGE_SIZE = 500;
  var MAX_PAGES = 50;
  var MAX_RETRIES = 3;
  var COUNT_CACHE_KEY = 'sdlg:claims-count:v1';
  var COUNT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  function getClient() {
    if (typeof global.getSdlgSupabase === 'function') {
      var c = global.getSdlgSupabase();
      if (c) return c;
    }
    return global.sdlgSupabase || global.supabaseClient || null;
  }

  function isTransient(error) {
    var code = String((error && (error.code || error.status)) || '').toUpperCase();
    var msg = String((error && error.message) || error || '').toLowerCase();
    return (
      ['408', '425', '429', '500', '502', '503', '504', 'PGRST000'].indexOf(code) >= 0 ||
      /network|fetch|timeout|temporar|connect|cloudflare|502|503|504/.test(msg)
    );
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function runRead(operation, maxAttempts) {
    maxAttempts = maxAttempts || MAX_RETRIES;
    var lastError = null;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        var result = await operation();
        if (!result || !result.error) return result;
        lastError = result.error;
        if (!isTransient(lastError) || attempt === maxAttempts - 1) return result;
      } catch (err) {
        lastError = err;
        if (!isTransient(err) || attempt === maxAttempts - 1) throw err;
      }
      await sleep(Math.min(4000, 250 * Math.pow(2, attempt)));
    }
    return { data: null, error: lastError };
  }

  function normalizeRows(rows) {
    try {
      if (global.SDLG_DATA_MODEL && typeof global.SDLG_DATA_MODEL.normalizeClaimCollection === 'function') {
        var n = global.SDLG_DATA_MODEL.normalizeClaimCollection(rows || []);
        return n.rows || rows || [];
      }
    } catch (_) {}
    return rows || [];
  }

  function readCountCache() {
    try {
      var raw = global.sessionStorage && global.sessionStorage.getItem(COUNT_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.count !== 'number') return null;
      if (Date.now() - (parsed.at || 0) > COUNT_CACHE_TTL_MS) return null;
      return parsed.count;
    } catch (_) {
      return null;
    }
  }

  function writeCountCache(count) {
    try {
      if (typeof count !== 'number') return;
      global.sessionStorage && global.sessionStorage.setItem(
        COUNT_CACHE_KEY,
        JSON.stringify({ count: count, at: Date.now() })
      );
    } catch (_) {}
  }

  function clearCountCache() {
    try {
      global.sessionStorage && global.sessionStorage.removeItem(COUNT_CACHE_KEY);
    } catch (_) {}
  }

  var repo = {
    async countClaims() {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      var result = await runRead(function () {
        return client.from('claims').select('*', { count: 'exact', head: true });
      });
      if (result && result.error) throw result.error;
      var count = typeof result.count === 'number' ? result.count : null;
      if (count != null) writeCountCache(count);
      return count;
    },

    /** Count with 5-min sessionStorage cache. Returns cached value instantly if fresh. */
    async countClaimsCached(forceRefresh) {
      if (!forceRefresh) {
        var cached = readCountCache();
        if (cached != null) return cached;
      }
      return repo.countClaims();
    },

    clearCountCache: clearCountCache,

    async listClaimsPage(page) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      var from = (page || 0) * PAGE_SIZE;
      var result = await runRead(function () {
        return client
          .from('claims')
          .select('*')
          .order('claim_id', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
      });
      if (result && result.error) throw result.error;
      return normalizeRows(result && result.data);
    },

    async listClaims() {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');

      try {
        var result = await runRead(function () {
          return client
            .from('claims')
            .select('*')
            .order('claim_id', { ascending: false })
            .range(0, 1999);
        });
        if (result && !result.error && Array.isArray(result.data)) {
          var rows = normalizeRows(result.data);
          if (rows.length < 2000) {
            writeCountCache(rows.length);
            return rows;
          }
        }
      } catch (_) {}

      var all = [];
      for (var page = 0; page < MAX_PAGES; page++) {
        var pageRows = null;
        var attempts = 0;
        while (attempts < MAX_RETRIES) {
          try {
            pageRows = await repo.listClaimsPage(page);
            break;
          } catch (e) {
            attempts++;
            if (attempts >= MAX_RETRIES) throw e;
            await sleep(300 * attempts);
          }
        }
        all = all.concat(pageRows || []);
        if (!pageRows || pageRows.length < PAGE_SIZE) break;
      }
      writeCountCache(all.length);
      return all;
    },

    async getClaimVersion(claimId) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      var result = await runRead(function () {
        return client
          .from('claims')
          .select('claim_id,archived_at,last_updated,claim_status')
          .eq('claim_id', claimId)
          .maybeSingle();
      });
      if (result && result.error) throw result.error;
      return (result && result.data) || null;
    },

    async createClaim(command) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      clearCountCache();
      var result = await client.rpc('create_sdlg_claim', {
        p_claim: command.claim,
        p_status_history: command.statusHistory || []
      });
      if (result && result.error) throw result.error;
      var claimId = String((result && result.data) || '').trim();
      if (!claimId) throw new Error('Database tidak mengembalikan nomor claim setelah insert.');
      return claimId;
    },

    async updateClaim(command) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      var result = await client.rpc('update_sdlg_claim', {
        p_claim_id: command.claimId,
        p_claim: command.claim,
        p_status_history: command.statusHistory || []
      });
      if (result && result.error) throw result.error;
      return true;
    },

    async updateStatus(command) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      var result = await client.rpc('update_claim_status', {
        p_claim_id: command.claimId,
        p_status: command.status,
        p_status_date: command.statusDate,
        p_reason: command.reason
      });
      if (result && result.error) throw result.error;
      return true;
    },

    async getStatusHistory(claimId) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      var result = await runRead(function () {
        return client
          .from('claim_status_history')
          .select('*')
          .eq('claim_id', claimId)
          .order('status_date', { ascending: true })
          .order('created_at', { ascending: true });
      });
      if (result && result.error) throw result.error;
      return (result && result.data) || [];
    },

    async archiveClaim(claimId) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      clearCountCache();
      var result = await client.rpc('delete_sdlg_claim', { p_claim_id: claimId });
      if (result && result.error) throw result.error;
      return true;
    }
  };

  global.SDLG_REPOSITORY = repo;
  try {
    console.info('[SDLG] sdlg-repository.js v3 loaded (count cache + full list)');
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
