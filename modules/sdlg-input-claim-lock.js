/**
 * SDLG Input claim-lock v1 — ALWAYS hydrate fields from a fresh Supabase row.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_INPUT_CLAIM_LOCK_V1__) return;
    root.__SDLG_INPUT_CLAIM_LOCK_V1__ = true;

    function portalDate(value) {
      var s = String(value || '').trim();
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
    }

    function setInput(id, value) {
      var el = document.getElementById(id);
      if (!el) return;
      var v = value == null ? '' : String(value);
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = v;
        try { el.setAttribute('value', v); } catch (_) {}
      } else {
        el.textContent = v;
      }
    }

    function buildReportName(c) {
      if (!c) return '';
      var model = String(c.model || '').trim();
      var serial = String(c.serial_no || c.canonical_serial_no || '').trim();
      var short = serial.replace(/\s+/g, '').slice(-6);
      var hm = c.hm_failure != null && c.hm_failure !== '' ? String(c.hm_failure) : '';
      var complaint = String(c.fault_description || '').trim().replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
      if (complaint.length > 56) complaint = complaint.slice(0, 53).replace(/\s+\S*$/, '').trim() + '\u2026';
      var machine = model && short ? 'SDLG ' + model + ' SN.' + short : model ? 'SDLG ' + model : 'SDLG';
      var pfrMatch = String(c.claim_id || '').match(/^(\d+)-\d{4}-SDLG-PFR$/i);
      var pfr = pfrMatch ? 'PFR' + pfrMatch[1] : String(c.claim_id || '');
      var claimNo = String(c.dealer_claim_no || c.claim_no || c.sdlg_no || '').trim();
      var wo = String(c.dealer_wo_so || c.wo_so || '').trim();
      return [machine, hm ? hm + ' hr' : 'HM.\u2014', complaint || 'Complaint \u2014', pfr || 'PFR\u2014', claimNo || 'Claim\u2014', wo || 'WO\u2014'].filter(Boolean).join(', ');
    }

    function applyClaim(c) {
      if (!c || !c.claim_id) return;
      var report = buildReportName(c);
      var reportEl = document.querySelector('[data-sdlg-report-body]');
      if (reportEl) {
        reportEl.textContent = report;
        reportEl.setAttribute('data-claim-id', c.claim_id);
      }
      var copyReport = document.querySelector('[data-sdlg-copy-report-name]');
      if (copyReport) copyReport.setAttribute('data-value', report);

      setInput('sdlg_serviceType', 'Repair');
      setInput('sdlg_serviceMethod', c.repair_method || c.service_method || '');
      setInput('sdlg_serialNumber', c.serial_no || c.canonical_serial_no || '');
      setInput('sdlg_hourMeter', c.hm_failure != null ? String(c.hm_failure) : '');
      setInput('sdlg_repairDate', portalDate(c.dealer_repair_date || c.completion_date || c.failure_date));
      setInput('sdlg_failureDate', portalDate(c.failure_date));
      setInput('sdlg_complaint', c.fault_description || '');
      setInput('sdlg_faultDetails', [c.cause_analyze, c.comment].filter(Boolean).join('\n\n'));
      var wo = c.dealer_wo_so || c.wo_so || '';
      var branch = c.branch || '';
      var customer = c.customer || '';
      setInput('sdlg_machineLocation', [wo, branch, customer].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' '));
      setInput('sdlg_repairLabor', c.labour_hrs != null ? String(c.labour_hrs) : '');
      setInput('sdlg_serviceMileage', c.mileage_km != null ? String(c.mileage_km) : '');
      var tech = String(c.technical_personnel || c.feedback_person || '').replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '');
      setInput('sdlg_feedbackPerson', tech);
      setInput('sdlg_feedbackContact', c.feedback_contact || c.technician_contact || c.technical_personnel_phone || '');

      try { root.localStorage.setItem('sdlg-warranty:last-sdlginput-claim:v1', c.claim_id); } catch (_) {}
      root.__SDLG_LIVE_CLAIM__ = c;
    }

    function activeClaimId() {
      try {
        if (root.SDLGInputClaimSync && root.SDLGInputClaimSync.fromHash) {
          var h = root.SDLGInputClaimSync.fromHash();
          if (h) return h;
        }
      } catch (_) {}
      try {
        if (root.SDLGHashRouter && root.SDLGHashRouter.claimId) {
          var id = root.SDLGHashRouter.claimId();
          if (id) return id;
        }
      } catch (_) {}
      var sel = document.querySelector('[data-sdlg-input-helper] select') || document.querySelector('select');
      if (sel && sel.value && /SDLG-PFR/i.test(sel.value)) return String(sel.value).trim();
      return '';
    }

    async function hydrate(claimId) {
      claimId = String(claimId || activeClaimId() || '').trim();
      if (!claimId || !/SDLG-PFR/i.test(claimId)) return;
      var client = (typeof root.getSdlgSupabase === 'function' && root.getSdlgSupabase()) || root.supabaseClient || null;
      if (!client || !client.from) return;
      try {
        var res = await client.from('claims').select('*').eq('claim_id', claimId).maybeSingle();
        if (res.error) throw res.error;
        if (res.data) {
          applyClaim(res.data);
          if (root.SDLGInputClaimSync && root.SDLGInputClaimSync.integrityCheck) root.SDLGInputClaimSync.integrityCheck();
        }
      } catch (e) {
        try { console.warn('[SDLG claim-lock] hydrate failed', claimId, e); } catch (_) {}
      }
    }

    var timer = null;
    function schedule(id) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { hydrate(id); }, 80);
    }

    root.SDLGInputClaimLock = { version: '1.0.0', hydrate: hydrate, applyClaim: applyClaim };

    root.addEventListener('hashchange', function () { schedule(activeClaimId()); });
    root.addEventListener('sdlg-route', function () { schedule(activeClaimId()); });
    root.addEventListener('sdlg-input-claim', function (e) { schedule((e.detail && e.detail.claimId) || activeClaimId()); });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'SELECT') return;
      var v = String(t.value || '').trim();
      if (/SDLG-PFR/i.test(v)) schedule(v);
    }, true);

    setTimeout(function () { schedule(activeClaimId()); }, 400);
    setTimeout(function () { schedule(activeClaimId()); }, 1200);
    setTimeout(function () { schedule(activeClaimId()); }, 2500);
  } catch (e) {
    try { console.warn('[SDLG claim-lock]', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
