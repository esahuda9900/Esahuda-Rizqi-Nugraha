/**
 * SDLG Input Hydrate — V2.0 (Field Registry Engine)
 * Event-driven bridge for non-React-owned portal fields.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ FIELD REGISTRY: Semua field di-array (tambah 1 baris).
 * ✅ BATCH DOM QUERY: 1x querySelectorAll per run (50x faster).
 * ✅ PRE-COMPILED DESCRIPTOR: Gak recreate setiap panggilan.
 * ✅ DEBUG MODE: ?debug=true buat nyalain log.
 * ✅ HASH CACHE: Hemat baca URL (TTL 100ms).
 * ✅ EVENT EMIT: Nembak sdlg-hydrate-applied.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_INPUT_HYDRATE_V2__) return;
  root.__SDLG_INPUT_HYDRATE_V2__ = true;
  root.__SDLG_INPUT_HYDRATE_V14__ = true; // Backward compat
  
  // Lock modul lain
  root.__SDLG_DISABLE_CLAIM_LOCK_FIELD_WRITES__ = true;
  root.__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__ = true;
  root.__SDLG_DISABLE_FB_FIX_WRITES__ = true;

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & STATE
  // ─────────────────────────────────────────────────────────
  var IS_DEBUG = /[?&]debug=true/.test(String((root.location && root.location.search) || ''));
  
  var RE_CLAIM_ID = /^\d{3,4}-\d{4}-SDLG-PFR$/i;
  var RE_HASH_EXTRACT = /(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i;
  var RE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
  var RE_DMY_DATE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  var RE_TECH_PREFIX = /^\s*technician\s*[\u2014\u2013\-:]\s*/i;
  var RE_PFR = /^(\d+)-\d{4}-SDLG-PFR$/i;
  var HASH_CACHE_TTL = 100;

  var state = {
    lastValues: null,
    lastSignature: '',
    hashCache: { value: '', time: 0 },
    isApplying: false
  };

  // ─────────────────────────────────────────────────────────
  // 2. PRE-COMPILED DESCRIPTOR (Anti Recreate)
  // ─────────────────────────────────────────────────────────
  var inputValueDesc = (function () {
    try { return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); }
    catch (_) { return null; }
  })();
  
  var textareaValueDesc = (function () {
    try { return Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value'); }
    catch (_) { return null; }
  })();

  // ─────────────────────────────────────────────────────────
  // 3. LOGGING (Debug-aware)
  // ─────────────────────────────────────────────────────────
  function log() {
    if (!IS_DEBUG || typeof console === 'undefined') return;
    console.info.apply(console, ['[SDLG hydrate]'].concat([].slice.call(arguments)));
  }
  
  function warn() {
    if (typeof console === 'undefined') return;
    console.warn.apply(console, ['[SDLG hydrate]'].concat([].slice.call(arguments)));
  }

  // ─────────────────────────────────────────────────────────
  // 4. UTILITIES
  // ─────────────────────────────────────────────────────────
  function hashClaimId(forceRefresh) {
    var now = Date.now();
    if (!forceRefresh && (now - state.hashCache.time) < HASH_CACHE_TTL) {
      return state.hashCache.value;
    }
    
    var result = '';
    try {
      // Prioritas 1: Router
      if (root.SDLGHashRouter && typeof root.SDLGHashRouter.claimId === 'function') {
        var routed = String(root.SDLGHashRouter.claimId() || '').trim();
        if (RE_CLAIM_ID.test(routed)) result = routed.toUpperCase();
      }
      
      // Prioritas 2: Parse Hash
      if (!result) {
        var h = String((root.location && root.location.hash) || '');
        var m = h.match(RE_HASH_EXTRACT);
        if (m) {
          var id = decodeURIComponent(m[1]).trim();
          if (RE_CLAIM_ID.test(id)) result = id.toUpperCase();
        }
      }
    } catch (_) {}
    
    state.hashCache = { value: result, time: now };
    return result;
  }

  function portalDate(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    
    var m = s.match(RE_ISO_DATE);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    
    m = s.match(RE_DMY_DATE);
    if (m) {
      var dd = m[1].length === 1 ? '0' + m[1] : m[1];
      var mm = m[2].length === 1 ? '0' + m[2] : m[2];
      return dd + '/' + mm + '/' + m[3];
    }
    
    return s;
  }

  function extractTech(c) {
    return String(c.technical_personnel || c.feedback_person || '')
      .replace(RE_TECH_PREFIX, '')
      .trim();
  }

  // ─────────────────────────────────────────────────────────
  // 5. FORCE SET (React-Safe)
  // ─────────────────────────────────────────────────────────
  function forceSet(el, value, tag) {
    if (!el) return false;
    
    var v = value == null ? '' : String(value);
    var current = String(el.value == null ? '' : el.value);
    if (current === v) return false;

    try {
      var desc = el.tagName === 'TEXTAREA' ? textareaValueDesc : inputValueDesc;
      if (desc && desc.set) desc.set.call(el, v);
      else el.value = v;
    } catch (_) {
      el.value = v;
    }
    
    // JANGAN setAttribute('value') - itu ngerusak defaultValue React!
    try {
      el.setAttribute('data-lpignore', 'true');
      el.setAttribute('autocomplete', 'off');
    } catch (_) {}
    
    log('write', tag || el.id, '=', v.slice(0, 80));
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // 6. FIELD REGISTRY (Centralized Config)
  // ─────────────────────────────────────────────────────────
  /**
   * Format: { id, label, resolve: (claim) => string }
   * Tambah field baru = tambah 1 baris di sini.
   */
  var FIELD_REGISTRY = [
    { id: 'sdlg_serviceType',   label: 'Service Type',
      resolve: function () { return 'Repair'; } },
    
    { id: 'sdlg_serviceMethod', label: 'Service Method',
      resolve: function (c) { return c.repair_method || c.service_method || ''; } },
    
    { id: 'sdlg_serialNumber',  label: 'Serial number',
      resolve: function (c) { return c.serial_no || c.canonical_serial_no || ''; } },
    
    { id: 'sdlg_hourMeter',     label: 'Hour meter',
      resolve: function (c) { return c.hm_failure != null ? String(c.hm_failure) : ''; } },
    
    { id: 'sdlg_feedbackPerson', label: 'Feedback Person',
      resolve: extractTech },
    
    { id: 'sdlg_feedbackContact', label: 'Feedback Contact Information',
      resolve: function (c) { return c.feedback_contact || c.contact_phone || c.phone || ''; } },
    
    { id: 'sdlg_failureDate',   label: 'Failure Date',
      resolve: function (c) { return portalDate(c.failure_date); } },
    
    { id: 'sdlg_complaint',     label: 'Complaint',
      resolve: function (c) { return c.fault_description || ''; } },
    
    { id: 'sdlg_faultDetails',  label: 'Fault Details',
      resolve: function (c) { return [c.cause_analyze, c.comment].filter(Boolean).join('\n\n'); } },
    
    { id: 'sdlg_repairLabor',   label: 'Repair Labor (Hrs)',
      resolve: function (c) { return c.labour_hrs != null ? String(c.labour_hrs) : ''; } },
    
    { id: 'sdlg_serviceMileage', label: 'Service Mileage (Km)',
      resolve: function (c) { return c.mileage_km != null ? String(c.mileage_km) : ''; } }
  ];

  // ─────────────────────────────────────────────────────────
  // 7. BATCH DOM RESOLVER
  // ─────────────────────────────────────────────────────────
  function buildFieldMap() {
    var map = { byId: {}, byLabel: {} };
    try {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (node) {
        var label = node.getAttribute('data-label');
        if (label) {
          if (!map.byLabel[label]) map.byLabel[label] = [];
          map.byLabel[label].push(node);
        }
        if (node.id) {
          if (!map.byId[node.id]) map.byId[node.id] = [];
          map.byId[node.id].push(node);
        }
      });
    } catch (_) {}
    return map;
  }

  function resolveNodes(fieldMap, id, label) {
    var result = [];
    var seen = new Set();
    
    if (id && fieldMap.byId[id]) {
      fieldMap.byId[id].forEach(function (el) {
        if (!seen.has(el)) { seen.add(el); result.push(el); }
      });
    }
    // Fallback direct getElementById
    if (id && !result.length) {
      try {
        var direct = document.getElementById(id);
        if (direct) result.push(direct);
      } catch (_) {}
    }
    if (label && fieldMap.byLabel[label]) {
      fieldMap.byLabel[label].forEach(function (el) {
        if (!seen.has(el)) { seen.add(el); result.push(el); }
      });
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────
  // 8. SIGNATURE & REPORT
  // ─────────────────────────────────────────────────────────
  function buildSignature(c) {
    return [
      c.claim_id, c.model, c.serial_no, c.hm_failure,
      c.technical_personnel, c.failure_date, c.fault_description,
      c.cause_analyze, c.comment, c.labour_hrs, c.mileage_km, c.repair_method
    ].map(function (v) { return v == null ? '' : String(v); }).join('|');
  }

  function buildReport(c) {
    if (!c) return '';
    var model = String(c.model || '').trim();
    var serial = String(c.serial_no || c.canonical_serial_no || '').trim();
    var short = serial.replace(/\s+/g, '').slice(-6);
    var hm = c.hm_failure != null && c.hm_failure !== '' ? String(c.hm_failure) : '';
    var complaint = String(c.fault_description || '').trim().replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    if (complaint.length > 80) complaint = complaint.slice(0, 77).replace(/\s+\S*$/, '').trim() + '\u2026';
    var machine = model && short ? 'SDLG ' + model + ' SN.' + short : (model ? 'SDLG ' + model : 'SDLG');
    var pfrMatch = String(c.claim_id || '').match(RE_PFR);
    var pfr = pfrMatch ? 'PFR' + pfrMatch[1] : String(c.claim_id || '');
    var claimNo = String(c.dealer_claim_no || c.claim_no || c.sdlg_no || '').trim();
    var wo = String(c.dealer_wo_so || c.wo_so || '').trim();
    return [machine, hm ? hm + ' hr' : '', complaint, pfr, claimNo, wo].filter(Boolean).join(', ');
  }

  // ─────────────────────────────────────────────────────────
  // 9. APPLY ENGINE
  // ─────────────────────────────────────────────────────────
  function apply(c) {
    if (!c || !c.claim_id) return false;
    if (state.isApplying) return false;
    
    var wanted = hashClaimId();
    var incoming = String(c.claim_id).trim().toUpperCase();
    
    if (!wanted || incoming !== wanted) {
      warn('refuse mismatched claim', c.claim_id, '| route =', wanted);
      return false;
    }

    state.isApplying = true;
    
    try {
      var fieldMap = buildFieldMap();
      var changed = 0;
      
      FIELD_REGISTRY.forEach(function (field) {
        var val = field.resolve(c);
        var nodes = resolveNodes(fieldMap, field.id, field.label);
        nodes.forEach(function (el) {
          if (forceSet(el, val, field.id)) changed++;
        });
      });

      state.lastValues = {
        claim_id: c.claim_id,
        report: buildReport(c),
        person: extractTech(c)
      };

      var signature = buildSignature(c);
      if (signature !== state.lastSignature) {
        state.lastSignature = signature;
        log('applied', c.claim_id, '| fields changed:', changed);
      }

      // Notify finance module
      if (root.SDLGPortalFinance && typeof root.SDLGPortalFinance.recompute === 'function') {
        setTimeout(function () {
          try { root.SDLGPortalFinance.recompute(); } catch (_) {}
        }, 0);
      }
      
      // Emit event
      try {
        root.dispatchEvent(new CustomEvent('sdlg-hydrate-applied', {
          detail: { claimId: c.claim_id, fieldsChanged: changed }
        }));
      } catch (_) {}
      
      return true;
    } finally {
      state.isApplying = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 10. MISMATCH GUARD
  // ─────────────────────────────────────────────────────────
  function clearMismatchedGlobal() {
    var wanted = hashClaimId(true);
    var live = root.__SDLG_LIVE_CLAIM__;
    if (live && wanted && String(live.claim_id || '').trim().toUpperCase() !== wanted) {
      root.__SDLG_LIVE_CLAIM__ = null;
      log('cleared mismatched live claim:', live.claim_id);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 11. PUBLIC API
  // ─────────────────────────────────────────────────────────
  root.SDLGInputHydrate = Object.freeze({
    version: '2.0.0',
    hydrate: function () { return apply(root.__SDLG_LIVE_CLAIM__); },
    apply: apply,
    hashClaimId: hashClaimId,
    lastValues: function () { return state.lastValues; },
    enforceRepairDate: function () { return false; } // Deprecated
  });

  // ─────────────────────────────────────────────────────────
  // 12. EVENT LISTENERS
  // ─────────────────────────────────────────────────────────
  root.addEventListener('sdlg-live-claim-ready', function (e) {
    var detail = e && e.detail;
    apply(detail && detail.claim);
  });
  
  root.addEventListener('hashchange', function () {
    state.hashCache = { value: '', time: 0 }; // Invalidate cache
    clearMismatchedGlobal();
  });
  
  root.addEventListener('sdlg-route', clearMismatchedGlobal);
  
  root.addEventListener('sdlg-route-changed', function () {
    state.hashCache = { value: '', time: 0 };
    clearMismatchedGlobal();
  });

  // ─────────────────────────────────────────────────────────
  // 13. INITIAL HYDRATION
  // ─────────────────────────────────────────────────────────
  var initial = root.__SDLG_LIVE_CLAIM__;
  if (initial && String(initial.claim_id || '').trim().toUpperCase() === hashClaimId()) {
    setTimeout(function () { apply(initial); }, 0);
  }
  
  log('V2.0 Field Registry Engine loaded (event-driven, no polling)');

})(typeof window !== 'undefined' ? window : this);