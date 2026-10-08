/**
 * SDLG Portal field enrich v1.1 — resilient prefill after React re-render
 */
(function (root) {
  'use strict';
  if (root.__SDLG_PORTAL_ENRICH_V11__) return;
  root.__SDLG_PORTAL_ENRICH_V11__ = true;
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
    return null;
  }

  function getSelectedClaimId() {
    var body = (document.body && document.body.innerText) || '';
    var m = body.match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/);
    if (m) return m[1];
    var candidates = document.querySelectorAll('select');
    for (var i = 0; i < candidates.length; i++) {
      var v = String(candidates[i].value || '').trim();
      if (v && /SDLG|PFR/i.test(v)) return v;
    }
    m = body.match(/\b(\d{4}-\d{4}-[A-Z0-9-]+)\b/);
    return m ? m[1] : '';
  }

  function findFieldByLabel(label) {
    var nodes = document.querySelectorAll('[data-sdlg-field]');
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].getAttribute('data-label') || '') === label) return nodes[i];
    }
    return null;
  }

  function setField(label, value) {
    var el = findFieldByLabel(label);
    if (!el || value == null || value === '') return false;
    if (String(el.value || '').trim() === String(value).trim()) return true;
    el.value = value;
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  var cache = Object.create(null);

  async function loadClaim(claimId) {
    if (!claimId) return null;
    if (cache[claimId]) return cache[claimId];
    var client = getClient();
    if (!client) return null;
    try {
      var res = await client.from('claims')
        .select('claim_id,dealer_repair_date,completion_date,dealer_wo_so,branch,customer')
        .eq('claim_id', claimId)
        .maybeSingle();
      if (res && res.data) {
        cache[claimId] = res.data;
        return res.data;
      }
    } catch (_) {}
    return null;
  }

  async function enrich() {
    if (!document.querySelector('[data-sdlg-copy-all], [data-sdlg-field]')) return;
    var claimId = getSelectedClaimId();
    if (!claimId) return;
    var row = await loadClaim(claimId);
    if (!row) return;

    var repair = formatDateDDMMYYYY(row.dealer_repair_date || row.completion_date || '');
    if (repair) setField('Date of repair report', repair);

    var wo = String(row.dealer_wo_so || '').trim() || 'WO—';
    var branch = String(row.branch || '').trim();
    var customer = String(row.customer || '').trim();
    var loc = [wo, branch, customer].filter(Boolean).join(' ');
    if (loc) setField('Machine Location', loc);
  }

  function boot() {
    var t = null;
    function schedule() {
      clearTimeout(t);
      t = setTimeout(function () { enrich().catch(function () {}); }, 500);
    }
    schedule();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(schedule, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPortalEnrich = { version: '1.1.0', enrich: enrich };
})(window);
