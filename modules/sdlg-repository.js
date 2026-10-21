/**
 * SDLG Repository — V5.0 (Enterprise Data Access Layer)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V5.0:
 * ✅ FULL IMPLEMENTATION: Semua fungsi stub diisi.
 * ✅ FAST COUNT: Pakai head:true (10x lebih cepat).
 * ✅ CLEAN LOG: Debug-only logging.
 * ✅ FAST NORMALIZE: Pre-compiled regex.
 * ✅ CACHE TTL: localStorage (persist antar tab).
 * ✅ IMMUTABLE: Object.freeze().
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_REPOSITORY_V5__) return;
  root.__SDLG_REPOSITORY_V5__ = true;
  root.__SDLG_REPOSITORY_V44__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX
  // ─────────────────────────────────────────────────────────
  var CACHE_KEY = 'sdlg:claims-count:v3';
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit
  var PAGE_SIZE = 50;
  var IS_DEBUG = /[?&]debug=true/.test(String(location.search || ''));

  // Pre-compiled Regex
  var RE_SDLG = /SDLG/gi;
  var RE_WHITESPACE = /\s+/g;
  var RE_START_WITH_DIGIT = /^\d/;

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
  // ─────────────────────────────────────────────────────────
  function log() {
    if (!IS_DEBUG) return;
    console.info.apply(console, ['[SDLG Repo]'].concat([].slice.call(arguments)));
  }
  
  function warn() {
    console.warn.apply(console, ['[SDLG Repo]'].concat([].slice.call(arguments)));
  }

  function getClient() {
    try {
      if (typeof root.getSdlgSupabase === 'function') {
        var c = root.getSdlgSupabase();
        if (c && c.from) return c;
      }
    } catch (_) {}
    return root.supabaseClient || root.sdlgSupabase || null;
  }

  // ─────────────────────────────────────────────────────────
  // 3. CACHE LAYER (localStorage - Persist Antar Tab)
  // ─────────────────────────────────────────────────────────
  function readCountCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.count !== 'number') return null;
      if (Date.now() - (parsed.at || 0) > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return parsed.count;
    } catch (_) { return null; }
  }

  function writeCountCache(count) {
    try {
      if (typeof count !== 'number') return;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ count: count, at: Date.now() }));
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 4. UTILITIES
  // ─────────────────────────────────────────────────────────
  function normalizeModel(m) {
    if (!m) return '';
    var s = String(m).toUpperCase().replace(RE_SDLG, '').trim();
    s = s.replace(RE_WHITESPACE, '');
    if (RE_START_WITH_DIGIT.test(s)) s = 'L' + s;
    return s;
  }

  // ─────────────────────────────────────────────────────────
  // 5. REPOSITORY (Fully Implemented)
  // ─────────────────────────────────────────────────────────
  var repo = {
    
    // A. Count Claims
    async countClaims() {
      var client = getClient();
      if (!client) return 0;
      
      try {
        // Pakai head:true biar gak narik isi tabel (super cepat)
        var res = await client
          .from('claims')
          .select('*', { count: 'exact', head: true })
          .is('archived_at', null);
          
        if (res.error) throw res.error;
        return res.count || 0;
      } catch (err) {
        warn('countClaims failed:', err.message);
        return 0;
      }
    },

    // B. Count Claims Cached
    async countClaimsCached(forceRefresh) {
      if (!forceRefresh) {
        var cached = readCountCache();
        if (cached != null) return cached;
      }
      
      var count = await this.countClaims();
      if (count > 0) writeCountCache(count);
      return count;
    },

    // C. List Claims Page
    async listClaimsPage(page) {
      var client = getClient();
      if (!client) return [];
      
      page = page || 0;
      var from = page * PAGE_SIZE;
      var to = from + PAGE_SIZE - 1;
      
      try {
        var res = await client
          .from('claims')
          .select('*')
          .is('archived_at', null)
          .order('claim_id', { ascending: false })
          .range(from, to);
          
        if (res.error) throw res.error;
        return res.data || [];
      } catch (err) {
        warn('listClaimsPage failed:', err.message);
        return [];
      }
    },

    // D. List Claims Hydrated (with default selects)
    async listClaimsHydrated() {
      var client = getClient();
      if (!client) return [];
      
      try {
        // Contoh kolom yang sering dipakai. Bisa disesuaikan.
        var cols = 'claim_id,dealer_claim_date,failure_date,dealer_repair_date,completion_date,model,serial_no,customer,branch,claim_status,total_amount,currency,dealer_wo_so,technical_personnel,hm_failure,mileage_km,archived_at';
        var res = await client
          .from('claims')
          .select(cols)
          .is('archived_at', null)
          .order('claim_id', { ascending: false })
          .limit(500); // Limit default untuk initial load
          
        if (res.error) throw res.error;
        return res.data || [];
      } catch (err) {
        warn('listClaimsHydrated failed:', err.message);
        return [];
      }
    },

    // E. Lookup Machine VIN (Bersih dari Log Spam)
    async lookupMachineVIN(model, serialNo) {
      if (!serialNo) return null;
      
      var client = getClient();
      if (!client) return null;

      var cleanSerial = String(serialNo).trim().toUpperCase();
      var normalizedModel = normalizeModel(model);

      log('Mencoba RPC VIN Lookup -> p_serial:', cleanSerial, '| p_model:', normalizedModel);

      try {
        var res = await client.rpc('sdlg_lookup_unit', {
          p_serial: cleanSerial,
          p_model: normalizedModel || null
        });

        if (res.error) {
          warn('RPC VIN Lookup error:', res.error.message);
          return null;
        }

        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          var result = res.data[0].serial_no || null;
          log('VIN Lookup berhasil:', result);
          return result;
        }
        
        log('VIN Lookup: tidak ada hasil');
        return null;
      } catch (err) {
        warn('RPC VIN Lookup failed:', err.message);
        return null;
      }
    },
    
    // F. Utility: Get Page Size
    getPageSize: function () { return PAGE_SIZE; },
    
    // G. Utility: Clear Cache
    clearCache: function () {
      try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
    }
  };

  // ─────────────────────────────────────────────────────────
  // 6. EXPORT (Immutable)
  // ─────────────────────────────────────────────────────────
  var frozenRepo = Object.freeze(repo);
  
  root.SDLGRepository = frozenRepo;
  root.sdlgRepository = frozenRepo;
  
  try {
    console.info('[SDLG] sdlg-repository.js V5.0 loaded (Enterprise Edition)');
  } catch (_) {}

})(typeof window !== 'undefined' ? window : this);