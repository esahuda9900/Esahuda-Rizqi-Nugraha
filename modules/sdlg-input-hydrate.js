/**
 * SDLG Input Hydrate v1.0 — SINGLE source of truth for portal Home fields.
 *
 * Rules:
 * 1. Only runs on #/sdlg-input/* or when [data-sdlg-input-helper] exists.
 * 2. Claim id from HASH only (never body text, never first <select> option).
 * 3. Fetches ONE row from Supabase by claim_id.
 * 4. Writes ALL home fields in one pass.
 * 5. Guard: refuse if claim_id !== hash claim id.
 * 6. No MutationObserver spam — hashchange + select change + one delayed retry.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_INPUT_HYDRATE_V1__) return;
  root.__SDLG_INPUT_HYDRATE_V1__ = true;

  var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;
  var busy = false;
  var lastKey = '';
  var lastValues = null;

  function hashClaimId() {
    try {
      var h = String((root.location && root.location.hash) || '');
      var m = h.match(/(?:sdlg-input|sdlginput)\/([^/?#]+)/i);
      if (!m) {
        // also allow #/claims/ID when user opened claim detail then jumped — but only if helper DOM present
        m = h.match(/(?:claims|claim)\/([^/?#]+)/i);
        if (!m || !document.querySelector('[data-sdlg-input-helper], #sdlg_repairDate, [data-sdlg-field]')) return '';
      }
      var seg = decodeURIComponent(m[1]).trim();
      return RE.test(seg) ? seg : '';
    } catch (_) { return ''; }
  }

  function portalDate(v) {
    var s = String(v || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
  }

  function setVal(id, label, value) {
    var v = value == null ? '' : String(value);
    var el = document.getElementById(id);
    if (el) {
      if (String(el.value || '') !== v) {
        el.value = v;
        try {
          el.defaultValue = v;
          el.setAttribute('value', v);
          el.setAttribute('autocomplete', 'off');
          el.setAttribute('data-hydrate', '1');
        } catch (_) {}
      }
    }
    if (label) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (node) {
        if ((node.getAttribute('data-label') || '') === label) {
          if (String(node.value || '') !== v) {
            node.value = v;
            try {
              node.defaultValue = v;
              node.setAttribute('value', v);
              node.setAttribute('autocomplete', 'off');
              node.setAttribute('data-hydrate', '1');
            } catch (_) {}
          }
        }
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

    // Sync claim selects to this id (prevent first-option 0429 bleed)
    try {
      document.querySelectorAll('select').forEach(function (s) {
        var has = false;
        for (var i = 0; i < s.options.length; i++) {
          if (String(s.options[i].value || '') === c.claim_id) { has = true; break; }
        }
        if (has && String(s.value || '') !== c.claim_id) s.value = c.claim_id;
      });
    } catch (_) {}

    var report = buildReport(c);
    document.querySelectorAll('[data-sdlg-report-body]').forEach(function (el) {
      if (String(el.textContent || '') !== report) el.textContent = report;
      el.setAttribute('data-claim-id', c.claim_id);
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
    lastKey = c.claim_id;
    lastValues = {
      claim_id: c.claim_id,
      repair: repairStr,
      loc: loc,
      report: report,
      person: tech
    };
    try {
      console.info('[SDLG hydrate] OK', c.claim_id, 'repair=', repairStr, 'wo=', c.dealer_wo_so || c.wo_so || '(none)');
    } catch (_) {}
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

    // Prefer live claim already loaded by React if it matches hash
    var live = root.__SDLG_LIVE_CLAIM__;
    if (live && String(live.claim_id) === id && !forceId) {
      apply(live);
      return;
    }

    var client = getClient();
    if (!client || !client.from) return;

    busy = true;
    try {
      var res = await client.from('claims').select('*').eq('claim_id', id).maybeSingle();
      if (res.error) throw res.error;
      // re-check hash after await
      var still = hashClaimId();
      if (still && still !== id) return;
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
    timer = setTimeout(function () { hydrate(id); }, 60);
  }

  root.SDLGInputHydrate = {
    version: '1.0.0',
    hydrate: hydrate,
    apply: apply,
    hashClaimId: hashClaimId,
    lastValues: function () { return lastValues; }
  };

  // Global kill-switches for competing writers
  root.__SDLG_DISABLE_CLAIM_LOCK_FIELD_WRITES__ = true;
  root.__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__ = true;
  root.__SDLG_DISABLE_FB_FIX_WRITES__ = true;

  root.addEventListener('hashchange', function () { lastKey = ''; schedule(); });
  root.addEventListener('sdlg-route', function () { lastKey = ''; schedule(); });
  root.addEventListener('sdlg-input-claim', function (e) {
    lastKey = '';
    schedule(e.detail && e.detail.claimId);
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'SELECT') return;
    var v = String(t.value || '').trim();
    if (!RE.test(v)) return;
    try {
      var h = String(root.location.hash || '');
      if (/sdlg-input|sdlginput/i.test(h) || document.querySelector('[data-sdlg-input-helper]')) {
        if (hashClaimId() !== v) root.location.hash = '#/sdlg-input/' + encodeURIComponent(v);
      }
    } catch (_) {}
    lastKey = '';
    schedule(v);
  }, true);

  // Single delayed pass after paint — no setInterval thrash
  setTimeout(function () { schedule(); }, 200);
  setTimeout(function () { schedule(); }, 800);
  setTimeout(function () { schedule(); }, 2000);

  // Soft integrity check every 5s — only re-hydrate if repair field drifted to wrong claim signature
  setInterval(function () {
    var id = hashClaimId();
    if (!id || !lastValues || lastValues.claim_id !== id) {
      if (id) schedule(id);
      return;
    }
    var el = document.getElementById('sdlg_repairDate');
    if (!el) return;
    var cur = String(el.value || '');
    if (cur && lastValues.repair && cur !== lastValues.repair) {
      try { console.warn('[SDLG hydrate] drift detected', cur, '→', lastValues.repair); } catch (_) {}
      schedule(id);
    }
  }, 5000);
})(typeof window !== 'undefined' ? window : this);
