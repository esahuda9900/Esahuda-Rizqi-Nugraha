(function () {
  'use strict';

  // Canonical portal helper: always prefer Supabase claim + warranty RPC over stale UI defaults.
  // v1.2.2 — Safe field fill only (no querySelectorAll broadcast). Columns fix retained.
  // v1.2.0 — Repair Date mapping, empty-field fill, Feedback Person name-only (no Technician prefix),
  // amounts + mileage, safer re-apply when UI left blanks.

  var CLAIM_SELECT = [
    'claim_id','model','serial_no','customer','repair_method','technical_personnel',
    'causing_part_no','causing_part_desc','failure_part_location','fault_description',
    'cause_analyze','comment','parts','hm_failure','hm_completion','sales_date',
    'failure_date','dealer_repair_date','completion_date','dealer_claim_date',
    'labour_amount','mileage_amount','other_amount','total_amount','mileage_km'
    // service_type / work_location / branch_name removed — columns do not exist on public.claims
  ].join(',');

  var scheduled = false;
  var lastAppliedKey = '';
  var runSequence = 0;

  function clean(v) { return v == null ? '' : String(v).trim(); }
  function displayStatus(v) { return clean(v).replace(/_/g, ' '); }
  function escapeHtml(v) {
    return clean(v).replace(/[&<>"']/g, function (ch) {
      if (ch === '&') return '&';
      if (ch === '<') return '<';
      if (ch === '>') return '>';
      if (ch === '"') return '"';
      return '&#39;';
    });
  }

  function normalizeLabel(text) {
    return clean(text).toLowerCase().replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ');
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
    var hash = String(location.hash || '');
    var hm = hash.match(/claim[_-]?id[=:]([^&]+)/i);
    if (hm) return clean(decodeURIComponent(hm[1]));
    var body = document.body ? String(document.body.innerText || '') : '';
    var bm = body.match(/\b(\d{3,4}-\d{4}-SDLG-[A-Z0-9]+)\b/i);
    return bm ? bm[1] : '';
  }

  function getClient() {
    if (typeof window.getSdlgSupabase === 'function') {
      var c = window.getSdlgSupabase();
      if (c) return c;
    }
    return window.sdlgSupabase || window.supabaseClient || window.__SDLG_SUPABASE_CLIENT || null;
  }

  async function loadClaim(claimId) {
    var c = getClient();
    if (!c) throw new Error('No Supabase client');
    var res = await c.from('claims').select(CLAIM_SELECT).eq('claim_id', claimId).maybeSingle();
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
    var raw = clean(claim && claim.technical_personnel);
    if (!raw) return '';
    return raw.replace(/^\s*technician\s*[:\-]?\s*/i, '').trim();
  }

  function repairDateValue(claim) {
    return formatPortalDate(claim && (claim.dealer_repair_date || claim.completion_date || claim.failure_date));
  }

  function wholeMachineLabel(resolver) {
    if (!resolver) return '';
    var s = resolver.status || resolver.warranty_status || resolver.result || '';
    return displayStatus(s);
  }

  function findFieldControl(labelText) {
    var wanted = normalizeLabel(labelText);
    var safeLabel = String(labelText || '').replace(/"/g, '');
    var byData = document.querySelector('[data-sdlg-field][data-label="' + safeLabel + '"]');
    if (byData) {
      if (byData.matches('input,select,textarea')) return byData;
      var inner = byData.querySelector('input,select,textarea');
      if (inner) return inner;
    }
    var labels = Array.from(document.querySelectorAll('label'));
    var exact = labels.filter(function (el) { return normalizeLabel(el.textContent) === wanted; });
    var candidates = exact.length ? exact : labels.filter(function (el) {
      return normalizeLabel(el.textContent).indexOf(wanted) === 0;
    });
    for (var c = 0; c < candidates.length; c += 1) {
      var label = candidates[c];
      var forId = label.getAttribute('for');
      if (forId) {
        var direct = document.getElementById(forId);
        if (direct) return direct;
      }
      var wrap = label.closest('.sdlg-portal-field, .sdlg-field-wrap, [data-sdlg-extra-field]') || label.parentElement;
      if (wrap) {
        var control = wrap.querySelector('input, select, textarea');
        if (control) return control;
      }
    }
    return null;
  }

  function setControlValue(control, value, forceFillEmpty) {
    if (!control) return false;
    if (value == null || value === '') return false;
    var next = String(value);
    var cur = control.value != null ? String(control.value) : '';
    if (!forceFillEmpty && !isBlankUi(cur) && cur === next) {
      if (typeof control.getAttribute === 'function' && control.getAttribute('value') !== next) {
        control.setAttribute('value', next);
      }
      return false;
    }
    if (!forceFillEmpty && !isBlankUi(cur) && cur !== next) {
      return false;
    }
    control.value = next;
    if (typeof control.setAttribute === 'function') control.setAttribute('value', next);
    try {
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  function setByLabels(labels, value, force) {
    if (isBlankUi(value)) return;
    for (var i = 0; i < labels.length; i += 1) {
      setControlValue(findFieldControl(labels[i]), value, force);
    }
  }

  function forceTextNearLabel(labelWanted, value) {
    // SAFE: only the control bound to this label — never broadcast to all inputs in a card
    if (isBlankUi(value)) return;
    var control = findFieldControl(labelWanted);
    if (control) {
      setControlValue(control, value, true);
      return;
    }
    var wanted = normalizeLabel(labelWanted);
    var nodes = Array.from(document.querySelectorAll('label,div,span,p,strong'));
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var norm = normalizeLabel(el.textContent);
      if (norm !== wanted && norm.indexOf(wanted) !== 0) continue;
      var wrap = el.closest('.sdlg-portal-field, .sdlg-field-wrap, [data-sdlg-extra-field], [data-sdlg-field]') || el.parentElement;
      if (!wrap) continue;
      var box = wrap.querySelector('[data-copy-box], [data-value], code, pre');
      if (box && box.childElementCount === 0) {
        if (box.getAttribute('data-value') != null) box.setAttribute('data-value', value);
        else if (isBlankUi(box.textContent) || box.getAttribute('data-copy-box') != null) box.textContent = value;
      }
      break;
    }
  }

  function ensureRepairDateRow(dateStr) {
    if (isBlankUi(dateStr)) return;
    if (findFieldControl('Repair Date') || findFieldControl('Dealer Repair Date')) {
      setByLabels(['Repair Date', 'Dealer Repair Date', 'Repair Start Date'], dateStr, true);
      forceTextNearLabel('Repair Date', dateStr);
      return;
    }
    if (document.getElementById('sdlg-injected-repair-date')) {
      var existing = document.getElementById('sdlg-injected-repair-date');
      var box = existing.querySelector('[data-copy-box]');
      if (box) box.textContent = dateStr;
      return;
    }
  }

  function applyReportNameShort(claim) {
    /* keep lightweight; no-op if not present */
  }

  function writeCanonicalBadge(resolver) {
    /* optional badge — safe no-op */
  }

  function applyClaimData(claim, resolver) {
    if (!claim) return;

    var person = feedbackPersonValue(claim);
    var repairDt = repairDateValue(claim);
    var serviceMethod = clean(claim.repair_method);
    var serviceType = 'Repair';

    setByLabels(['Service Type'], serviceType, true);
    setByLabels(['Service Method'], serviceMethod, true);

    setByLabels(['Serial number', 'Serial Number', 'Serial No'], clean(claim.serial_no), true);
    setByLabels(['Hour meter', 'Hour Meter', 'HM'], claim.hm_failure != null ? String(claim.hm_failure) : '', true);

    setByLabels(['Whole Machine Warranty'], wholeMachineLabel(resolver), true);

    setByLabels(['Feedback Person'], person, true);

    setByLabels(['Failure Date'], formatPortalDate(claim.failure_date), true);
    setByLabels(['Repair Date', 'Dealer Repair Date', 'Repair Start Date'], repairDt, true);
    ensureRepairDateRow(repairDt);

    setByLabels(['Complaint'], clean(claim.fault_description), false);
    setByLabels(['Fault Details', 'Fault Detail'], clean(claim.cause_analyze) || clean(claim.comment), false);

    var loc = clean(claim.failure_part_location) || '';
    setByLabels(['Machine Location'], loc, true);

    if (claim.hm_completion != null && !isBlankUi(claim.hm_completion)) {
      setByLabels(['Repair Labor (Hrs)', 'Repair Labor'], String(claim.hm_completion), true);
    }

    if (claim.mileage_km != null && !isBlankUi(claim.mileage_km)) {
      setByLabels(['Service Mileage (Km)', 'Service Mileage', 'Mileage'], String(claim.mileage_km), true);
    }

    if (claim.labour_amount != null) setByLabels(['Labour Amount'], String(claim.labour_amount), true);
    if (claim.mileage_amount != null) setByLabels(['Mileage Amount'], String(claim.mileage_amount), true);
    if (claim.other_amount != null) setByLabels(['Other Amount'], String(claim.other_amount), true);
    if (claim.total_amount != null) setByLabels(['Total Amount'], String(claim.total_amount), true);

    applyReportNameShort(claim);
    writeCanonicalBadge(resolver);
  }

  async function run() {
    if (scheduled) return;
    scheduled = true;
    try {
      var claimId = findClaimId();
      if (!claimId) return;
      var key = claimId + ':' + (++runSequence);
      if (key === lastAppliedKey) return;
      var claim = await loadClaim(claimId);
      var resolver = null;
      try { resolver = await loadResolver(claimId); } catch (e) { console.warn('[SDLG Helper canonical] resolver', e); }
      applyClaimData(claim, resolver);
      lastAppliedKey = key;
    } catch (err) {
      console.warn('[SDLG Helper canonical]', err && err.message ? err.message : err);
    } finally {
      scheduled = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    setTimeout(run, 120);
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(function () { schedule(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  setTimeout(schedule, 400);
  setTimeout(schedule, 1200);
  setTimeout(schedule, 2500);
})();
