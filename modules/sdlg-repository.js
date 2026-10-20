/**
 * SDLG repository v4.4 — Debugging Edition
 */
(function (root) {
  'use strict';
  if (root.__SDLG_REPOSITORY_V44__) return;
  root.__SDLG_REPOSITORY_V44__ = true;

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

  function normalizeModel(m) {
    if (!m) return '';
    var s = String(m).toUpperCase().replace(/SDLG/gi, '').trim();
    s = s.replace(/\s+/g, '');
    if (/^\d/.test(s)) s = 'L' + s;
    return s;
  }

  var repo = {
    async countClaims() { /* ... */ },
    async countClaimsCached(forceRefresh) { /* ... */ },
    async listClaimsPage(page) { /* ... */ },
    async listClaimsHydrated() { /* ... */ },

    async lookupMachineVIN(model, serialNo) {
      var client = getClient();
      if (!client || !serialNo) return null;

      var cleanSerial = String(serialNo).trim().toUpperCase();
      var normalizedModel = normalizeModel(model);

      console.log('[SDLG Repo] Mencoba RPC ke Supabase...');
      console.log('[SDLG Repo] Parameter -> p_serial:', cleanSerial, '| p_model:', normalizedModel);

      try {
        var res = await client.rpc('sdlg_lookup_unit', {
          p_serial: cleanSerial,
          p_model: normalizedModel || null
        });

        if (res.error) {
          console.warn('[SDLG Repo] RPC VIN Lookup error:', res.error.message);
          return null;
        }

        // LOG HASIL MENTAH DARI DATABASE
        console.log('[SDLG Repo] Hasil RPC Mentah dari DB:', res.data);

        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          return res.data[0].serial_no || null;
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
  try { console.info('[SDLG] sdlg-repository.js v4.4 loaded (Debug)'); } catch (_) {}
})(typeof window !== 'undefined' ? window : this);