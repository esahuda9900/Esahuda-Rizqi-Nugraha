/**
 * SDLG Input claim-lock v1.5
 * HASH / LIVE CLAIM first. Select is LAST resort and only if it matches hash.
 * Prevents 0429 (first option) from overwriting 0251 when select is desynced.
 */
(function (root) {
  'use strict';
  try {
    if (root.__SDLG_INPUT_CLAIM_LOCK_V15__) return;
    root.__SDLG_INPUT_CLAIM_LOCK_V15__ = true;
    root.__SDLG_INPUT_CLAIM_LOCK_V14__ = true;

    var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;

    function portalDate(value) {
      var s = String(value || '').trim();
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
    }

    function hashClaimId() {
      try {
        var h = String((root.location && root.location.hash) || '');
        var m = h.match(/(?:sdlg-input|sdlginput|claims|claim)\/([^/?#]+)/i);
        if (!m) return '';
        var seg = decodeURIComponent(m[1]).trim();
        return RE.test(seg) ? seg : '';
      } catch (_) { return ''; }
    }

    function syncSelectTo(id) {
      if (!id || !RE.test(id)) return;
      try {
        var sels = document.querySelectorAll('select');
        for (var i = 0; i < sels.length; i++) {
          var s = sels[i];
          var has = false;
          for (var j = 0; j < s.options.length; j++) {
            if (String(s.options[j].value || '') === id) { has = true; break; }
          }
          if (!has) continue;
          if (String(s.value || '') !== id) {
            s.value = id;
            try { s.setAttribute('data-claim-synced', id); } catch (_) {}
          }
        }
      } catch (_) {}
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
        // 1) Hash route is source of truth on SDLG Input / claim pages
        var fromHash = hashClaimId();
        if (fromHash) {
          syncSelectTo(fromHash);
          return fromHash;
        }
        // 2) Live claim already fetched by React
        var live = root.__SDLG_LIVE_CLAIM__;
        if (live && live.claim_id && RE.test(String(live.claim_id))) {
          syncSelectTo(String(live.claim_id));
          return String(live.claim_id);
        }
        // 3) data-claim-id on helper root
        var page = document.querySelector('[data-sdlg-input-helper]') || document.body || document.documentElement;
        if (page && page.getAttribute) {
          var rootClaim = String(page.getAttribute('data-claim-id') || '').trim();
          if (RE.test(rootClaim)) return rootClaim;
        }
        if (page && page.querySelectorAll) {
          var nodes = page.querySelectorAll('[data-claim-id]');
          for (var j = 0; j < nodes.length; j++) {
            var id = String(nodes[j].getAttribute('data-claim-id') || '').trim();
            if (RE.test(id)) return id;
          }
          var divs = page.querySelectorAll('div');
          for (var k = 0; k < divs.length; k++) {
            if (/^CLAIM$/i.test(String(divs[k].textContent || '').trim())) {
              var next = divs[k].nextElementSibling;
              var t = String((next && next.textContent) || '').trim();
              if (RE.test(t)) return t;
              var m = t.match(/^(\d{3,4}-\d{4}-SDLG-PFR)/i);
              if (m) return m[1];
            }
          }
        }
        // 4) Select LAST — only if single consistent value
        var sels = document.querySelectorAll('select');
        var found = '';
        for (var i = 0; i < sels.length; i++) {
          var v = String(sels[i].value || '').trim();
          if (RE.test(v)) {
            if (!found) found = v;
            else if (found !== v) return found; // conflict → keep first, ignore others
          }
        }
        return found;
      } catch (_) {}
      return '';
    }

    function applyClaim(c) {
      if (!c || !c.claim_id) return;
      var want = hashClaimId() || activeClaimId();
      if (want && String(want).toUpperCase() !== String(c.claim_id).toUpperCase()) {
        try { console.warn('[SDLG claim-lock] refuse', c.claim_id, 'want=', want); } catch (_) {}
        return;
      }
      syncSelectTo(c.claim_id);
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
      if (!claimId || !RE.test(claimId)) return;
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
      timer = setTimeout(function () { hydrate(id || activeClaimId()); }, 40);
    }

    root.SDLGInputClaimLock = { version: '1.5.0', hydrate: hydrate, applyClaim: applyClaim, activeClaimId: activeClaimId };

    root.addEventListener('hashchange', function () { schedule(hashClaimId()); });
    root.addEventListener('sdlg-route', function () { schedule(hashClaimId()); });
    root.addEventListener('sdlg-input-claim', function (e) { schedule((e.detail && e.detail.claimId) || hashClaimId()); });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'SELECT') return;
      var v = String(t.value || '').trim();
      if (!RE.test(v)) return;
      // User intentionally changed claim via dropdown → update hash if on input page
      try {
        var h = String(root.location.hash || '');
        if (/sdlg-input|sdlginput/i.test(h) || !h) {
          root.location.hash = '#/sdlg-input/' + encodeURIComponent(v);
        }
      } catch (_) {}
      schedule(v);
    }, true);

    setInterval(function () {
      if (!document.querySelector('[data-sdlg-input-helper], [data-sdlg-field]')) return;
      var id = activeClaimId();
      if (!id) return;
      syncSelectTo(id);
      var live = root.__SDLG_LIVE_CLAIM__;
      if (live && live.claim_id === id) applyClaim(live);
      else hydrate(id);
    }, 2500);

    setTimeout(function () { schedule(activeClaimId()); }, 150);
    setTimeout(function () { schedule(activeClaimId()); }, 600);
    setTimeout(function () { schedule(activeClaimId()); }, 1800);
  } catch (e) {
    try { console.warn('[SDLG claim-lock]', e); } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : this);
