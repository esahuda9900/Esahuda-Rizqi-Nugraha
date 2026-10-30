/**
 * SDLG_REPOSITORY — data access layer
 * v3.2: full pagination (no hard 300 cap); active-only; safety max 100 pages (10k rows)
 */
(function (global) {
  'use strict';

  var PAGE_SIZE = 100;
  /** Safety ceiling only — not a product limit. Stops runaway loops. */
  var MAX_PAGES_SAFETY = 100;
  var MAX_RETRIES = 3;
  var COUNT_CACHE_KEY = 'sdlg:claims-count:v1';
  var COUNT_CACHE_TTL_MS = 5 * 60 * 1000;

  function getClient() {
    if (typeof global.getSdlgSupabase === 'function') {
      var c = global.getSdlgSupabase();
      if (c) return c;
    }
    return global.sdlgSupabase || global.supabaseClient || null;
  }

  function isDebug() {
    try {
      if (/[?&]debug=1(?:&|$)/.test(String(global.location && global.location.search))) return true;
      if (global.localStorage && global.localStorage.getItem('sdlg-debug') === '1') return true;
    } catch (_) {}
    return false;
  }

  function debugLog() {
    if (!isDebug()) return;
    try {
      console.info.apply(console, ['[SDLG repository]'].concat([].slice.call(arguments)));
    } catch (_) {}
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
      if (global.sessionStorage) {
        global.sessionStorage.setItem(COUNT_CACHE_KEY, JSON.stringify({ count: count, at: Date.now() }));
      }
    } catch (_) {}
  }

  function clearCountCache() {
    try {
      if (global.sessionStorage) global.sessionStorage.removeItem(COUNT_CACHE_KEY);
    } catch (_) {}
  }

  function activeClaimsQuery(client) {
    return client.from('claims').select('*').is('archived_at', null).order('claim_id', { ascending: false });
  }

  var repo = {
    PAGE_SIZE: PAGE_SIZE,

    async countClaims() {
      var client = getClient();
      if (!client) return 0;
      var result = await runRead(function () {
        return client.from('claims').select('*', { count: 'exact', head: true }).is('archived_at', null);
      });
      if (result && result.error) return 0;
      return result && typeof result.count === 'number' ? result.count : 0;
    },

    async countClaimsCached(forceRefresh) {
      if (!forceRefresh) {
        var cached = readCountCache();
        if (cached != null) return cached;
      }
      var count = await repo.countClaims();
      if (count >= 0) writeCountCache(count);
      return count;
    },

    clearCountCache: clearCountCache,

    async listClaimsPage(page) {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');
      var from = (page || 0) * PAGE_SIZE;
      var result = await runRead(function () {
        return activeClaimsQuery(client).range(from, from + PAGE_SIZE - 1);
      });
      if (result && result.error) throw result.error;
      return normalizeRows(result && result.data);
    },

    /**
     * Full list of active claims — pages until a short page or safety ceiling.
     * Yields between pages so the main thread stays responsive.
     */
    async listClaims() {
      var client = getClient();
      if (!client) throw new Error('Supabase client not ready');

      var all = [];
      for (var page = 0; page < MAX_PAGES_SAFETY; page++) {
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
        debugLog('page', page, 'rows', (pageRows && pageRows.length) || 0, 'total', all.length);
        if (!pageRows || pageRows.length < PAGE_SIZE) break;
        // yield to UI between full pages
        await sleep(0);
      }

      writeCountCache(all.length);
      debugLog('listClaims done', all.length);
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
      if (!command || !command.claimId || !command.claim || !command.claim._expected_last_updated) {
        throw new Error('Versi klaim tidak tersedia. Salin perubahan Anda sebelum memuat ulang klaim.');
      }
      var result = await client.rpc('update_sdlg_claim', {
        p_claim_id: command.claimId,
        p_claim: command.claim,
        p_status_history: command.statusHistory || []
      });
      if (!result || result.error || result.status >= 400) {
        var error = new Error((result && result.error && result.error.message) || 'Respons penyimpanan tidak dapat dikonfirmasi.');
        error.code = result && result.error && result.error.code;
        error.status = result && result.status;
        throw error;
      }
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
  global.SDLGRepository = repo;
  global.sdlgRepository = repo;
  debugLog('v3.2 ready (full pagination, active-only)');
})(typeof window !== 'undefined' ? window : globalThis);
