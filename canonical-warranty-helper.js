(function () {
  'use strict';

  // Canonical portal helper v1.2.5
  // - Prefer window.SDLG_CLAIM_FIELDS when present (single field registry)
  // - Date of repair report + repair_method mapping
  // - Stable lastAppliedKey (no log spam)

  var DEFAULT_CLAIM_SELECT = [
    'claim_id','model','serial_no','customer','repair_method','technical_personnel',
    'causing_part_no','causing_part_desc','failure_part_location','fault_description',
    'cause_analyze','comment','parts','hm_failure','hm_completion','sales_date',
    'failure_date','dealer_repair_date','completion_date','dealer_claim_date',
    'labour_amount','mileage_amount','other_amount','total_amount','mileage_km'
  ].join(',');

  function claimSelect() {
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.CLAIM_SELECT) {
        return window.SDLG_CLAIM_FIELDS.CLAIM_SELECT;
      }
    } catch (_) {}
    return DEFAULT_CLAIM_SELECT;
  }

  var scheduled = false;
  var lastAppliedKey = '';
  var applying = false;

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
    var body = document.body ? String(document.body.innerText || '') : '';
    var bm = body.match(/\b(\d{3,4}-\d{4}-SDLG-[A-Z0-9]+)\b/i);
    return bm ? bm[1] : '';
  }

  function getClient() {
    if (typeof window.getSdlgSupabase === 'function') {
      var c = window.getSdlgSupabase();
      if (c) return c;
    }
    return window.sdlgSupabase || window.supabaseClient || null;
  }

  async function loadClaim(claimId) {
    var c = getClient();
    if (!c) throw new Error('No Supabase client');
    var res = await c.from('claims').select(claimSelect()).eq('claim_id', claimId).maybeSingle();
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
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.PORTAL_HOME && window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackPerson) {
        return window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackPerson.fromClaim(claim) || '';
      }
    } catch (_) {}
    var raw = clean(claim && claim.technical_personnel);
    if (!raw) return '';
    return raw.replace(/^\s*technician\s*[:\-]?\s*/i, '').trim();
  }

  function repairDateValue(claim) {
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.PORTAL_HOME && window.SDLG_CLAIM_FIELDS.PORTAL_HOME.repairDate) {
        return window.SDLG_CLAIM_FIELDS.PORTAL_HOME.repairDate.fromClaim(claim) || '';
      }
    } catch (_) {}
    return formatPortalDate(claim && (claim.dealer_repair_date || claim.completion_date || claim.failure_date));
  }

  function wholeMachineLabel(resolver) {
    if (!resolver) return '';
    var s = resolver.status || resolver.warranty_status || resolver.result || '';
    return displayStatus(s);
  }

  function findById(id) {
    var el = document.getElementById(id);
    return el && el.matches && el.matches('input,select,textarea') ? el : null;
  }

  function findFieldControl(labelText) {
    var wanted = normalizeLabel(labelText);
    if (!wanted) return null;

    var idMap = {
      'service type': 'sdlg_serviceType',
      'service method': 'sdlg_serviceMethod',
      'serial number': 'sdlg_serialNumber',
      'serial no': 'sdlg_serialNumber',
      'hour meter': 'sdlg_hourMeter',
      'hm': 'sdlg_hourMeter',
      'whole machine warranty': 'sdlg_warrantyScope',
      'feedback person': 'sdlg_feedbackPerson',
      'feedback contact information': 'sdlg_feedbackContact',
      'failure date': 'sdlg_failureDate',
      'date of repair report': 'sdlg_repairDate',
      'date of repair': 'sdlg_repairDate',
      'repair date': 'sdlg_repairDate',
      'dealer repair date': 'sdlg_repairDate',
      'complaint': 'sdlg_complaint',
      'fault details': 'sdlg_faultDetails',
      'fault detail': 'sdlg_faultDetails',
      'machine location': 'sdlg_machineLocation',
      'repair labor (hrs)': 'sdlg_repairLabor',
      'repair labor': 'sdlg_repairLabor',
      'service mileage (km)': 'sdlg_serviceMileage',
      'service mileage': 'sdlg_serviceMileage',
      'labour amount': 'sdlg_labourAmount',
      'mileage amount': 'sdlg_mileageAmount',
      'other amount': 'sdlg_otherAmount',
      'total amount': 'sdlg_totalAmount',
      'total amount claimed': 'sdlg_totalAmount'
    };
    if (idMap[wanted]) {
      var byId = findById(idMap[wanted]);
      if (byId) return byId;
    }

    var byData = document.querySelector('[data-sdlg-field][data-label="' + String(labelText).replace(/"/g, '') + '"]');
    if (byData && byData.matches('input,select,textarea')) return byData;

    var nodes = document.querySelectorAll('[data-sdlg-field][data-label]');
    for (var i = 0; i < nodes.length; i++) {
      if (normalizeLabel(nodes[i].getAttribute('data-label')) === wanted) {
        if (nodes[i].matches('input,select,textarea')) return nodes[i];
      }
    }

    var labels = Array.from(document.querySelectorAll('label'));
    for (var j = 0; j < labels.length; j++) {
      var norm = normalizeLabel(labels[j].textContent);
      if (norm === wanted || norm.indexOf(wanted) >= 0) {
        var forId = labels[j].getAttribute('for');
        if (forId) {
          var d = document.getElementById(forId);
          if (d) return d;
        }
        var wrap = labels[j].closest('div');
        if (wrap) {
          var ctrl = wrap.querySelector('input,select,textarea');
          if (ctrl) return ctrl;
        }
      }
    }
    return null;
  }

  function setControlValue(control, value) {
    if (!control) return false;
    if (value == null || value === '') return false;
    var next = String(value);
    var cur = control.value != null ? String(control.value) : '';
    if (cur === next) return true;

    try {
      var proto = control.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(control, next);
      else control.value = next;
    } catch (_) {
      control.value = next;
    }
    if (typeof control.setAttribute === 'function') control.setAttribute('value', next);
    try {
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  function setByLabels(labels, value) {
    if (isBlankUi(value)) return false;
    var ok = false;
    for (var i = 0; i < labels.length; i++) {
      if (setControlValue(findFieldControl(labels[i]), value)) ok = true;
    }
    return ok;
  }

  function applyClaimData(claim, resolver) {
    if (!claim) return;

    var person = feedbackPersonValue(claim);
    var repairDt = repairDateValue(claim);
    var serviceMethod = clean(claim.repair_method);

    setByLabels(['Service Type'], 'Repair');
    setByLabels(['Service Method'], serviceMethod);
    setByLabels(['Serial number', 'Serial Number'], clean(claim.serial_no));
    setByLabels(['Hour meter'], claim.hm_failure != null ? String(claim.hm_failure) : '');

    var wmw = wholeMachineLabel(resolver);
    if (wmw) setByLabels(['Whole Machine Warranty'], wmw);

    setByLabels(['Feedback Person'], person);
    setByLabels(['Failure Date'], formatPortalDate(claim.failure_date));
    setByLabels(['Date of repair report', 'Repair Date', 'Dealer Repair Date'], repairDt);
    setByLabels(['Complaint'], clean(claim.fault_description));
    setByLabels(['Fault Details'], clean(claim.cause_analyze) || clean(claim.comment));
    setByLabels(['Machine Location'], clean(claim.failure_part_location));

    if (claim.mileage_km != null) setByLabels(['Service Mileage (Km)', 'Service Mileage'], String(claim.mileage_km));
    if (claim.labour_amount != null) setByLabels(['Labour Amount'], String(claim.labour_amount));
    if (claim.mileage_amount != null) setByLabels(['Mileage Amount'], String(claim.mileage_amount));
    if (claim.other_amount != null) setByLabels(['Other Amount'], String(claim.other_amount));
    if (claim.total_amount != null) setByLabels(['Total Amount', 'Total Amount Claimed'], String(claim.total_amount));

    setControlValue(findById('sdlg_repairDate'), repairDt);
    setControlValue(findById('sdlg_serviceMethod'), serviceMethod);

    try {
      console.info('[SDLG Helper] applied', claim.claim_id, 'repairDate=', repairDt || '(none)', 'method=', serviceMethod || '(empty)', 'el=', !!findById('sdlg_repairDate'));
    } catch (_) {}
  }

  async function run() {
    if (scheduled || applying) return;
    scheduled = true;
    try {
      var claimId = findClaimId();
      if (!claimId) return;
      if (lastAppliedKey === claimId) {
        var el = findById('sdlg_repairDate') || findFieldControl('Date of repair report');
        if (el && !isBlankUi(el.value)) return;
      }
      applying = true;
      var claim = await loadClaim(claimId);
      if (!claim) return;
      var resolver = null;
      try { resolver = await loadResolver(claimId); } catch (_) {}
      applyClaimData(claim, resolver);
      lastAppliedKey = claimId;
    } catch (err) {
      console.warn('[SDLG Helper]', err && err.message ? err.message : err);
    } finally {
      applying = false;
      scheduled = false;
    }
  }

  function schedule() {
    if (scheduled || applying) return;
    setTimeout(run, 200);
  }

  document.addEventListener('change', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SELECT') {
      lastAppliedKey = '';
      schedule();
    }
  }, true);

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(function () {
      if (applying) return;
      schedule();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  setTimeout(schedule, 500);
  setTimeout(schedule, 1500);
})();
