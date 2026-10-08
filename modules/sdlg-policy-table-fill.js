/**
 * SDLG Policy table fill v1 — After Sales = sales_expiry, After Departure = B/L expiry
 * Patches DOM when index still maps wrong field names.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_POLICY_TABLE_FILL_V1__) return;
  root.__SDLG_POLICY_TABLE_FILL_V1__ = true;

  function portalDate(value) {
    if (value == null || value === '') return '';
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
    return s;
  }

  function getClient() {
    return (root.sdlgSupabase && root.sdlgSupabase.from) ? root.sdlgSupabase : null;
  }

  function getClaimId() {
    if (root.SDLGPortalEnrich && typeof root.SDLGPortalEnrich.getSelectedClaimId === 'function') {
      try {
        var id = root.SDLGPortalEnrich.getSelectedClaimId();
        if (id) return id;
      } catch (_) {}
    }
    var page = document.querySelector('.sdlg-input-helper-page, [data-sdlg-copy-all]');
    var scope = page ? (page.closest('.page') || page) : document.body;
    var text = (scope && scope.innerText) || '';
    var m = text.match(/\b(\d{4}-\d{4}-SDLG-PFR)\s*[·|]/s*/);
    if (m) return m[1];
    m = text.match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/);
    return m ? m[1] : '';
  }

  function findPolicyTable() {
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var th = tables[i].querySelectorAll('th');
      var labels = Array.prototype.map.call(th, function (el) { return (el.textContent || '').trim(); });
      var hasAS = labels.indexOf('After Sales') >= 0 || labels.indexOf('OOW (Sales)') >= 0;
      var hasAD = labels.indexOf('After Departure') >= 0 || labels.indexOf('OOW (B/L)') >= 0;
      var hasOOW = labels.indexOf('Out of Warranty') >= 0;
      if (hasAS && hasAD && hasOOW) {
        labels = labels.map(function (x) {
          if (x === 'OOW (Sales)') return 'After Sales';
          if (x === 'OOW (B/L)') return 'After Departure';
          return x;
        });
        return { table: tables[i], labels: labels };
      }
    }
    return null;
  }

  var cache = Object.create(null);

  async function loadPolicies(claimId) {
    if (!claimId) return null;
    if (cache[claimId]) return cache[claimId];
    var client = getClient();
    if (!client) return null;
    try {
      var res = await client.from('claim_warranty_policy_matrix_v')
        .select('warranty_policy_matrix')
        .eq('claim_id', claimId)
        .maybeSingle();
      if (res && res.data && res.data.warranty_policy_matrix) {
        var policies = res.data.warranty_policy_matrix.policies || [];
        cache[claimId] = policies;
        return policies;
      }
    } catch (e) {
      console.warn('[SDLG policy-table]', e);
    }
    return null;
  }

  function apply(policies, meta) {
    if (!policies || !meta) return;
    var idxCat = meta.labels.indexOf('Component Category');
    var idxAS = meta.labels.indexOf('After Sales');
    var idxAD = meta.labels.indexOf('After Departure');
    var idxOOW = meta.labels.indexOf('Out of Warranty');
    if (idxAS < 0 || idxAD < 0) return;

    var ths = meta.table.querySelectorAll('thead th');
    if (ths[idxAS] && !ths[idxAS].getAttribute('data-sdlg-policy-h')) {
      ths[idxAS].setAttribute('data-sdlg-policy-h', '1');
      ths[idxAS].setAttribute('title', 'Tanggal OOW dihitung dari Sales Date');
      ths[idxAS].textContent = 'OOW (Sales)';
    }
    if (ths[idxAD] && !ths[idxAD].getAttribute('data-sdlg-policy-h')) {
      ths[idxAD].setAttribute('data-sdlg-policy-h', '1');
      ths[idxAD].setAttribute('title', 'Tanggal OOW dihitung dari Bill of Lading / departure');
      ths[idxAD].textContent = 'OOW (B/L)';
    }
    if (ths[idxOOW] && !ths[idxOOW].getAttribute('data-sdlg-policy-h')) {
      ths[idxOOW].setAttribute('data-sdlg-policy-h', '1');
      ths[idxOOW].setAttribute('title', 'Tanggal OOW efektif (policy: whichever comes first)');
    }

    var byCat = Object.create(null);
    policies.forEach(function (p) {
      var k = String(p.component_category || '').trim().toLowerCase();
      if (k) byCat[k] = p;
    });

    var rows = meta.table.querySelectorAll('tbody tr');
    rows.forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (!cells.length) return;
      var cat = (cells[idxCat >= 0 ? idxCat : 0].textContent || '').trim().toLowerCase();
      var p = byCat[cat];
      if (!p) return;

      var salesExp = portalDate(p.sales_expiry_date || p.after_sales_expiry_date);
      var blExp = portalDate(p.bill_of_lading_expiry_date || p.after_departure_expiry_date);
      var eff = portalDate(p.effective_expiry_date);

      if (idxAS >= 0 && cells[idxAS] && salesExp) {
        cells[idxAS].textContent = salesExp;
        cells[idxAS].setAttribute('title', 'OOW from Sales Date');
      }
      if (idxAD >= 0 && cells[idxAD] && blExp) {
        cells[idxAD].textContent = blExp;
        cells[idxAD].setAttribute('title', 'OOW from Bill of Lading');
      }
      if (idxOOW >= 0 && cells[idxOOW] && eff) {
        var cur = (cells[idxOOW].textContent || '').trim();
        if (!cur || cur === '\u2014' || cur === '-' || cur === '—') cells[idxOOW].textContent = eff;
      }
    });
  }

  async function enhance() {
    var meta = findPolicyTable();
    if (!meta) return;
    var claimId = getClaimId();
    if (!claimId) return;
    var policies = await loadPolicies(claimId);
    apply(policies, meta);
  }

  function boot() {
    var t = null;
    function schedule() {
      clearTimeout(t);
      t = setTimeout(function () { enhance().catch(function () {}); }, 500);
    }
    schedule();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(schedule, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPolicyTableFill = { version: '1.0.0', enhance: enhance };
})(window);
