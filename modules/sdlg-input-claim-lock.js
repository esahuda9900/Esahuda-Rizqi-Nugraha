/**
 * SDLG Input claim-lock v1.1
 * Source of truth: <select> / CLAIM badge, NEVER stale hash alone.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_INPUT_CLAIM_LOCK_V11__) return;
    root.__SDLG_INPUT_CLAIM_LOCK_V11__ = true;
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
        try { el.defaultValue = v; el.setAttribute('value', v); } catch (_) {}
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
      if (complaint.length > 80) complaint = complaint.slice(0, 77).replace(/\s+\S*$/, '').trim() + '\u2026';
      var machine = model && short ? 'SDLG ' + model + ' SN.' + short : model ? 'SDLG ' + model : 'SDLG';
      var pfrMatch = String(c.claim_id || '').match(/^(\d+)-\d{4}-SDLG-PFR$/i);
      var pfr = pfrMatch ? 'PFR' + pfrMatch[1] : String(c.claim_id || '');
      var claimNo = String(c.dealer_claim_no || c.claim_no || c.sdlg_no || '').trim();
      var wo = String(c.dealer_wo_so || c.wo_so || '').trim();
      return [machine, hm ? hm + ' hr' : '', complaint, pfr, claimNo, wo].filter(Boolean).join(', ');
    }

    function extractClaimId(text) {
      var m = String(text || '').match(/(\d{3,4}-\d{4}-SDLG-PFR)/i);
      return m ? m[1] : '';
    }

    function activeClaimId() {
      var page = document.querySelector('[data-sdlg-input-helper]') || document.querySelector('.page') || document.body;
      var sels = page.querySelectorAll('select');
      for (var i = 0; i < sels.length; i++) {
        var v = String(sels[i].value || '').trim();
        if (/SDLG-PFR/i.test(v)) return v;
      }
      var divs = page.querySelectorAll('div');
      for (var j = 0; j < divs.length; j++) {
        if (/^CLAIM$/i.test(String(divs[j].textContent || '').trim())) {
          var next = divs[j].nextElementSibling;
          var id = extractClaimId(next && next.textContent);
          if (id) return id;
          id = extractClaimId(divs[j].parentElement && divs[j].parentElement.textContent);
          if (id) return id;
        }
      }
      try {
        if (root.SDLGHashRouter && root.SDLGHashRouter.claimId) {
          var hid = String(root.SDLGHashRouter.claimId() || '').trim();
          if (/SDLG-PFR/i.test(hid)) return hid;
        }
      } catch (_) {}
      return '';
    }

    function applyClaim(c) {
      if (!c || !c.claim_id) return;
      var uiId = activeClaimId();
      if (uiId && String(uiId).toUpperCase() !== String(c.claim_id).toUpperCase()) {
        try { console.warn('[SDLG claim-lock] skip apply', c.claim_id, 'ui=', uiId); } catch (_) {}
        return;
      }
      var report = buildReportName(c);
      document.querySelectorAll('[data-sdlg-report-body]').forEach(function (reportEl) {
        reportEl.textContent = report;
        reportEl.setAttribute('data-claim-id', c.claim_id);
      });
      document.querySelectorAll('[data-sdlg-copy-report-name]').forEach(function (el) {
        el.setAttribute('data-value', report);
      });
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

    async function hydrate(claimId) {
      claimId = String(claimId || activeClaimId() || '').trim();
      if (!claimId || !/SDLG-PFR/i.test(claimId)) return;
      var client = (typeof root.getSdlgSupabase === 'function' && root.getSdlgSupabase()) || root.supabaseClient || root.sdlgSupabase || null;
      if (!client || !client.from) return;
      try {
        var res = await client.from('claims').select('*').eq('claim_id', claimId).maybeSingle();
        if (res.error) throw res.error;
        if (res.data) applyClaim(res.data);
      } catch (e) {
        try { console.warn('[SDLG claim-lock] hydrate failed', claimId, e); } catch (_) {}
      }
    }

    var timer = null;
    function schedule(id) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { hydrate(id || activeClaimId()); }, 60);
    }

    root.SDLGInputClaimLock = { version: '1.1.0', hydrate: hydrate, applyClaim: applyClaim, activeClaimId: activeClaimId };

    root.addEventListener('hashchange', function () { schedule(activeClaimId()); });
    root.addEventListener('sdlg-route', function () { schedule(activeClaimId()); });
    root.addEventListener('sdlg-input-claim', function (e) { schedule((e.detail && e.detail.claimId) || activeClaimId()); });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'SELECT') return;
      var v = String(t.value || '').trim();
      if (/SDLG-PFR/i.test(v)) {
        try { if (root.SDLGInputClaimSync && root.SDLGInputClaimSync.lockUrl) root.SDLGInputClaimSync.lockUrl(v); } catch (_) {}
        schedule(v);
      }
    }, true);

    setTimeout(function () { schedule(activeClaimId()); }, 300);
    setTimeout(function () { schedule(activeClaimId()); }, 900);
    setTimeout(function () { schedule(activeClaimId()); }, 2000);
  } catch (e) {
    try { console.warn('[SDLG claim-lock]', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
