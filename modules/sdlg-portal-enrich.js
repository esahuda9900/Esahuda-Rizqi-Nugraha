/**
 * SDLG Portal field enrich v1 — prefill repair report date, machine location (WO+branch+customer)
 * from live claim row via window.sdlgSupabase. No warranty business rule changes.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_PORTAL_ENRICH_V1__) return;
  root.__SDLG_PORTAL_ENRICH_V1__ = true;

  function formatDateDDMMYYYY(value) {
    if (value == null || value === '') return '';
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    return s;
  }

  function getClient() {
    if (root.sdlgSupabase && root.sdlgSupabase.from) return root.sdlgSupabase;
    if (typeof root.getSupabaseClient === 'function') {
      try { return root.getSupabaseClient(); } catch (_) {}
    }
    return null;
  }

  function getSelectedClaimId() {
    var candidates = document.querySelectorAll('select');
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i].value || '';
      if (/SDLG-PFR|PFR|\d{4}-SDLG/i.test(v)) return v.trim();
    }
    var body = (document.body && document.body.innerText) || '';
    var m = body.match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/);
    if (m) return m[1];
    m = body.match(/\b(\d{4}-\d{4}-[A-Z0-9-]+)\b/);
    return m ? m[1] : '';
  }

  function findFieldByLabel(label) {
    var nodes = document.querySelectorAll('[data-sdlg-field]');
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].getAttribute('data-label') || '') === label) return nodes[i];
    }
    var labels = document.querySelectorAll('label');
    for (var j = 0; j < labels.length; j++) {
      if ((labels[j].textContent || '').indexOf(label) >= 0) {
        var wrap = labels[j].closest('div');
        var inp = wrap && wrap.querySelector('input, textarea, select');
        if (inp) return inp;
      }
    }
    return null;
  }

  function setField(label, value, opts) {
    opts = opts || {};
    var el = findFieldByLabel(label);
    if (!el) return false;
    var cur = String(el.value || '').trim();
    if (cur && !opts.overwrite) return false;
    if (value == null || value === '') return false;
    el.value = value;
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  function buildMachineLocation(row) {
    var wo = String(row.dealer_wo_so || row.wo_so || '').trim();
    if (!wo) wo = 'WO—';
    var branch = String(row.branch || '').trim();
    var customer = String(row.customer || '').trim();
    return [wo, branch, customer].filter(Boolean).join(' ');
  }

  var cache = Object.create(null);
  var inflight = Object.create(null);

  async function loadClaim(claimId) {
    if (!claimId) return null;
    if (cache[claimId]) return cache[claimId];
    if (inflight[claimId]) return inflight[claimId];
    var client = getClient();
    if (!client) return null;
    inflight[claimId] = client
      .from('claims')
      .select('claim_id,dealer_repair_date,completion_date,dealer_wo_so,branch,customer,technical_personnel,hm_failure,serial_no')
      .eq('claim_id', claimId)
      .maybeSingle()
      .then(function (res) {
        delete inflight[claimId];
        if (res && res.data) {
          cache[claimId] = res.data;
          return res.data;
        }
        return null;
      })
      .catch(function () {
        delete inflight[claimId];
        return null;
      });
    return inflight[claimId];
  }

  async function enrich() {
    if (!document.querySelector('[data-sdlg-copy-all], [data-sdlg-field]')) return;
    var claimId = getSelectedClaimId();
    if (!claimId) return;
    var row = await loadClaim(claimId);
    if (!row) return;

    var repair = row.dealer_repair_date || row.completion_date || '';
    if (repair) {
      setField('Date of repair report', formatDateDDMMYYYY(repair), { overwrite: true });
    }

    var loc = buildMachineLocation(row);
    if (loc) {
      setField('Machine Location', loc, { overwrite: true });
    }
  }

  function boot() {
    var t = null;
    function schedule() {
      clearTimeout(t);
      t = setTimeout(function () { enrich().catch(function () {}); }, 400);
    }
    schedule();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(schedule, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPortalEnrich = { version: '1.0.0', enrich: enrich, formatDateDDMMYYYY: formatDateDDMMYYYY };
})(window);
