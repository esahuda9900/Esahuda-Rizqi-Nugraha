/**
 * SDLG repository v4.2 — Performance Booster & VIN Lookup (RPC Version)
 */
(function (root) {
  'use strict';
  if (root.__SDLG_REPOSITORY_V42__) return;
  root.__SDLG_REPOSITORY_V42__ = true;

  var COUNT_CACHE_KEY = 'sdlg:claims-count:v3';
  var COUNT_CACHE_TTL_MS = 5 * 60 * 1000;
  var PAGE_SIZE = 50;

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
      root.sessionStorage.setItem(COUNT_CACHE_KEY, JSON.stringify({ count: count, at: Date.now() }));
    } catch (_) {}
  }

  try { root.sessionStorage.removeItem('sdlg:claims-count:v1'); } catch (_) {}
  try { root.sessionStorage.removeItem('sdlg:claims-count:v2'); } catch (_) {}

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
      var result = await client.from('claims').select('*').order('claim_id', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (result.error) throw result.error;
      return result.data || [];
    },

    async listClaimsHydrated() {
      try { return await repo.listClaimsPage(0); } catch (e) { return []; }
    },

    // ==========================================
    // VIN LOOKUP VIA RPC RESMI SUPABASE
    // ==========================================
    async lookupMachineVIN(model, serialNo) {
      var client = getClient();
      if (!client || !serialNo) return null;

      var cleanModel = model ? String(model).trim().toUpperCase() : null;
      var cleanSerial = String(serialNo).trim().toUpperCase();

      try {
        // Memanggil RPC sdlg_lookup_unit
        var res = await client.rpc('sdlg_lookup_unit', {
          p_serial: cleanSerial,
          p_model: cleanModel
        });

        if (res.error) {
          console.warn('[SDLG Repo] RPC VIN Lookup error:', res.error.message);
          return null;
        }

        // RPC biasanya mengembalikan object atau string. Kita handle keduanya.
        if (res.data) {
          if (typeof res.data === 'string') return res.data;
          return res.data.machine_build_no || res.data.indent_no || res.data.vin || null;
        }
        return null; 
      } catch (err) {
        console.warn('[SDLG Repo] RPC VIN Lookup failed:', err);
        return null;
      }
    }
  };

  root.SDLGRepository = repo;
  root.sdlgRepository = repo;
  try { console.info('[SDLG] sdlg-repository.js v4.2 loaded (RPC ready)'); } catch (_) {}
})(typeof window !== 'undefined' ? window : this);