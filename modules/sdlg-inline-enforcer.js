/**
 * SDLG Inline Enforcer v3 — force report/location/repair from __SDLG_LIVE_CLAIM__ on drift.
 * Loads via claim-fields (attr data-sdlg-inline-enforcer-mod) so baked legacy does not block it.
 */
(function () {
  'use strict';
  if (window.__SDLG_INLINE_ENFORCER_V2__) return;
  window.__SDLG_INLINE_ENFORCER_V2__ = true;
  window.__SDLG_INLINE_ENFORCER__ = true;

  function setVal(el, v) {
    if (!el) return;
    v = v == null ? '' : String(v);
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d && d.set) d.set.call(el, v);
      else el.value = v;
    } catch (e) {
      el.value = v;
    }
    try {
      el.setAttribute('value', v);
      el.defaultValue = v;
    } catch (e) {}
  }

  function portalDate(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    return s;
  }

  function pickRepair(c) {
    if (!c) return '';
    var id = String(c.claim_id || '');
    var cy = (id.match(/-(\d{4})-SDLG-PFR/i) || [])[1];
    var cands = [c.dealer_repair_date, c.completion_date, c.repair_date, c.failure_date];
    for (var i = 0; i < cands.length; i++) {
      var raw = cands[i];
      if (raw == null || String(raw).trim() === '') continue;
      var fmt = portalDate(raw);
      if (/19[\/\-]0?7[\/\-]2024/.test(fmt) && id !== '0429-2024-SDLG-PFR') continue;
      var dy = (fmt.match(/(\d{4})$/) || [])[1];
      if (cy && dy && Math.abs(Number(cy) - Number(dy)) > 1) continue;
      return fmt;
    }
    return portalDate(c.failure_date || '');
  }

  function buildReport(c) {
    if (!c) return '';
    var model = String(c.model || '').trim();
    var serial = String(c.serial_no || c.canonical_serial_no || '')
      .trim()
      .replace(/\s+/g, '')
      .slice(-6);
    var hm = c.hm_failure != null && c.hm_failure !== '' ? String(c.hm_failure) : '';
    var complaint = String(c.fault_description || '')
      .trim()
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ');
    if (complaint.length > 80)
      complaint = complaint.slice(0, 77).replace(/\s+\S*$/, '').trim() + '\u2026';
    var machine =
      model && serial ? 'SDLG ' + model + ' SN.' + serial : model ? 'SDLG ' + model : 'SDLG';
    var pfrMatch = String(c.claim_id || '').match(/^(\d+)-\d{4}-SDLG-PFR$/i);
    var pfr = pfrMatch ? 'PFR' + pfrMatch[1] : String(c.claim_id || '');
    var claimNo = String(c.dealer_claim_no || c.claim_no || c.sdlg_no || '').trim();
    var wo = String(c.dealer_wo_so || c.wo_so || '').trim();
    return [machine, hm ? hm + ' hr' : '', complaint, pfr, claimNo, wo]
      .filter(Boolean)
      .join(', ');
  }

  function buildLoc(c) {
    if (!c) return '';
    return [c.dealer_wo_so || c.wo_so || '', c.branch || '', c.customer || '']
      .map(function (x) {
        return String(x || '').trim();
      })
      .filter(Boolean)
      .join(' ');
  }

  function drift(c) {
    if (!c || !c.claim_id) return false;
    var reportEl = document.querySelector('[data-sdlg-report-body]');
    var report = reportEl ? String(reportEl.textContent || '') : '';
    var repairEl = document.getElementById('sdlg_repairDate');
    var repair = repairEl ? String(repairEl.value || '') : '';
    var locEl = document.getElementById('sdlg_machineLocation');
    var loc = locEl ? String(locEl.value || '') : '';
    var model = String(c.model || '');
    if (/G9138F/i.test(report) && model && !/G9138F/i.test(model)) return true;
    if (
      /Transmission Abnormal/i.test(report) &&
      !/Transmission/i.test(String(c.fault_description || ''))
    )
      return true;
    if (/PAPUA|INDOTRUCK/i.test(loc) && !/PAPUA|INDOTRUCK/i.test(String(c.customer || '') + String(c.branch || '')))
      return true;
    if (/19[\/\-]0?7[\/\-]2024/.test(repair) && String(c.claim_id) !== '0429-2024-SDLG-PFR')
      return true;
    var expectedLoc = buildLoc(c);
    if (expectedLoc && loc && loc !== expectedLoc) return true;
    if (model && report && report.indexOf(model) < 0 && /SDLG\s+\w+/.test(report)) return true;
    return false;
  }

  function forceFromLive(c) {
    if (!c || !c.claim_id) return;
    var report = buildReport(c);
    var loc = buildLoc(c);
    document.querySelectorAll('[data-sdlg-report-body]').forEach(function (el) {
      el.textContent = report;
      el.setAttribute('data-claim-id', c.claim_id);
    });
    document.querySelectorAll('[data-sdlg-copy-report-name]').forEach(function (btn) {
      btn.setAttribute('data-value', report);
    });

    setVal(document.getElementById('sdlg_serviceType'), 'Repair');
    setVal(document.getElementById('sdlg_serviceMethod'), c.repair_method || c.service_method || '');
    setVal(document.getElementById('sdlg_serialNumber'), c.serial_no || c.canonical_serial_no || '');
    setVal(document.getElementById('sdlg_hourMeter'), c.hm_failure != null ? String(c.hm_failure) : '');
    var tech = String(c.technical_personnel || c.feedback_person || '')
      .replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '')
      .trim();
    setVal(document.getElementById('sdlg_feedbackPerson'), tech);
    setVal(document.getElementById('sdlg_failureDate'), portalDate(c.failure_date));
    setVal(document.getElementById('sdlg_repairDate'), pickRepair(c));
    setVal(document.getElementById('sdlg_complaint'), c.fault_description || '');
    setVal(
      document.getElementById('sdlg_faultDetails'),
      [c.cause_analyze, c.comment].filter(Boolean).join('\n\n')
    );
    setVal(document.getElementById('sdlg_machineLocation'), loc);
    setVal(document.getElementById('sdlg_repairLabor'), c.labour_hrs != null ? String(c.labour_hrs) : '');
    setVal(document.getElementById('sdlg_serviceMileage'), c.mileage_km != null ? String(c.mileage_km) : '');

    var h = Number(c.labour_hrs) || Number((document.getElementById('sdlg_repairLabor') || {}).value) || 0;
    var k = Number(c.mileage_km) || Number((document.getElementById('sdlg_serviceMileage') || {}).value) || 0;
    if (h > 0) setVal(document.getElementById('sdlg_labourAmount'), (h * 25).toFixed(2));
    if (k > 0) setVal(document.getElementById('sdlg_mileageAmount'), (k * 0.5).toFixed(2));
    var la = Number((document.getElementById('sdlg_labourAmount') || {}).value) || 0;
    var ma = Number((document.getElementById('sdlg_mileageAmount') || {}).value) || 0;
    var ot = Number((document.getElementById('sdlg_otherAmount') || {}).value) || 0;
    setVal(document.getElementById('sdlg_totalAmount'), (la + ma + ot).toFixed(2));

    try {
      console.info(
        '[SDLG inline-v3] forced',
        c.claim_id,
        'repair=',
        pickRepair(c),
        'loc=',
        loc.slice(0, 50),
        'report=',
        report.slice(0, 50)
      );
    } catch (e) {}
  }

  function tick() {
    try {
      if (!document.querySelector('[data-sdlg-input-helper]')) return;
      var c = window.__SDLG_LIVE_CLAIM__;
      if (!c || !c.claim_id) return;

      var hrsEl = document.getElementById('sdlg_repairLabor');
      var h = hrsEl ? Number(String(hrsEl.value).replace(/[^0-9.]/g, '')) : 0;
      if (!(h > 0) && c.labour_hrs != null) h = Number(c.labour_hrs) || 0;
      if (h > 0) setVal(document.getElementById('sdlg_labourAmount'), (h * 25).toFixed(2));
      var kmEl = document.getElementById('sdlg_serviceMileage');
      var k = kmEl ? Number(String(kmEl.value).replace(/[^0-9.]/g, '')) : 0;
      if (!(k > 0) && c.mileage_km != null) k = Number(c.mileage_km) || 0;
      if (k > 0) setVal(document.getElementById('sdlg_mileageAmount'), (k * 0.5).toFixed(2));

      if (drift(c)) {
        forceFromLive(c);
        try {
          if (window.SDLGInputHydrate && typeof window.SDLGInputHydrate.apply === 'function') {
            window.SDLGInputHydrate.apply(c);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  setInterval(tick, 600);
  [300, 800, 1500, 2500, 4000].forEach(function (ms) {
    setTimeout(tick, ms);
  });
  console.info('[SDLG inline-enforcer] v3 loaded');
})();
