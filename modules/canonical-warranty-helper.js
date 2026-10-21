/**
 * SDLG Auto-Hydrate — V2.0 (Smart Hydration Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE:
 * ✅ PERFORMANCE: Cache form fields, gak scan DOM berulang kali.
 * ✅ CONFIGURATION: Semua mapping form dikumpulin di 1 tempat.
 * ✅ SAFE OVERWRITE: Hanya nimpa kalau form kosong atau dipaksa.
 * ✅ SMART FETCH: Cuma nembak DB kalau ID-nya beda.
 * ✅ DEBOUNCE: Anti-lag pas nunggu perubahan DOM.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI DATABASE
  // ─────────────────────────────────────────────────────────
  var CLAIM_SELECT = [
    'claim_id','model','serial_no','customer','repair_method','technical_personnel',
    'causing_part_no','causing_part_desc','failure_part_location','fault_description',
    'cause_analyze','comment','parts','hm_failure','hm_completion','sales_date',
    'failure_date','dealer_repair_date','completion_date','dealer_claim_date',
    'labour_amount','mileage_amount','other_amount','total_amount','mileage_km'
  ].join(',');

  // ─────────────────────────────────────────────────────────
  // 2. STATE & UTILITIES
  // ─────────────────────────────────────────────────────────
  var isRunning = false;
  var debounceTimer = null;
  var cachedClaimId = null;
  var cachedClaimData = null;
  var cachedResolver = null;

  function clean(v) { return v == null ? '' : String(v).trim(); }
  function displayStatus(v) { return clean(v).replace(/_/g, ' '); }

  function normalizeLabel(text) {
    return clean(text).toLowerCase().replace(/\s*\*+\s*/g, ' ').replace(/\bkosong\b/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  function isBlankUi(v) {
    var s = clean(v);
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || /^xxx+$/i.test(s) || /^unknown$/i.test(s) || /^kosong$/i.test(s);
  }

  function formatPortalDate(v) {
    var s = clean(v);
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      var y = m[3].length === 2 ? ('20' + m[3]) : m[3];
      return (m[1].length === 1 ? '0' + m[1] : m[1]) + '/' + (m[2].length === 1 ? '0' + m[2] : m[2]) + '/' + y;
    }
    return s;
  }

  // ─────────────────────────────────────────────────────────
  // 3. MAPPING FIELD (Gampang diedit di sini)
  // Format: label => fungsi penentu nilai
  // ─────────────────────────────────────────────────────────
  var FIELD_MAPPINGS = [
    { labels: ['Service Type'], val: function() { return 'Repair'; } },
    { labels: ['Service Method'], val: function(c) { return c.repair_method; } },
    { labels: ['Serial number', 'Serial Number', 'Serial No'], val: function(c) { return c.serial_no; } },
    { labels: ['Hour meter', 'Hour Meter', 'HM'], val: function(c) { return c.hm_failure != null ? String(c.hm_failure) : ''; } },
    { labels: ['Whole Machine Warranty'], val: function(c, r) { return r ? displayStatus(r.status || r.warranty_status || r.result) : ''; } },
    { labels: ['Feedback Person'], val: function(c) { return clean(c.technical_personnel).replace(/^\s*technician\s*[:\-]?\s*/i, '').trim(); } },
    { labels: ['Failure Date'], val: function(c) { return formatPortalDate(c.failure_date); } },
    { labels: ['Date of repair report', 'Date of Repair Report', 'Repair Date', 'Dealer Repair Date', 'Repair Start Date', 'Date of repair'], val: function(c) { return formatPortalDate(c.dealer_repair_date || c.completion_date || c.failure_date); } },
    { labels: ['Complaint'], val: function(c) { return c.fault_description; } },
    { labels: ['Fault Details', 'Fault Detail'], val: function(c) { return c.cause_analyze || c.comment; } },
    { labels: ['Machine Location'], val: function(c) { return c.failure_part_location; } },
    { labels: ['Service Mileage (Km)', 'Service Mileage', 'Mileage'], val: function(c) { return c.mileage_km; } },
    { labels: ['Labour Amount'], val: function(c) { return c.labour_amount; } },
    { labels: ['Mileage Amount'], val: function(c) { return c.mileage_amount; } },
    { labels: ['Other Amount'], val: function(c) { return c.other_amount; } },
    { labels: ['Total Amount', 'Total Amount Claimed'], val: function(c) { return c.total_amount; } }
  ];

  // ─────────────────────────────────────────────────────────
  // 4. CORE DOM HANDLERS
  // ─────────────────────────────────────────────────────────
  function getClient() {
    return window.sdlgSupabase || window.supabaseClient || window.__SDLG_SUPABASE_CLIENT || null;
  }

  function findClaimId() {
    try {
      var q = new URLSearchParams(location.search || '');
      var id = q.get('claim_id') || q.get('claimId') || q.get('id');
      if (id) return clean(id);
    } catch (_) {}
    try {
      var sel = document.querySelector('select');
      if (sel && sel.value) {
        var opt = sel.options[sel.selectedIndex];
        var txt = (opt && (opt.textContent || opt.value)) || sel.value;
        var m = String(txt).match(/\b(\d{3,4}-\d{4}-SDLG-[A-Z0-9]+)\b/i);
        if (m) return m[1];
      }
    } catch (_) {}
    var hash = String(location.hash || '');
    var hm = hash.match(/claim[_-]?id[=:]([^&]+)/i);
    if (hm) return clean(decodeURIComponent(hm[1]));
    var body = document.body ? String(document.body.innerText || '') : '';
    var bm = body.match(/\b(\d{3,4}-\d{4}-SDLG-[A-Z0-9]+)\b/i);
    return bm ? bm[1] : '';
  }

  // Fokus: Cari control berdasarkan label (Dibuat sekali per run)
  function findControlsByLabels(container, targetLabels) {
    var results = [];
    var allLabels = Array.from(container.querySelectorAll('label, .sdlg-portal-field label, [data-sdlg-field]'));
    
    targetLabels.forEach(function(wanted) {
      var normWanted = normalizeLabel(wanted);
      var safeWanted = String(wanted).replace(/"/g, '');

      // 1. Cek via data-attribute (Paling akurat)
      var byData = container.querySelector('[data-sdlg-field][data-label="' + safeWanted + '"]');
      if (byData) {
        var c = byData.matches('input,select,textarea') ? byData : byData.querySelector('input,select,textarea');
        if (c) { results.push(c); return; }
      }

      // 2. Cek via Label Text
      var candidates = allLabels.filter(function(el) {
        var norm = normalizeLabel(el.textContent);
        return norm && (norm === normWanted || norm.indexOf(normWanted) === 0 || normWanted.indexOf(norm) === 0 || norm.indexOf(normWanted) >= 0);
      });
      candidates.sort(function(a, b) { return normalizeLabel(a.textContent).length - normalizeLabel(b.textContent).length; });

      for (var i = 0; i < candidates.length; i++) {
        var label = candidates[i];
        var forId = label.getAttribute && label.getAttribute('for');
        if (forId) {
          var direct = document.getElementById(forId);
          if (direct && direct.matches && direct.matches('input,select,textarea')) { results.push(direct); return; }
        }
        var wrap = label.closest('.sdlg-portal-field, .sdlg-field-wrap, [data-sdlg-extra-field], [data-sdlg-field]') || label.parentElement;
        if (wrap) {
          var control = wrap.querySelector('input, select, textarea');
          if (control) { results.push(control); return; }
        }
      }
    });
    return results;
  }

  function fillControl(control, value, forceOverwrite) {
    if (!control || value == null || value === '') return false;
    var next = String(value);
    var cur = control.value != null ? String(control.value) : '';
    
    // Jangan timpa kalau udah ada isinya (kecuali dipaksa)
    if (!forceOverwrite && !isBlankUi(cur) && cur !== next) return false;
    
    control.value = next;
    if (typeof control.setAttribute === 'function') control.setAttribute('value', next);
    try {
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // 5. DATA FETCHING & APPLICATION
  // ─────────────────────────────────────────────────────────
  async function fetchClaimData(claimId) {
    var c = getClient();
    if (!c) throw new Error('No Supabase client');
    var res = await c.from('claims').select(CLAIM_SELECT).eq('claim_id', claimId).maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }

  async function fetchResolverData(claimId) {
    var c = getClient();
    if (!c || typeof c.rpc !== 'function') return null;
    try {
      var res = await c.rpc('sdlg_warranty_resolve_claim', { p_claim_id: claimId });
      return (res && res.error) ? null : (res ? res.data : null);
    } catch (_) { return null; }
  }

  function applyClaimData(claim, resolver) {
    if (!claim) return;
    
    var filledCount = 0;
    FIELD_MAPPINGS.forEach(function(map) {
      var val = map.val(claim, resolver);
      if (val == null || val === '') return;

      // Cari control sekali per mapping
      var controls = findControlsByLabels(document, map.labels);
      controls.forEach(function(ctrl) {
        if (fillControl(ctrl, val, true)) filledCount++;
      });
    });

    if (filledCount > 0) {
      console.info('[SDLG Hydrate] Berhasil auto-isi ' + filledCount + ' kolom untuk ' + claim.claim_id);
      window.dispatchEvent(new CustomEvent('sdlg-hydration-complete', { detail: { claimId: claim.claim_id } }));
    }
  }

  // ─────────────────────────────────────────────────────────
  // 6. ORCHESTRATOR (Proses Utama)
  // ─────────────────────────────────────────────────────────
  async function run() {
    if (isRunning) return;
    isRunning = true;
    try {
      var claimId = findClaimId();
      if (!claimId) return;

      // Jika ID sama, gak perlu fetch ulang, cukup apply ulang ke DOM baru
      if (claimId === cachedClaimId && cachedClaimData) {
        applyClaimData(cachedClaimData, cachedResolver);
        return;
      }

      var claim = await fetchClaimData(claimId);
      if (!claim) return;
      
      var resolver = await fetchResolverData(claimId);

      cachedClaimId = claimId;
      cachedClaimData = claim;
      cachedResolver = resolver;

      applyClaimData(claim, resolver);

    } catch (err) {
      console.warn('[SDLG Hydrate] Error:', err && err.message ? err.message : err);
    } finally {
      isRunning = false;
    }
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 250); // 250ms debounce
  }

  // ─────────────────────────────────────────────────────────
  // 7. EVENT LISTENERS (Observer & Trigger)
  // ─────────────────────────────────────────────────────────
  document.addEventListener('change', function (e) {
    if (e && e.target && e.target.tagName === 'SELECT') {
      cachedClaimId = null; // Reset cache biar fetch ulang
      schedule();
    }
  }, true);

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  
  // Cadangan (kalau form di-render lama)
  setTimeout(schedule, 500);
  setTimeout(schedule, 1500);
  setTimeout(schedule, 3000);

})();