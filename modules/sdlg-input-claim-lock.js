/**
 * SDLG Input claim-lock v1.4
 * ONLY trust select[value*=SDLG-PFR] or data-claim-id. Never body.innerText.
 * Null-safe activeClaimId (no crash when body/helper root missing).
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_INPUT_CLAIM_LOCK_V14__) return;
    root.__SDLG_INPUT_CLAIM_LOCK_V14__ = true;
    root.__SDLG_INPUT_CLAIM_LOCK_V13__ = true;
    root.__SDLG_INPUT_CLAIM_LOCK_V12__ = true;

    function portalDate(value) {
      var s = String(value || '').trim();
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
    }

    function setInput(id, value) {
      var el = document.getElementById(id);
      if (!el) return;
      var v = value == null ? '' : String(value);
      if (String(el.value || '') === v) return;
      el.value = v;
      try {
        el.defaultValue = v;
        el.setAttribute('value', v);
        el.setAttribute('autocomplete', 'off');
        el.setAttribute('data-claim-locked', '1');
      } catch (_) {}
    }

    function setByLabel(label, value) {
      var v = value == null ? '' : String(value);
      document.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
        if ((el.getAttribute('data-label') || '') === label) {
          if (String(el.value || '') === v) return;
          el.value = v;
          try {
            el.defaultValue = v;
            el.setAttribute('value', v);
            el.setAttribute('autocomplete', 'off');
            el.setAttribute('data-claim-locked', '1');
          } catch (_) {}
        }
      });
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

    function activeClaimId() {
      try {
        var sels = document.querySelectorAll('select');
        for (var i = 0; i < sels.length; i++) {
          var v = String(sels[i].value || '').trim();
          if (/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(v)) return v;
        }
        var page = document.querySelector('[data-sdlg-input-helper]') || document.body || document.documentElement;
        if (!page) return '';
        var rootClaim = (page.getAttribute && page.getAttribute('data-claim-id')) || '';
        if (rootClaim && /^\d{3,4}-\d{4}-SDLG-PFR$/i.test(rootClaim)) return rootClaim.trim();
        var nodes = page.querySelectorAll ? page.querySelectorAll('[data-claim-id]') : [];
        for (var j = 0; j < nodes.length; j++) {
          var id = String(nodes[j].getAttribute('data-claim-id') || '').trim();
          if (/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(id)) return id;
        }
        var divs = page.querySelectorAll ? page.querySelectorAll('div') : [];
        for (var k = 0; k < divs.length; k++) {
          if (/^CLAIM$/i.test(String(divs[k].textContent || '').trim())) {
            var next = divs[k].nextElementSibling;
            var t = String((next && next.textContent) || '').trim();
            if (/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(t)) return t;
            var m = t.match(/^(\d{3,4}-\d{4}-SDLG-PFR)/i);
            if (m) return m[1];
          }
        }
        var hash = String((root.location && root.location.hash) || '');
        var hm = hash.match(/(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i);
        if (hm) {
          var seg = decodeURIComponent(hm[1]);
          if (/^\d{3,4}-\d{4}-SDLG-PFR$/i.test(seg)) return seg;
        }
      } catch (_) {}
      return '';
    }

    function applyClaim(c) {
      if (!c || !c.claim_id) return;
      var uiId = activeClaimId();
      if (uiId && String(uiId).toUpperCase() !== String(c.claim_id).toUpperCase()) {
        try { console.warn('[SDLG claim-lock] refuse', c.claim_id, 'ui=', uiId); } catch (_) {}
        return;
      }
      var report = buildReportName(c);
      document.querySelectorAll('[data-sdlg-report-body]').forEach(function (el) {
        if (String(el.textContent || '') !== report) el.textContent = report;
        el.setAttribute('data-claim-id', c.claim_id);
      });
      setInput('sdlg_serviceType', 'Repair');
      setInput('sdlg_serviceMethod', c.repair_method || c.service_method || '');
      setInput('sdlg_serialNumber', c.serial_no || c.canonical_serial_no || '');
      setInput('sdlg_hourMeter', c.hm_failure != null ? String(c.hm_failure) : '');
      var repairStr = portalDate(c.dealer_repair_date || c.completion_date || c.failure_date);
      setInput('sdlg_repairDate', repairStr);
      setByLabel('Date of repair report', repairStr);
      setInput('sdlg_failureDate', portalDate(c.failure_date));
      setInput('sdlg_complaint', c.fault_description || '');
      setInput('sdlg_faultDetails', [c.cause_analyze, c.comment].filter(Boolean).join('\n\n'));
      var loc = [c.dealer_wo_so || c.wo_so || '', c.branch || '', c.customer || '']
        .map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ');
      setInput('sdlg_machineLocation', loc);
      setByLabel('Machine Location', loc);
      setInput('sdlg_repairLabor', c.labour_hrs != null ? String(c.labour_hrs) : '');
      setInput('sdlg_serviceMileage', c.mileage_km != null ? String(c.mileage_km) : '');
      var tech = String(c.technical_personnel || c.feedback_person || '').replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '');
      setInput('sdlg_feedbackPerson', tech);
      setByLabel('Feedback Person', tech);
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
      timer = setTimeout(function () { hydrate(id || activeClaimId()); }, 50);
    }

    root.SDLGInputClaimLock = { version: '1.4.0', hydrate: hydrate, applyClaim: applyClaim, activeClaimId: activeClaimId };

    root.addEventListener('hashchange', function () { schedule(activeClaimId()); });
    root.addEventListener('sdlg-route', function () { schedule(activeClaimId()); });
    root.addEventListener('sdlg-input-claim', function (e) { schedule((e.detail && e.detail.claimId) || activeClaimId()); });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'SELECT') return;
      var v = String(t.value || '').trim();
      if (/SDLG-PFR/i.test(v)) schedule(v);
    }, true);

    setInterval(function () {
      if (!document.querySelector('[data-sdlg-input-helper], [data-sdlg-field]')) return;
      var id = activeClaimId();
      if (!id) return;
      var live = root.__SDLG_LIVE_CLAIM__;
      if (live && live.claim_id === id) applyClaim(live);
      else hydrate(id);
    }, 2000);

    setTimeout(function () { schedule(activeClaimId()); }, 200);
    setTimeout(function () { schedule(activeClaimId()); }, 800);
    setTimeout(function () { schedule(activeClaimId()); }, 2000);
  } catch (e) {
    try { console.warn('[SDLG claim-lock]', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
