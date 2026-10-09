(function () {
  'use strict';

  // Canonical portal helper v1.2.3
  // - Map portal label "Date of repair report" (was looking for "Repair Date" only)
  // - Strip Kosong badge from label text when matching fields
  // - repair date fallback: dealer_repair_date || completion_date || failure_date

  var CLAIM_SELECT = [
    'claim_id','model','serial_no','customer','repair_method','technical_personnel',
    'causing_part_no','causing_part_desc','failure_part_location','fault_description',
    'cause_analyze','comment','parts','hm_failure','hm_completion','sales_date',
    'failure_date','dealer_repair_date','completion_date','dealer_claim_date',
    'labour_amount','mileage_amount','other_amount','total_amount','mileage_km'
  ].join(',');

  var scheduled = false;
  var lastAppliedKey = '';
  var runSequence = 0;

  function clean(v) { return v == null ? '' : String(v).trim(); }
  function displayStatus(v) { return clean(v).replace(/_/g, ' '); }

  function normalizeLabel(text) {
    return clean(text)
      .toLowerCase()
      .replace(/\s*\*+\s*/g, ' ')
      .replace(/\bkosong\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

  function getClient() {
    if (typeof window.getSdlgSupabase === 'function') {
      var c = window.getSdlgSupabase();
      if (c) return c;
    }
    return window.sdlgSupabase || window.supabaseClient || window.__SDLG_SUPABASE_CLIENT || null;
  }

  async function loadClaim(claimId) {
    var c = getClient();
    if (!c) throw new Error('No Supabase client');
    var res = await c.from('claims').select(CLAIM_SELECT).eq('claim_id', claimId).maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }

  async function loadResolver(claimId) {
    var c = getClient();
    if (!c || typeof c.rpc !== 'function') return null;
    try {
      var res = await c.rpc('sdlg_warranty_resolve_claim', { p_claim_id: claimId });
      if (res && res.error) return null;
      return res ? res.data : null;
    } catch (_) { return null; }
  }

  function feedbackPersonValue(claim) {
    var raw = clean(claim && claim.technical_personnel);
    if (!raw) return '';
    return raw.replace(/^\s*technician\s*[:\-]?\s*/i, '').trim();
  }

  function repairDateValue(claim) {
    return formatPortalDate(claim && (claim.dealer_repair_date || claim.completion_date || claim.failure_date));
  }

  function wholeMachineLabel(resolver) {
    if (!resolver) return '';
    var s = resolver.status || resolver.warranty_status || resolver.result || '';
    return displayStatus(s);
  }

  function findFieldControl(labelText) {
    var wanted = normalizeLabel(labelText);
    if (!wanted) return null;
    var safeLabel = String(labelText || '').replace(/"/g, '');

    var byData = document.querySelector('[data-sdlg-field][data-label="' + safeLabel + '"]');
    if (byData) {
      if (byData.matches('input,select,textarea')) return byData;
      var inner = byData.querySelector('input,select,textarea');
      if (inner) return inner;
    }

    var labels = Array.from(document.querySelectorAll('label, .sdlg-portal-field label, [data-sdlg-field]'));
    var candidates = [];
    for (var i = 0; i < labels.length; i++) {
      var el = labels[i];
      var norm = normalizeLabel(el.textContent);
      if (!norm) continue;
      if (norm === wanted || norm.indexOf(wanted) === 0 || wanted.indexOf(norm) === 0 || norm.indexOf(wanted) >= 0) {
        candidates.push(el);
      }
    }
    candidates.sort(function (a, b) {
      return normalizeLabel(a.textContent).length - normalizeLabel(b.textContent).length;
    });

    for (var c = 0; c < candidates.length; c++) {
      var label = candidates[c];
      var forId = label.getAttribute && label.getAttribute('for');
      if (forId) {
        var direct = document.getElementById(forId);
        if (direct && direct.matches && direct.matches('input,select,textarea')) return direct;
      }
      var wrap = (label.closest && label.closest('.sdlg-portal-field, .sdlg-field-wrap, [data-sdlg-extra-field], [data-sdlg-field]')) || label.parentElement;
      if (wrap) {
        var control = wrap.querySelector('input, select, textarea');
        if (control) return control;
      }
    }
    return null;
  }

  function setControlValue(control, value, forceFillEmpty) {
    if (!control) return false;
    if (value == null || value === '') return false;
    var next = String(value);
    var cur = control.value != null ? String(control.value) : '';
    if (!forceFillEmpty && !isBlankUi(cur) && cur !== next) return false;
    control.value = next;
    if (typeof control.setAttribute === 'function') control.setAttribute('value', next);
    try {
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  function setByLabels(labels, value, force) {
    if (isBlankUi(value)) return false;
    var ok = false;
    for (var i = 0; i < labels.length; i++) {
      if (setControlValue(findFieldControl(labels[i]), value, force)) ok = true;
    }
    return ok;
  }

  function applyClaimData(claim, resolver) {
    if (!claim) return;

    var person = feedbackPersonValue(claim);
    var repairDt = repairDateValue(claim);
    var serviceMethod = clean(claim.repair_method);
    var serviceType = 'Repair';

    setByLabels(['Service Type'], serviceType, true);
    setByLabels(['Service Method'], serviceMethod, true);

    setByLabels(['Serial number', 'Serial Number', 'Serial No'], clean(claim.serial_no), true);
    setByLabels(['Hour meter', 'Hour Meter', 'HM'], claim.hm_failure != null ? String(claim.hm_failure) : '', true);

    var wmw = wholeMachineLabel(resolver);
    if (wmw) setByLabels(['Whole Machine Warranty'], wmw, true);

    setByLabels(['Feedback Person'], person, true);
    setByLabels(['Failure Date'], formatPortalDate(claim.failure_date), true);

    // CRITICAL: portal uses "Date of repair report" not "Repair Date"
    setByLabels([
      'Date of repair report',
      'Date of Repair Report',
      'Repair Date',
      'Dealer Repair Date',
      'Repair Start Date',
      'Date of repair'
    ], repairDt, true);

    setByLabels(['Complaint'], clean(claim.fault_description), true);
    setByLabels(['Fault Details', 'Fault Detail'], clean(claim.cause_analyze) || clean(claim.comment), true);

    setByLabels(['Machine Location'], clean(claim.failure_part_location), true);

    if (claim.mileage_km != null && !isBlankUi(claim.mileage_km)) {
      setByLabels(['Service Mileage (Km)', 'Service Mileage', 'Mileage'], String(claim.mileage_km), true);
    }

    if (claim.labour_amount != null) setByLabels(['Labour Amount'], String(claim.labour_amount), true);
    if (claim.mileage_amount != null) setByLabels(['Mileage Amount'], String(claim.mileage_amount), true);
    if (claim.other_amount != null) setByLabels(['Other Amount'], String(claim.other_amount), true);
    if (claim.total_amount != null) setByLabels(['Total Amount', 'Total Amount Claimed'], String(claim.total_amount), true);

    try {
      console.info('[SDLG Helper] filled', claim.claim_id, 'repairDate=', repairDt || '(none)', 'method=', serviceMethod || '(empty in DB)');
    } catch (_) {}
  }

  async function run() {
    if (scheduled) return;
    scheduled = true;
    try {
      var claimId = findClaimId();
      if (!claimId) return;
      var key = claimId + ':' + (++runSequence);
      if (key === lastAppliedKey) return;
      var claim = await loadClaim(claimId);
      if (!claim) return;
      var resolver = null;
      try { resolver = await loadResolver(claimId); } catch (e) { console.warn('[SDLG Helper] resolver', e); }
      applyClaimData(claim, resolver);
      lastAppliedKey = key;
    } catch (err) {
      console.warn('[SDLG Helper]', err && err.message ? err.message : err);
    } finally {
      scheduled = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    setTimeout(run, 150);
  }

  document.addEventListener('change', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SELECT') {
      lastAppliedKey = '';
      schedule();
    }
  }, true);

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(function () { schedule(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  setTimeout(schedule, 400);
  setTimeout(schedule, 1200);
  setTimeout(schedule, 2500);
})();
