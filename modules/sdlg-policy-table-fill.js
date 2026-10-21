/**
 * SDLG Policy Table Fill — V3.0 (Smart Policy Table Filler)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ ZERO POLLING: Ganti setInterval jadi MutationObserver.
 * ✅ CACHE TTL: Data expire 5 menit (anti-stale).
 * ✅ IDEMPOTENT: Tabel gak diproses ulang (flag data-filled).
 * ✅ REACT-SAFE: Dispatch event setelah update tabel.
 * ✅ FAST CLAIM DETECT: data-attr → hash → NavState → innerText.
 * ✅ ROUTE INVALIDATION: Cache di-clear saat pindah halaman.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_POLICY_TABLE_FILL_V3__) return;
  root.__SDLG_POLICY_TABLE_FILL_V3__ = true;
  root.__SDLG_POLICY_TABLE_FILL_V11__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX
  // ─────────────────────────────────────────────────────────
  var CACHE_TTL = 5 * 60 * 1000; // 5 menit
  var OBSERVER_DEBOUNCE = 400;
  var CLAIM_ID_CACHE_TTL = 1000;

  var RE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
  var RE_DMY_DATE = /^\d{2}\/\d{2}\/\d{4}/;
  var RE_CLAIM_HEADER = /\b(\d{3,4}-\d{4}-SDLG-PFR)\s*[\u00B7\u2022|]/;
  var RE_CLAIM_ANY = /\b(\d{3,4}-\d{4}-SDLG-PFR)\b/;

  // ─────────────────────────────────────────────────────────
  // 2. STATE & CACHE
  // ─────────────────────────────────────────────────────────
  var policyCache = Object.create(null);   // { claimId: { data, time } }
  var claimIdCache = { value: '', time: 0 };
  var isRunning = false;
  var debounceTimer = null;

  // ─────────────────────────────────────────────────────────
  // 3. UTILITIES
  // ─────────────────────────────────────────────────────────
  function portalDate(value) {
    if (value == null || value === '') return '';
    var s = String(value).trim();
    var m = s.match(RE_ISO_DATE);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    if (RE_DMY_DATE.test(s)) return s.slice(0, 10);
    return s;
  }

  function getClient() {
    if (typeof root.getSdlgSupabase === 'function') {
      var c = root.getSdlgSupabase();
      if (c && c.from) return c;
    }
    return (root.sdlgSupabase && root.sdlgSupabase.from) ? root.sdlgSupabase : null;
  }

  // ─────────────────────────────────────────────────────────
  // 4. FAST CLAIM ID DETECTION
  // ─────────────────────────────────────────────────────────
  function getClaimId() {
    // Cache 1 detik (biar gak baca URL 10x per render)
    if (Date.now() - claimIdCache.time < CLAIM_ID_CACHE_TTL && claimIdCache.value) {
      return claimIdCache.value;
    }

    var result = '';

    // 1. Prioritas: SDLGPortalEnrich (kalau ada)
    try {
      if (root.SDLGPortalEnrich && typeof root.SDLGPortalEnrich.getSelectedClaimId === 'function') {
        var id = root.SDLGPortalEnrich.getSelectedClaimId();
        if (id && RE_CLAIM_ANY.test(id)) {
          var m0 = id.match(RE_CLAIM_ANY);
          if (m0) result = m0[1];
        }
      }
    } catch (_) {}

    // 2. Router Hash
    if (!result) {
      try {
        if (root.SDLGHashRouter && typeof root.SDLGHashRouter.claimId === 'function') {
          var routed = String(root.SDLGHashRouter.claimId() || '').trim();
          if (RE_CLAIM_ANY.test(routed)) {
            var m1 = routed.match(RE_CLAIM_ANY);
            if (m1) result = m1[1];
          }
        }
      } catch (_) {}
    }

    // 3. Manual hash parse
    if (!result) {
      try {
        var hash = String(root.location.hash || '');
        var hashMatch = hash.match(RE_CLAIM_ANY);
        if (hashMatch) result = hashMatch[1];
      } catch (_) {}
    }

    // 4. data-attribute di DOM (paling cepat kalau ada)
    if (!result) {
      var el = document.querySelector('[data-claim-id], [data-sdlg-claim-id]');
      if (el) {
        var attr = el.getAttribute('data-claim-id') || el.getAttribute('data-sdlg-claim-id') || '';
        var m2 = attr.match(RE_CLAIM_ANY);
        if (m2) result = m2[1];
      }
    }

    // 5. Fallback: innerText scan (lambat, terakhir)
    if (!result) {
      var text = (document.body && document.body.innerText) || '';
      var m3 = text.match(RE_CLAIM_HEADER) || text.match(RE_CLAIM_ANY);
      if (m3) result = m3[1];
    }

    claimIdCache = { value: result, time: Date.now() };
    return result;
  }

  // ─────────────────────────────────────────────────────────
  // 5. DATA FETCHING (dengan TTL Cache)
  // ─────────────────────────────────────────────────────────
  async function loadPolicies(claimId) {
    if (!claimId) return null;

    // Cek cache (dengan TTL)
    var cached = policyCache[claimId];
    if (cached && (Date.now() - cached.time) < CACHE_TTL) {
      return cached.data;
    }

    var client = getClient();
    if (!client) return null;

    try {
      var res = await client
        .from('claim_warranty_policy_matrix_v')
        .select('warranty_policy_matrix')
        .eq('claim_id', claimId)
        .maybeSingle();

      if (res && res.error) {
        console.warn('[SDLG PolicyTable] Fetch error:', res.error.message);
        return null;
      }

      if (res && res.data && res.data.warranty_policy_matrix) {
        var policies = res.data.warranty_policy_matrix.policies || [];
        // Simpan ke cache dengan timestamp
        policyCache[claimId] = { data: policies, time: Date.now() };
        return policies;
      }
    } catch (e) {
      console.warn('[SDLG PolicyTable] Exception:', e.message);
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────
  // 6. FIND & FILL POLICY TABLE
  // ─────────────────────────────────────────────────────────
  function findPolicyTable() {
    var tables = document.querySelectorAll('table:not([data-sdlg-policy-filled])');
    for (var i = 0; i < tables.length; i++) {
      var txt = tables[i].textContent || '';
      if (/Component Category/i.test(txt) && /Out of Warranty/i.test(txt)) {
        return tables[i];
      }
    }
    return null;
  }

  function fillPolicyTable(policies) {
    if (!policies || !policies.length) return;

    var table = findPolicyTable();
    if (!table) return;

    // Kumpulin headers sekali aja
    var ths = table.querySelectorAll('thead th');
    var headers = Array.prototype.map.call(ths, function (th) {
      return (th.textContent || '').trim();
    });

    function idxOf() {
      var names = Array.prototype.slice.call(arguments);
      // Exact match dulu
      for (var a = 0; a < names.length; a++) {
        var j = headers.indexOf(names[a]);
        if (j >= 0) return j;
      }
      // Fuzzy match
      for (var h = 0; h < headers.length; h++) {
        var headerLower = headers[h].toLowerCase();
        for (var a2 = 0; a2 < names.length; a2++) {
          if (headerLower.indexOf(String(names[a2]).toLowerCase()) >= 0) return h;
        }
      }
      return -1;
    }

    var iCat = idxOf('Component Category');
    var iAS = idxOf('After Sales', 'OOW (Sales)');
    var iAD = idxOf('After Departure', 'OOW (B/L)');

    // Fallback ke posisi default
    if (iAS < 0 || iAD < 0) {
      iCat = 0; iAS = 3; iAD = 4;
    }

    // Update header text + tooltip
    if (ths[iAS]) {
      ths[iAS].textContent = 'OOW (Sales)';
      ths[iAS].title = 'OOW dihitung dari Sales Date';
    }
    if (ths[iAD]) {
      ths[iAD].textContent = 'OOW (B/L)';
      ths[iAD].title = 'OOW dihitung dari Bill of Lading';
    }

    // Group policies by category (lowercase key)
    var byCat = {};
    policies.forEach(function (p) {
      var key = String(p.component_category || '').toLowerCase().trim();
      if (key) byCat[key] = p;
    });

    // Fill rows
    var rows = table.querySelectorAll('tbody tr');
    rows.forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 5) return;

      var cat = (cells[iCat >= 0 ? iCat : 0].textContent || '').trim().toLowerCase();
      var p = byCat[cat];

      // Fuzzy match kalau gak ketemu exact
      if (!p) {
        Object.keys(byCat).forEach(function (k) {
          if (!p && (cat.indexOf(k) >= 0 || k.indexOf(cat) >= 0)) p = byCat[k];
        });
      }
      if (!p) return;

      var salesExp = portalDate(p.sales_expiry_date || p.after_sales_expiry_date);
      var blExp = portalDate(p.bill_of_lading_expiry_date || p.after_departure_expiry_date);

      if (salesExp && cells[iAS]) cells[iAS].textContent = salesExp;
      if (blExp && cells[iAD]) cells[iAD].textContent = blExp;
    });

    // Tandai biar gak diproses ulang
    table.setAttribute('data-sdlg-policy-filled', '1');

    // Notify React biar tau tabelnya udah di-update
    try {
      table.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 7. RUN ENGINE
  // ─────────────────────────────────────────────────────────
  async function enhance() {
    if (isRunning) return;

    // Skip cepat: gak ada tabel policy & gak ada form
    if (!document.querySelector('table, [data-sdlg-field]')) return;

    var claimId = getClaimId();
    if (!claimId) return;

    isRunning = true;
    try {
      var policies = await loadPolicies(claimId);
      if (policies && policies.length) {
        fillPolicyTable(policies);
      }
    } catch (e) {
      console.warn('[SDLG PolicyTable] Enhance error:', e.message);
    } finally {
      isRunning = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 8. SMART SCHEDULER (Debounced)
  // ─────────────────────────────────────────────────────────
  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      enhance().catch(function () {});
    }, OBSERVER_DEBOUNCE);
  }

  // ─────────────────────────────────────────────────────────
  // 9. BOOT & OBSERVER
  // ─────────────────────────────────────────────────────────
  function boot() {
    // Initial run
    schedule();

    // Mutation Observer (cuma kalau DOM berubah)
    if (document.body && typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(schedule);
      obs.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // Route change → invalidate cache
    root.addEventListener('hashchange', function () {
      claimIdCache = { value: '', time: 0 };
      schedule();
    });

    root.addEventListener('sdlg-route-changed', function () {
      claimIdCache = { value: '', time: 0 };
      schedule();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 10. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  root.SDLGPolicyTableFill = Object.freeze({
    version: '3.0.0',
    enhance: enhance,
    refresh: schedule,
    clearCache: function () {
      policyCache = Object.create(null);
      claimIdCache = { value: '', time: 0 };
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);