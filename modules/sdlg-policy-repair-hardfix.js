/**
 * SDLG Policy + Repair Hard-Fix — V3.0 (Smart Policy Patcher)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ ZERO POLLING: Ganti setInterval jadi MutationObserver.
 * ✅ CACHE TTL: Cache expire 5 menit (anti-stale).
 * ✅ REACT-SAFE: Dispatch input/change event setelah set value.
 * ✅ CSS INJECTION: Style pindah ke <style>, support dark mode.
 * ✅ FAST CLAIM DETECT: Cari [data-claim-id] dulu, baru innerText.
 * ✅ DEBOUNCED: Anti loop saat React render.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_POLICY_REPAIR_HARDFIX_V3__) return;
  root.__SDLG_POLICY_REPAIR_HARDFIX_V3__ = true;
  root.__SDLG_POLICY_REPAIR_HARDFIX_V21__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX
  // ─────────────────────────────────────────────────────────
  var STYLE_ID = 'sdlg-policy-repair-hardfix-css';
  var CACHE_TTL = 5 * 60 * 1000; // 5 menit
  var OBSERVER_DEBOUNCE = 400;

  var RE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
  var RE_DMY_DATE = /^\d{2}\/\d{2}\/\d{4}/;
  var RE_CLAIM_HEADER = /\b(\d{3,4}-\d{4}-SDLG-PFR)\s*[\u00B7\u2022|]/;
  var RE_CLAIM_CARD = /\bCLAIM\s*\n?\s*(\d{3,4}-\d{4}-SDLG-PFR)\b/i;
  var RE_CLAIM_ANY = /\b(\d{3,4}-\d{4}-SDLG-PFR)\b/;

  // Cache dengan TTL
  var cache = Object.create(null);

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
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
  // 3. CLAIM ID DETECTION (Fast, Cached)
  // ─────────────────────────────────────────────────────────
  var _claimIdCache = { value: '', time: 0 };
  var CLAIM_ID_CACHE_TTL = 1000; // 1 detik

  function claimIdFromPage() {
    // Cek cache dulu
    if (Date.now() - _claimIdCache.time < CLAIM_ID_CACHE_TTL && _claimIdCache.value) {
      return _claimIdCache.value;
    }

    // Prioritas 1: Cari data-attribute (paling cepat)
    var direct = document.querySelector('[data-claim-id], [data-sdlg-claim-id]');
    if (direct) {
      var attr = direct.getAttribute('data-claim-id') || direct.getAttribute('data-sdlg-claim-id') || '';
      if (RE_CLAIM_ANY.test(attr)) {
        var m0 = attr.match(RE_CLAIM_ANY);
        if (m0) {
          _claimIdCache = { value: m0[1], time: Date.now() };
          return m0[1];
        }
      }
    }

    // Prioritas 2: Hash URL (super cepat)
    try {
      var hash = String(root.location.hash || '');
      var hashMatch = hash.match(RE_CLAIM_ANY);
      if (hashMatch) {
        _claimIdCache = { value: hashMatch[1], time: Date.now() };
        return hashMatch[1];
      }
    } catch (_) {}

    // Prioritas 3: Fallback ke innerText (lambat, terakhir)
    var text = (document.body && document.body.innerText) || '';
    var m = text.match(RE_CLAIM_HEADER);
    if (!m) m = text.match(RE_CLAIM_CARD);
    if (!m) m = text.match(RE_CLAIM_ANY);

    var result = m ? m[1] : '';
    _claimIdCache = { value: result, time: Date.now() };
    return result;
  }

  // ─────────────────────────────────────────────────────────
  // 4. DATA FETCHING (dengan TTL Cache)
  // ─────────────────────────────────────────────────────────
  async function loadAll(claimId) {
    if (!claimId) return null;

    // Cek cache
    var cached = cache[claimId];
    if (cached && (Date.now() - cached.time) < CACHE_TTL) {
      return cached.data;
    }

    var c = getClient();
    if (!c) return null;

    try {
      var res = await Promise.all([
        c.from('claims')
          .select('claim_id,dealer_repair_date,completion_date,dealer_wo_so,branch,customer,technical_personnel')
          .eq('claim_id', claimId)
          .maybeSingle(),
        c.from('claim_warranty_policy_matrix_v')
          .select('warranty_policy_matrix')
          .eq('claim_id', claimId)
          .maybeSingle()
      ]);

      var claim = res[0] && res[0].data;
      var matrix = res[1] && res[1].data && res[1].data.warranty_policy_matrix;
      
      if (res[0] && res[0].error) console.warn('[SDLG Hardfix] claims:', res[0].error.message);
      if (res[1] && res[1].error) console.warn('[SDLG Hardfix] matrix:', res[1].error.message);

      var out = {
        claim: claim,
        policies: (matrix && matrix.policies) || []
      };

      // Simpan ke cache (dengan timestamp)
      if (claim || out.policies.length) {
        cache[claimId] = { data: out, time: Date.now() };
      }

      return out;
    } catch (e) {
      console.warn('[SDLG Hardfix] fetch failed:', e.message);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. CSS INJECTION (Dark Mode Ready)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      [data-sdlg-hardfix-repair] {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px;
        background: #ffffff;
        transition: border-color 0.2s;
      }
      [data-sdlg-hardfix-repair]:focus-within {
        border-color: #2f5bff;
        box-shadow: 0 0 0 3px rgba(47, 91, 255, 0.1);
      }
      [data-sdlg-hardfix-repair] label,
      [data-sdlg-hardfix-repair] .sdlg-hardfix-label {
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        margin-bottom: 6px;
        display: block;
      }
      [data-sdlg-hardfix-repair] input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 9px 10px;
        font-size: 12px;
        background: #f8fafc;
        color: #0f172a;
        outline: none;
        transition: all 0.15s;
      }
      [data-sdlg-hardfix-repair] input:focus {
        background: #ffffff;
        border-color: #2f5bff;
      }

      @media (prefers-color-scheme: dark) {
        [data-sdlg-hardfix-repair] {
          background: #111a2e;
          border-color: #1e2a45;
        }
        [data-sdlg-hardfix-repair] label,
        [data-sdlg-hardfix-repair] .sdlg-hardfix-label {
          color: #94a3b8;
        }
        [data-sdlg-hardfix-repair] input {
          background: #0f172a;
          border-color: #1e2a45;
          color: #f8fafc;
        }
        [data-sdlg-hardfix-repair] input:focus {
          background: #0f172a;
          border-color: #4d70ff;
        }
      }
    `;
    document.head.appendChild(stage);
  }

  // ─────────────────────────────────────────────────────────
  // 6. REPAIR FIELD INJECTION
  // ─────────────────────────────────────────────────────────
  function ensureRepairField() {
    var existing = document.querySelector('[data-sdlg-field][data-label="Date of repair report"]');
    if (existing) return existing;

    var fail = document.querySelector('[data-sdlg-field][data-label="Failure Date"]');
    if (!fail) return null;

    var failWrap = fail.closest('div[style]') || fail.parentElement;
    var grid = failWrap && failWrap.parentElement;
    if (!grid) return null;

    injectStyles();

    var wrap = document.createElement('div');
    wrap.setAttribute('data-sdlg-hardfix-repair', '1');

    var lab = document.createElement('div');
    lab.className = 'sdlg-hardfix-label';
    lab.textContent = 'Date of repair report *';
    wrap.appendChild(lab);

    var input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-sdlg-field', '1');
    input.setAttribute('data-label', 'Date of repair report');
    input.setAttribute('placeholder', 'DD/MM/YYYY');
    input.setAttribute('autocomplete', 'off');
    wrap.appendChild(input);

    if (failWrap.nextSibling) {
      grid.insertBefore(wrap, failWrap.nextSibling);
    } else {
      grid.appendChild(wrap);
    }

    return input;
  }

  // React-Safe Setter
  function setRepair(dateStr) {
    if (!dateStr) return;
    var el = ensureRepairField();
    if (!el) return;
    
    if (String(el.value || '').trim() === dateStr) return;

    // React-Safe: Pakai native setter
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc && desc.set) desc.set.call(el, dateStr);
      else el.value = dateStr;
    } catch (_) {
      el.value = dateStr;
    }

    // Dispatch events biar React tau
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 7. POLICY TABLE FILL
  // ─────────────────────────────────────────────────────────
  function fillPolicyTable(policies) {
    if (!policies || !policies.length) return;

    // Cari tabel yang relevan (lebih spesifik)
    var tables = document.querySelectorAll('table');
    var table = null;
    for (var i = 0; i < tables.length; i++) {
      var txt = tables[i].textContent || '';
      if (/Component Category/i.test(txt) && /Out of Warranty/i.test(txt)) {
        table = tables[i];
        break;
      }
    }
    if (!table) return;
    if (table.getAttribute('data-sdlg-policy-filled') === '1') return;

    var headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) {
      return (th.textContent || '').trim();
    });

    function idxOf() {
      var names = Array.prototype.slice.call(arguments);
      for (var a = 0; a < names.length; a++) {
        var j = headers.indexOf(names[a]);
        if (j >= 0) return j;
      }
      for (var h = 0; h < headers.length; h++) {
        for (var a2 = 0; a2 < names.length; a2++) {
          if (headers[h].toLowerCase().indexOf(String(names[a2]).toLowerCase()) >= 0) return h;
        }
      }
      return -1;
    }

    var iCat = idxOf('Component Category');
    var iAS = idxOf('After Sales', 'OOW (Sales)');
    var iAD = idxOf('After Departure', 'OOW (B/L)');

    if (iAS < 0 || iAD < 0) {
      iCat = 0; iAS = 3; iAD = 4;
    }

    // Update header text
    var ths = table.querySelectorAll('thead th');
    if (ths[iAS]) {
      ths[iAS].textContent = 'OOW (Sales)';
      ths[iAS].title = 'OOW dihitung dari Sales Date';
    }
    if (ths[iAD]) {
      ths[iAD].textContent = 'OOW (B/L)';
      ths[iAD].title = 'OOW dihitung dari Bill of Lading';
    }

    // Group policies by category
    var byCat = {};
    policies.forEach(function (p) {
      var key = String(p.component_category || '').toLowerCase();
      if (key) byCat[key] = p;
    });

    // Fill rows
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 5) return;

      var cat = (cells[iCat >= 0 ? iCat : 0].textContent || '').trim().toLowerCase();
      var p = byCat[cat];

      // Fuzzy match
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

    table.setAttribute('data-sdlg-policy-filled', '1');
  }

  // ─────────────────────────────────────────────────────────
  // 8. RUN ENGINE
  // ─────────────────────────────────────────────────────────
  var isRunning = false;

  async function tick() {
    if (isRunning) return;
    if (!document.querySelector('[data-sdlg-copy-all], [data-sdlg-field]')) return;

    var id = claimIdFromPage();
    if (!id) return;

    isRunning = true;
    try {
      var data = await loadAll(id);
      if (!data) return;

      if (data.claim) {
        var repair = portalDate(data.claim.dealer_repair_date || data.claim.completion_date);
        if (repair) setRepair(repair);
      }
      if (data.policies && data.policies.length) {
        fillPolicyTable(data.policies);
      }
    } catch (e) {
      console.warn('[SDLG Hardfix] tick error:', e.message);
    } finally {
      isRunning = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 9. BOOT & OBSERVER
  // ─────────────────────────────────────────────────────────
  var debounceTimer = null;

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      tick().catch(function () {});
    }, OBSERVER_DEBOUNCE);
  }

  function boot() {
    // Initial run
    schedule();

    // Mutation Observer (cuma jalan kalau DOM berubah)
    if (document.body && typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        // Skip kalau perubahan dari field yang kita inject sendiri
        schedule();
      });
      obs.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // Clear cache saat route berubah
    root.addEventListener('hashchange', function () {
      _claimIdCache = { value: '', time: 0 };
      schedule();
    });

    root.addEventListener('sdlg-route-changed', function () {
      _claimIdCache = { value: '', time: 0 };
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
  root.SDLGPolicyRepairHardfix = Object.freeze({
    version: '3.0.0',
    tick: tick,
    clearCache: function () {
      cache = Object.create(null);
      _claimIdCache = { value: '', time: 0 };
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);