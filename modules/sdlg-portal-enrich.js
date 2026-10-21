/**
 * SDLG Portal Enrich — V2.0 (Smart Enrich Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO POLLING: MutationObserver ganti setInterval.
 * ✅ REACT-SAFE: Native setter biar React ngedeteksi.
 * ✅ BATCH LOOKUP: Map biar O(1) lookup.
 * ✅ CACHE TTL: Data expire 5 menit.
 * ✅ SMART RETRY: Ganti setTimeout hack dengan retry rapi.
 * ✅ FAST CLAIM DETECT: Hash → data-attr → select → innerText.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_PORTAL_ENRICH_V2__) return;
  root.__SDLG_PORTAL_ENRICH_V2__ = true;
  root.__SDLG_PORTAL_ENRICH_V14__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX
  // ─────────────────────────────────────────────────────────
  var CACHE_TTL = 5 * 60 * 1000; // 5 menit
  var OBSERVER_DEBOUNCE = 400;
  var MAX_RETRY = 5;
  var RETRY_DELAY = 300;

  var RE_CLAIM_HEADER = /\b(\d{3,4}-\d{4}-SDLG-PFR)\s*[\u00B7\u2022|]/;
  var RE_CLAIM_CARD = /\bCLAIM\s+(\d{3,4}-\d{4}-SDLG-PFR)\b/i;
  var RE_CLAIM_ANY = /\b(\d{3,4}-\d{4}-SDLG-PFR)\b/;
  var RE_CLAIM_EXACT = /^\d{3,4}-\d{4}-SDLG-PFR$/;
  var RE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
  var RE_DMY_DATE = /^\d{2}\/\d{2}\/\d{4}/;
  var RE_HM_CLEAN = /\s*(hr|hrs|hours).*$/i;

  // ─────────────────────────────────────────────────────────
  // 2. STATE
  // ─────────────────────────────────────────────────────────
  var claimCache = Object.create(null);
  var isRunning = false;
  var debounceTimer = null;

  // Native setter (React-safe)
  var inputValueSetter = (function () {
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      return desc && desc.set ? desc.set : null;
    } catch (_) { return null; }
  })();

  // ─────────────────────────────────────────────────────────
  // 3. UTILITIES
  // ─────────────────────────────────────────────────────────
  function formatDateDDMMYYYY(value) {
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
  function getSelectedClaimId() {
    var result = '';

    // 1. Prioritas: Router Hash
    try {
      if (root.SDLGHashRouter && typeof root.SDLGHashRouter.claimId === 'function') {
        var routed = String(root.SDLGHashRouter.claimId() || '').trim();
        if (RE_CLAIM_EXACT.test(routed)) return routed;
      }
    } catch (_) {}

    // 2. Manual hash parse
    try {
      var hashMatch = String(root.location.hash || '').match(RE_CLAIM_ANY);
      if (hashMatch) return hashMatch[1];
    } catch (_) {}

    // 3. data-attribute (kalau ada)
    var el = document.querySelector('[data-claim-id], [data-sdlg-claim-id]');
    if (el) {
      var attr = el.getAttribute('data-claim-id') || el.getAttribute('data-sdlg-claim-id') || '';
      var m0 = attr.match(RE_CLAIM_ANY);
      if (m0) return m0[1];
    }

    // 4. Select option
    var sels = document.querySelectorAll('select');
    for (var i = 0; i < sels.length; i++) {
      var v = String(sels[i].value || '').trim();
      if (RE_CLAIM_EXACT.test(v)) return v;
      var opt = sels[i].selectedOptions && sels[i].selectedOptions[0];
      if (opt) {
        var om = String(opt.textContent || '').match(RE_CLAIM_ANY);
        if (om) return om[1];
      }
    }

    // 5. Fallback: innerText (lambat, terakhir)
    var scope = document.querySelector('.sdlg-input-helper-page') || document.body;
    var text = (scope && scope.innerText) || '';
    var m = text.match(RE_CLAIM_HEADER) || text.match(RE_CLAIM_CARD) || text.match(RE_CLAIM_ANY);
    return m ? m[1] : '';
  }

  // ─────────────────────────────────────────────────────────
  // 5. DOM FIELD LOOKUP (Batch)
  // ─────────────────────────────────────────────────────────
  function buildFieldMap() {
    var map = new Map();
    document.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
      var label = el.getAttribute('data-label') || '';
      if (label && !map.has(label)) map.set(label, el);
    });
    return map;
  }

  function findFieldByLabel(map, label) {
    return map.get(label) || null;
  }

  // ─────────────────────────────────────────────────────────
  // 6. REACT-SAFE FIELD WRITER
  // ─────────────────────────────────────────────────────────
  function setField(map, label, value) {
    var el = findFieldByLabel(map, label);
    if (!el || value == null || value === '') return false;

    var strValue = String(value).trim();
    if (String(el.value || '').trim() === strValue) return true; // udah sama

    try {
      // React-Safe: pakai native setter
      if (inputValueSetter && el.tagName === 'INPUT') {
        inputValueSetter.call(el, strValue);
      } else {
        el.value = strValue;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) {
      try {
        el.value = strValue;
        return true;
      } catch (_) { return false; }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 7. DATA FETCHING (dengan TTL Cache)
  // ─────────────────────────────────────────────────────────
  var CLAIM_COLS = 'claim_id,dealer_repair_date,completion_date,dealer_wo_so,branch,customer,model,serial_no,hm_failure,fault_description,dealer_claim_no,technical_personnel';

  async function loadClaim(claimId) {
    if (!claimId) return null;

    // Cek cache
    var cached = claimCache[claimId];
    if (cached && (Date.now() - cached.time) < CACHE_TTL) {
      return cached.data;
    }

    var client = getClient();
    if (!client) return null;

    try {
      var res = await client
        .from('claims')
        .select(CLAIM_COLS)
        .eq('claim_id', claimId)
        .maybeSingle();

      if (res && res.error) {
        console.warn('[SDLG Enrich] Fetch error:', res.error.message);
        return null;
      }

      if (res && res.data) {
        claimCache[claimId] = { data: res.data, time: Date.now() };
        return res.data;
      }
    } catch (e) {
      console.warn('[SDLG Enrich] Exception:', e.message);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────
  // 8. REPORT NAME BUILDER
  // ─────────────────────────────────────────────────────────
  function buildReportName(row) {
    var model = String(row.model || '').trim();
    var sn = String(row.serial_no || '').replace(/\s+/g, '');
    var snShort = sn.slice(-6);
    var hm = row.hm_failure != null ? String(row.hm_failure).replace(RE_HM_CLEAN, '') : '';
    var complaint = String(row.fault_description || '').trim().replace(/[\r\n]+/g, ' ');
    var claimLabel = row.claim_id || 'Claim-';
    var dealerClaim = String(row.dealer_claim_no || '').trim();
    var wo = String(row.dealer_wo_so || '').trim() || 'WO-';

    var parts = [
      model && snShort ? ('SDLG ' + model + ' SN.' + snShort) : (model || 'SDLG'),
      hm ? (hm + ' hr') : 'HM.-',
      complaint || 'Complaint -',
      claimLabel
    ];

    if (dealerClaim) parts.push(dealerClaim);
    parts.push(wo);

    return parts.filter(Boolean).join(', ');
  }

  function applyReportName(full) {
    if (!full) return;
    var page = document.querySelector('.sdlg-input-helper-page') || document.body;
    var cards = page.querySelectorAll('.card, [class*="card"]');

    for (var c = 0; c < cards.length; c++) {
      var cardText = cards[c].innerText || '';
      if (!/Report Naming|Nama Report/i.test(cardText)) continue;

      var divs = cards[c].querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var tx = (divs[i].textContent || '').trim();
        if (/^SDLG\s+/i.test(tx) && tx.length > 12) {
          divs[i].setAttribute('title', full);
          if (tx.indexOf('\u2026') >= 0 || tx.indexOf('...') >= 0 || tx.length < full.length * 0.85) {
            divs[i].textContent = full;
          }
          return;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 9. RETRY HELPER (ganti setTimeout hack)
  // ─────────────────────────────────────────────────────────
  function trySetFieldWithRetry(map, label, value, retries) {
    retries = retries || 0;
    
    if (setField(map, label, value)) return; // Berhasil
    if (retries >= MAX_RETRY) return; // Nyerah

    setTimeout(function () {
      var newMap = buildFieldMap();
      trySetFieldWithRetry(newMap, label, value, retries + 1);
    }, RETRY_DELAY);
  }

  // ─────────────────────────────────────────────────────────
  // 10. MAIN ENRICH LOGIC
  // ─────────────────────────────────────────────────────────
  async function enrich() {
    if (isRunning) return;
    if (!document.querySelector('[data-sdlg-copy-all], [data-sdlg-field]')) return;

    var claimId = getSelectedClaimId();
    if (!claimId) return;

    isRunning = true;
    try {
      var row = await loadClaim(claimId);
      if (!row) return;

      // Build field map SEKALI (bukan loop per field)
      var map = buildFieldMap();

      // 1. Date of repair report
      var repair = formatDateDDMMYYYY(row.dealer_repair_date || row.completion_date || '');
      if (repair) {
        trySetFieldWithRetry(map, 'Date of repair report', repair, 0);
      }

      // 2. Machine Location
      var wo = String(row.dealer_wo_so || '').trim() || 'WO-';
      var branch = String(row.branch || '').trim();
      var customer = String(row.customer || '').trim();
      var loc = [wo, branch, customer].filter(Boolean).join(' ');
      if (loc) setField(map, 'Machine Location', loc);

      // 3. Feedback Person
      var tech = String(row.technical_personnel || '').trim();
      if (tech && !/^unknown$/i.test(tech)) {
        setField(map, 'Feedback Person', tech);
      }

      // 4. Report Name
      applyReportName(buildReportName(row));

    } catch (e) {
      console.warn('[SDLG Enrich] Error:', e.message);
    } finally {
      isRunning = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 11. SCHEDULER & OBSERVER
  // ─────────────────────────────────────────────────────────
  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      enrich().catch(function () {});
    }, OBSERVER_DEBOUNCE);
  }

  function boot() {
    schedule();

    // MutationObserver (cuma jalan kalau DOM berubah)
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var obs = new MutationObserver(schedule);
      obs.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // Clear cache on route change
    root.addEventListener('hashchange', function () {
      schedule();
    });

    root.addEventListener('sdlg-route-changed', function () {
      schedule();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 12. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  root.SDLGPortalEnrich = Object.freeze({
    version: '2.0.0',
    enrich: enrich,
    refresh: schedule,
    getSelectedClaimId: getSelectedClaimId,
    formatDateDDMMYYYY: formatDateDDMMYYYY,
    clearCache: function () {
      claimCache = Object.create(null);
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);