/**
 * SDLG Input Hydrate v1.4 — event-driven bridge for non-React-owned portal fields.
 * React's route-bound live claim fetch is authoritative. This module never fetches,
 * never runs a polling loop, and never writes report/date/location fields owned by React.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_INPUT_HYDRATE_V14__) return;
  root.__SDLG_INPUT_HYDRATE_V14__ = true;
  root.__SDLG_INPUT_HYDRATE_V13_DISABLED__ = true;
  root.__SDLG_INPUT_HYDRATE_V1__ = true;
  root.__SDLG_DISABLE_CLAIM_LOCK_FIELD_WRITES__ = true;
  root.__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__ = true;
  root.__SDLG_DISABLE_FB_FIX_WRITES__ = true;

  var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;
  var lastValues = null;
  var lastSignature = '';

  function hashClaimId() {
    try {
      if (root.SDLGHashRouter && typeof root.SDLGHashRouter.claimId === 'function') {
        var routed = String(root.SDLGHashRouter.claimId() || '').trim();
        if (RE.test(routed)) return routed.toUpperCase();
      }
      var h = String((root.location && root.location.hash) || '');
      var m = h.match(/(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i);
      if (!m) return '';
      var id = decodeURIComponent(m[1]).trim();
      return RE.test(id) ? id.toUpperCase() : '';
    } catch (_) { return ''; }
  }

  function portalDate(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      var dd = m[1].length === 1 ? '0' + m[1] : m[1];
      var mm = m[2].length === 1 ? '0' + m[2] : m[2];
      return dd + '/' + mm + '/' + m[3];
    }
    return s;
  }

  function forceSet(el, value, tag) {
    if (!el) return false;
    var v = value == null ? '' : String(value);
    var current = String(el.value == null ? '' : el.value);
    if (current === v) return false;
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, v);
      else el.value = v;
    } catch (_) {
      el.value = v;
    }
    try {
      el.defaultValue = v;
      el.setAttribute('value', v);
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('data-lpignore', 'true');
    } catch (_) {}
    try { console.info('[SDLG hydrate] write', tag || el.id, '=', v.slice(0, 80)); } catch (_) {}
    return true;
  }

  function setVal(id, label, value) {
    var v = value == null ? '' : String(value);
    var nodes = [];
    if (id) {
      try { nodes = Array.prototype.slice.call(document.querySelectorAll('[id="' + id + '"]')); } catch (_) {}
      if (!nodes.length) {
        var one = document.getElementById(id);
        if (one) nodes.push(one);
      }
    }
    if (label) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (node) {
        if ((node.getAttribute('data-label') || '') === label && nodes.indexOf(node) < 0) nodes.push(node);
      });
    }
    var changed = false;
    nodes.forEach(function (el) { if (forceSet(el, v, id || label)) changed = true; });
    return changed;
  }

  function emptyDash(v) {
    var s = String(v || '').trim();
    if (!s || /^kosong$/i.test(s) || /^xxx+$/i.test(s) || s === '-' || s === '\u2013') return '\u2014';
    return s;
  }

  function buildReport(c) {
    if (!c) return '';
    var model = String(c.model || '').trim();
    var serial = String(c.serial_no || c.canonical_serial_no || '').trim();
    var short = serial.replace(/\s+/g, '').slice(-6);
    var hm = c.hm_failure != null && c.hm_failure !== '' ? String(c.hm_failure) : '';
    var complaint = String(c.fault_description || '').trim().replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    if (complaint.length > 80) complaint = complaint.slice(0, 77).replace(/\s+\S*$/, '').trim() + '\u2026';
    var machine = model && short ? 'SDLG ' + model + ' SN.' + short : model ? 'SDLG ' + model : 'SDLG';
    var pfrMatch = String(c.claim_id || '').match(/^(\d+)-\d{4}-SDLG-PFR$/i);
    var pfr = pfrMatch ? 'PFR' + pfrMatch[1] : String(c.claim_id || '');
    var claimNo = String(c.dealer_claim_no || c.claim_no || c.sdlg_no || '').trim();
    var wo = String(c.dealer_wo_so || c.wo_so || '').trim();
    return [machine, hm ? hm + ' hr' : '', complaint, pfr, claimNo, wo].filter(Boolean).join(', ');
  }

  function apply(c) {
    if (!c || !c.claim_id) return false;
    var wanted = hashClaimId();
    if (!wanted || String(c.claim_id).trim().toUpperCase() !== wanted) {
      try { console.warn('[SDLG hydrate] refuse mismatched claim', c.claim_id, 'route=', wanted); } catch (_) {}
      return false;
    }

    // Do NOT write report body, repair date, or machine location — React owns those.
    var report = buildReport(c);
    var tech = String(c.technical_personnel || c.feedback_person || '')
      .replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
    var contact = emptyDash(c.feedback_contact || c.contact_phone || c.phone || '');

    setVal('sdlg_serviceType', 'Service Type', 'Repair');
    setVal('sdlg_serviceMethod', 'Service Method', c.repair_method || c.service_method || '');
    setVal('sdlg_serialNumber', 'Serial number', c.serial_no || c.canonical_serial_no || '');
    setVal('sdlg_hourMeter', 'Hour meter', c.hm_failure != null ? String(c.hm_failure) : '');
    setVal('sdlg_feedbackPerson', 'Feedback Person', tech);
    setVal('sdlg_feedbackContact', 'Feedback Contact Information', contact === '\u2014' ? '' : contact);
    setVal('sdlg_failureDate', 'Failure Date', portalDate(c.failure_date));
    setVal('sdlg_complaint', 'Complaint', c.fault_description || '');
    setVal('sdlg_faultDetails', 'Fault Details', [c.cause_analyze, c.comment].filter(Boolean).join('\n\n'));
    setVal('sdlg_repairLabor', 'Repair Labor (Hrs)', c.labour_hrs != null ? String(c.labour_hrs) : '');
    setVal('sdlg_serviceMileage', 'Service Mileage (Km)', c.mileage_km != null ? String(c.mileage_km) : '');

    lastValues = {
      claim_id: c.claim_id,
      repair: portalDate(c.dealer_repair_date || c.completion_date || c.repair_date || c.failure_date),
      loc: '',
      report: report,
      person: tech
    };
    var signature = JSON.stringify([
      c.claim_id, c.model, c.serial_no, c.hm_failure, c.technical_personnel, c.feedback_person,
      c.feedback_contact, c.contact_phone, c.phone, c.failure_date, c.fault_description,
      c.cause_analyze, c.comment, c.labour_hrs, c.mileage_km
    ]);
    if (signature !== lastSignature) {
      lastSignature = signature;
      try { console.info('[SDLG hydrate] applied non-React fields for', c.claim_id); } catch (_) {}
    }
    try {
      if (root.SDLGPortalFinance && typeof root.SDLGPortalFinance.recompute === 'function') {
        setTimeout(function () { root.SDLGPortalFinance.recompute(); }, 0);
      }
    } catch (_) {}
    return true;
  }

  function clearMismatchedGlobal() {
    var wanted = hashClaimId();
    var live = root.__SDLG_LIVE_CLAIM__;
    if (live && wanted && String(live.claim_id || '').trim().toUpperCase() !== wanted) {
      root.__SDLG_LIVE_CLAIM__ = null;
    }
  }

  root.SDLGInputHydrate = {
    version: '1.4.0',
    hydrate: function () { return apply(root.__SDLG_LIVE_CLAIM__); },
    apply: apply,
    hashClaimId: hashClaimId,
    lastValues: function () { return lastValues; },
    enforceRepairDate: function () { return false; }
  };

  root.addEventListener('sdlg-live-claim-ready', function (e) {
    var detail = e && e.detail;
    apply(detail && detail.claim);
  });
  root.addEventListener('hashchange', clearMismatchedGlobal);
  root.addEventListener('sdlg-route', clearMismatchedGlobal);

  // The live fetch may finish before this asynchronously loaded module arrives.
  var initial = root.__SDLG_LIVE_CLAIM__;
  if (initial && String(initial.claim_id || '').trim().toUpperCase() === hashClaimId()) {
    setTimeout(function () { apply(initial); }, 0);
  }
  try { console.info('[SDLG hydrate] v1.4 event-driven bridge loaded; no polling'); } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
