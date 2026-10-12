/**
 * SDLG Input Hydrate v1.1 — ONLY writer for portal Home fields.
 * Hash = source of truth. Logs every write. Drift-heals every 4s.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_INPUT_HYDRATE_V11__) return;
  root.__SDLG_INPUT_HYDRATE_V11__ = true;
  root.__SDLG_INPUT_HYDRATE_V1__ = true;

  var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;
  var busy = false;
  var lastValues = null;

  // Kill competing writers permanently
  root.__SDLG_DISABLE_CLAIM_LOCK_FIELD_WRITES__ = true;
  root.__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__ = true;
  root.__SDLG_DISABLE_FB_FIX_WRITES__ = true;

  function hashClaimId() {
    try {
      var h = String((root.location && root.location.hash) || '');
      var m = h.match(/(?:sdlg-input|sdlginput)\/([^/?#]+)/i);
      if (!m) {
        if (!document.querySelector('[data-sdlg-input-helper], #sdlg_repairDate')) return '';
        m = h.match(/(?:claims|claim)\/([^/?#]+)/i);
      }
      if (!m) return '';
      var seg = decodeURIComponent(m[1]).trim();
      return RE.test(seg) ? seg : '';
    } catch (_) { return ''; }
  }

  function portalDate(v) {
    var s = String(v || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
  }

  function waitFor(id, ms) {
    return new Promise(function (resolve) {
      var start = Date.now();
      (function tick() {
        var el = document.getElementById(id);
        if (el) return resolve(el);
        if (Date.now() - start > (ms || 4000)) return resolve(null);
        setTimeout(tick, 50);
      })();
    });
  }

  function forceSet(el, v, tag) {
    if (!el) return;
    v = v == null ? '' : String(v);
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, v);
      else el.value = v;
    } catch (_) { el.value = v; }
    try {
      el.defaultValue = v;
      el.setAttribute('value', v);
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('data-hydrate', '1');
    } catch (_) {}
    try { console.info('[SDLG hydrate] write', tag || el.id, '=', v.slice(0, 60)); } catch (_) {}
  }

  function setVal(id, label, value) {
    var v = value == null ? '' : String(value);
    var el = document.getElementById(id);
    forceSet(el, v, id);
    if (label) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (node) {
        if ((node.getAttribute('data-label') || '') === label) forceSet(node, v, label);
      });
    }
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
    if (!c || !c.claim_id) return;
    var want = hashClaimId();
    if (want && String(want).toUpperCase() !== String(c.claim_id).toUpperCase()) {
      try { console.warn('[SDLG hydrate] refuse', c.claim_id, 'hash=', want); } catch (_) {}
      return;
    }

    try {
      document.querySelectorAll('select').forEach(function (s) {
        var has = false;
        for (var i = 0; i < s.options.length; i++) {
          if (String(s.options[i].value || '') === c.claim_id) { has = true; break; }
        }
        if (has) s.value = c.claim_id;
      });
    } catch (_) {}

    var report = buildReport(c);
    document.querySelectorAll('[data-sdlg-report-body]').forEach(function (el) {
      el.textContent = report;
      el.setAttribute('data-claim-id', c.claim_id);
      try { console.info('[SDLG hydrate] write report-body =', report.slice(0, 80)); } catch (_) {}
    });
    // also any monospace report dumps without the attr
    document.querySelectorAll('.sdlg-section-report, [data-sdlg-section-role="report"]').forEach(function (card) {
      card.querySelectorAll('div').forEach(function (el) {
        var tx = String(el.textContent || '');
        if (/^SDLG\s+/i.test(tx) && /Transmission Abnormal|G9138F/i.test(tx) && c.model && tx.indexOf(c.model) < 0) {
          el.textContent = report;
        }
      });
    });

    var repairStr = portalDate(c.dealer_repair_date || c.completion_date || c.failure_date);
    var loc = [c.dealer_wo_so || c.wo_so || '', c.branch || '', c.customer || '']
      .map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ');
    var tech = String(c.technical_personnel || c.feedback_person || '')
      .replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
    var contact = String(c.feedback_contact || c.contact_phone || c.phone || '').trim();
    if (/^kosong$/i.test(contact)) contact = '';

    setVal('sdlg_serviceType', 'Service Type', 'Repair');
    setVal('sdlg_serviceMethod', 'Service Method', c.repair_method || c.service_method || '');
    setVal('sdlg_serialNumber', 'Serial number', c.serial_no || c.canonical_serial_no || '');
    setVal('sdlg_hourMeter', 'Hour meter', c.hm_failure != null ? String(c.hm_failure) : '');
    setVal('sdlg_feedbackPerson', 'Feedback Person', tech);
    setVal('sdlg_feedbackContact', 'Feedback Contact Information', contact);
    setVal('sdlg_failureDate', 'Failure Date', portalDate(c.failure_date));
    setVal('sdlg_repairDate', 'Date of repair report', repairStr);
    setVal('sdlg_complaint', 'Complaint', c.fault_description || '');
    setVal('sdlg_faultDetails', 'Fault Details', [c.cause_analyze, c.comment].filter(Boolean).join('\n\n'));
    setVal('sdlg_machineLocation', 'Machine Location', loc);
    setVal('sdlg_repairLabor', 'Repair Labor (Hrs)', c.labour_hrs != null ? String(c.labour_hrs) : '');
    setVal('sdlg_serviceMileage', 'Service Mileage (Km)', c.mileage_km != null ? String(c.mileage_km) : '');

    root.__SDLG_LIVE_CLAIM__ = c;
    lastValues = { claim_id: c.claim_id, repair: repairStr, loc: loc, report: report, person: tech };
    try { console.info('[SDLG hydrate] OK', c.claim_id, 'repair=', repairStr); } catch (_) {}
  }

  function getClient() {
    return (typeof root.getSdlgSupabase === 'function' && root.getSdlgSupabase())
      || root.supabaseClient || root.sdlgSupabase || null;
  }

  async function hydrate(forceId) {
    if (busy) return;
    var id = String(forceId || hashClaimId() || '').trim();
    if (!id || !RE.test(id)) return;
    if (!document.querySelector('[data-sdlg-input-helper], #sdlg_repairDate, [data-sdlg-field]')) return;

    await waitFor('sdlg_repairDate', 5000);

    var live = root.__SDLG_LIVE_CLAIM__;
    if (live && String(live.claim_id) === id) {
      apply(live);
      // still re-fetch to beat stale React paint
    }

    var client = getClient();
    if (!client || !client.from) return;

    busy = true;
    try {
      var res = await client.from('claims').select('*').eq('claim_id', id).maybeSingle();
      if (res.error) throw res.error;
      if (hashClaimId() && hashClaimId() !== id) return;
      if (res.data) apply(res.data);
    } catch (e) {
      try { console.warn('[SDLG hydrate] failed', id, e); } catch (_) {}
    } finally {
      busy = false;
    }
  }

  var timer = null;
  function schedule(id) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { hydrate(id); }, 80);
  }

  root.SDLGInputHydrate = {
    version: '1.1.0',
    hydrate: hydrate,
    apply: apply,
    hashClaimId: hashClaimId,
    lastValues: function () { return lastValues; }
  };

  root.addEventListener('hashchange', function () { lastValues = null; schedule(); });
  root.addEventListener('sdlg-route', function () { lastValues = null; schedule(); });
  root.addEventListener('sdlg-input-claim', function (e) {
    lastValues = null;
    schedule(e.detail && e.detail.claimId);
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'SELECT') return;
    var v = String(t.value || '').trim();
    if (!RE.test(v)) return;
    try {
      if (document.querySelector('[data-sdlg-input-helper]') || /sdlg-input/i.test(String(root.location.hash || ''))) {
        if (hashClaimId() !== v) root.location.hash = '#/sdlg-input/' + encodeURIComponent(v);
      }
    } catch (_) {}
    lastValues = null;
    schedule(v);
  }, true);

  // Staggered runs AFTER React paint
  [300, 700, 1200, 2000, 3500].forEach(function (ms) {
    setTimeout(function () { schedule(); }, ms);
  });

  // Drift heal — if repair/report reverts to 0429 signatures, re-apply
  setInterval(function () {
    var id = hashClaimId();
    if (!id) return;
    var repairEl = document.getElementById('sdlg_repairDate');
    var reportEl = document.querySelector('[data-sdlg-report-body]');
    var repair = repairEl ? String(repairEl.value || '') : '';
    var report = reportEl ? String(reportEl.textContent || '') : '';
    var bad =
      /19\/07\/2024/.test(repair) ||
      /Transmission Abnormal/i.test(report) ||
      /G9138F/i.test(report) && lastValues && lastValues.claim_id === id && lastValues.report && lastValues.report.indexOf('G9138F') < 0 ||
      (lastValues && lastValues.claim_id === id && lastValues.repair && repair && repair !== lastValues.repair);
    if (bad) {
      try { console.warn('[SDLG hydrate] drift → rehydrate', { repair: repair, report: report.slice(0, 40) }); } catch (_) {}
      schedule(id);
    }
  }, 4000);
})(typeof window !== 'undefined' ? window : this);
