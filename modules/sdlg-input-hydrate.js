/**
 * SDLG Input Hydrate v1.3 — ONLY writer + nuclear enforcer for repair date.
 * Every 500ms: if #sdlg_repairDate is 19/07/2024 on non-0429 claim → force correct date.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_INPUT_HYDRATE_V13__) return;
  root.__SDLG_INPUT_HYDRATE_V13__ = true;
  root.__SDLG_INPUT_HYDRATE_V1__ = true;

  var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;
  var busy = false;
  var lastValues = null;
  var lastGoodRepair = {}; // claimId → repairStr

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

  function claimYear(id) {
    var m = String(id || '').match(/-(\d{4})-SDLG-PFR/i);
    return m ? Number(m[1]) : null;
  }

  function dateYear(ddmmyyyy) {
    var m = String(ddmmyyyy || '').match(/(\d{4})$/);
    return m ? Number(m[1]) : null;
  }

  function isForbiddenRepair(formatted, claimId) {
    if (!formatted) return false;
    if (String(claimId) === '0429-2024-SDLG-PFR') return false;
    if (/19[\/\-]0?7[\/\-]2024/.test(formatted)) return true;
    var cy = claimYear(claimId);
    var dy = dateYear(formatted);
    if (cy && dy && Math.abs(cy - dy) > 1) return true;
    return false;
  }

  function pickRepairDate(c) {
    if (!c) return '';
    var candidates = [
      c.dealer_repair_date,
      c.completion_date,
      c.repair_date,
      c.failure_date
    ];
    for (var i = 0; i < candidates.length; i++) {
      var raw = candidates[i];
      if (raw == null || String(raw).trim() === '') continue;
      var formatted = portalDate(raw);
      if (isForbiddenRepair(formatted, c.claim_id)) continue;
      return formatted;
    }
    return portalDate(c.failure_date || '');
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
      el.setAttribute('data-lpignore', 'true');
    } catch (_) {}
    try { console.info('[SDLG hydrate] write', tag || el.id, '=', v.slice(0, 80)); } catch (_) {}
  }

  function setVal(id, label, value) {
    var v = value == null ? '' : String(value);
    // set ALL matching elements (duplicate roots possible)
    var byId = document.getElementById(id);
    forceSet(byId, v, id);
    document.querySelectorAll('[id="' + id + '"]').forEach(function (el) {
      forceSet(el, v, id);
    });
    if (label) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (node) {
        if ((node.getAttribute('data-label') || '') === label) forceSet(node, v, label);
      });
    }
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
    });

    var repairStr = pickRepairDate(c);
    lastGoodRepair[c.claim_id] = repairStr;

    var loc = [c.dealer_wo_so || c.wo_so || '', c.branch || '', c.customer || '']
      .map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ');
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
    setVal('sdlg_repairDate', 'Date of repair report', repairStr);
    setVal('sdlg_complaint', 'Complaint', c.fault_description || '');
    setVal('sdlg_faultDetails', 'Fault Details', [c.cause_analyze, c.comment].filter(Boolean).join('\n\n'));
    setVal('sdlg_machineLocation', 'Machine Location', loc);
    setVal('sdlg_repairLabor', 'Repair Labor (Hrs)', c.labour_hrs != null ? String(c.labour_hrs) : '');
    setVal('sdlg_serviceMileage', 'Service Mileage (Km)', c.mileage_km != null ? String(c.mileage_km) : '');

    scrubKosong();

    root.__SDLG_LIVE_CLAIM__ = c;
    lastValues = { claim_id: c.claim_id, repair: repairStr, loc: loc, report: report, person: tech };
    try {
      console.info('[SDLG hydrate] OK', c.claim_id, 'repair=', repairStr,
        'raw=', c.dealer_repair_date, c.completion_date, c.failure_date);
    } catch (_) {}

    try {
      if (root.SDLGPortalFinance && typeof root.SDLGPortalFinance.recompute === 'function') {
        setTimeout(function () { root.SDLGPortalFinance.recompute(); }, 30);
        setTimeout(function () { root.SDLGPortalFinance.recompute(); }, 300);
      }
    } catch (_) {}
  }

  function scrubKosong() {
    try {
      document.querySelectorAll('[data-sdlg-input-helper] *').forEach(function (n) {
        if (n.childNodes && n.childNodes.length === 1 && n.childNodes[0].nodeType === 3) {
          if (/^\s*Kosong\s*$/i.test(n.textContent || '')) n.textContent = '\u2014';
        }
      });
    } catch (_) {}
  }

  function enforceRepairDate() {
    var id = hashClaimId();
    if (!id || id === '0429-2024-SDLG-PFR') return;
    var good = lastGoodRepair[id];
    if (!good && root.__SDLG_LIVE_CLAIM__ && String(root.__SDLG_LIVE_CLAIM__.claim_id) === id) {
      good = pickRepairDate(root.__SDLG_LIVE_CLAIM__);
      if (good) lastGoodRepair[id] = good;
    }
    var nodes = document.querySelectorAll('#sdlg_repairDate, [data-label="Date of repair report"]');
    nodes.forEach(function (el) {
      var cur = String(el.value || el.getAttribute('value') || '').trim();
      if (isForbiddenRepair(cur, id)) {
        var next = good || (root.__SDLG_LIVE_CLAIM__ && String(root.__SDLG_LIVE_CLAIM__.claim_id) === id
          ? pickRepairDate(root.__SDLG_LIVE_CLAIM__)
          : '');
        if (!next && root.__SDLG_LIVE_CLAIM__ && String(root.__SDLG_LIVE_CLAIM__.claim_id) === id) {
          next = portalDate(root.__SDLG_LIVE_CLAIM__.failure_date || '');
        }
        if (next && next !== cur) {
          forceSet(el, next, 'ENFORCE repairDate');
        }
      }
    });
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
    if (live && String(live.claim_id) === id) apply(live);

    var client = getClient();
    if (!client || !client.from) {
      enforceRepairDate();
      return;
    }

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
      enforceRepairDate();
    }
  }

  var timer = null;
  function schedule(id) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { hydrate(id); }, 60);
  }

  root.SDLGInputHydrate = {
    version: '1.3.0',
    hydrate: hydrate,
    apply: apply,
    hashClaimId: hashClaimId,
    lastValues: function () { return lastValues; },
    enforceRepairDate: enforceRepairDate
  };

  root.addEventListener('hashchange', function () { lastValues = null; schedule(); });
  root.addEventListener('sdlg-route', function () { lastValues = null; schedule(); });
  root.addEventListener('sdlg-input-claim', function (e) {
    lastValues = null;
    schedule(e.detail && e.detail.claimId);
  });
  root.addEventListener('sdlg-session-ready', function () { schedule(); });

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

  [100, 400, 800, 1200, 2000, 3500, 5000].forEach(function (ms) {
    setTimeout(function () { schedule(); }, ms);
  });

  // Nuclear enforcer — wins over any late writer
  setInterval(function () {
    enforceRepairDate();
    scrubKosong();
    // if repair still forbidden and we have live claim, full re-apply
    var id = hashClaimId();
    if (!id) return;
    var el = document.getElementById('sdlg_repairDate');
    var cur = el ? String(el.value || '') : '';
    if (isForbiddenRepair(cur, id) && root.__SDLG_LIVE_CLAIM__ && String(root.__SDLG_LIVE_CLAIM__.claim_id) === id) {
      apply(root.__SDLG_LIVE_CLAIM__);
    }
  }, 500);
})(typeof window !== 'undefined' ? window : this);
