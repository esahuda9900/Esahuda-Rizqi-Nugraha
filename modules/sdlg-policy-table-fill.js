/**
 * SDLG Policy table fill v1.1 — safe regex + OOW Sales / OOW B/L
 */
(function (root) {
  'use strict';
  if (root.__SDLG_POLICY_TABLE_FILL_V11__) return;
  root.__SDLG_POLICY_TABLE_FILL_V11__ = true;

  var RE_CLAIM_HEADER = new RegExp(String.raw`\b(\d{4}-\d{4}-SDLG-PFR)\s*[\u00B7\u2022|]`);
  var RE_CLAIM_ANY = new RegExp(String.raw`\b(\d{4}-\d{4}-SDLG-PFR)\b`);
  var RE_ISO_DATE = new RegExp(String.raw`^(\d{4})-(\d{2})-(\d{2})`);

  function portalDate(value) {
    if (value == null || value === '') return '';
    var s = String(value).trim();
    var m = s.match(RE_ISO_DATE);
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
    var text = (document.body && document.body.innerText) || '';
    var m = text.match(RE_CLAIM_HEADER);
    if (m) return m[1];
    m = text.match(RE_CLAIM_ANY);
    return m ? m[1] : '';
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
      if (res && res.error) {
        console.warn('[SDLG policy-table]', res.error);
        return null;
      }
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

  function fillPolicyTable(policies) {
    if (!policies || !policies.length) return;
    var tables = document.querySelectorAll('table');
    var table = null;
    for (var i = 0; i < tables.length; i++) {
      var txt = tables[i].innerText || '';
      if (/Component Category/i.test(txt) && /Out of Warranty/i.test(txt)) {
        table = tables[i];
        break;
      }
    }
    if (!table) return;

    var headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) {
      return (th.textContent || '').trim();
    });
    function idxOf() {
      var names = Array.prototype.slice.call(arguments);
      for (var a = 0; a < names.length; a++) {
        var j = headers.indexOf(names[a]);
        if (j >= 0) return j;
      }
      for (var h = 0; h < headers.length; h++) {
        for (var a2 = 0; a2 < names.length; a2++) {
          if (headers[h].toLowerCase().indexOf(String(names[a2]).toLowerCase()) >= 0) return h;
        }
      }
      return -1;
    }
    var iCat = idxOf('Component Category');
    var iAS = idxOf('After Sales', 'OOW (Sales)');
    var iAD = idxOf('After Departure', 'OOW (B/L)');
    if (iAS < 0 || iAD < 0) {
      iCat = 0;
      iAS = 3;
      iAD = 4;
    }

    var ths = table.querySelectorAll('thead th');
    if (ths[iAS]) {
      ths[iAS].textContent = 'OOW (Sales)';
      ths[iAS].title = 'OOW dihitung dari Sales Date';
    }
    if (ths[iAD]) {
      ths[iAD].textContent = 'OOW (B/L)';
      ths[iAD].title = 'OOW dihitung dari Bill of Lading';
    }

    var byCat = {};
    policies.forEach(function (p) {
      byCat[String(p.component_category || '').toLowerCase()] = p;
    });

    table.querySelectorAll('tbody tr').forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 5) return;
      var cat = (cells[iCat >= 0 ? iCat : 0].textContent || '').trim().toLowerCase();
      var p = byCat[cat];
      if (!p) {
        Object.keys(byCat).forEach(function (k) {
          if (!p && (cat.indexOf(k) >= 0 || k.indexOf(cat) >= 0)) p = byCat[k];
        });
      }
      if (!p) return;
      var salesExp = portalDate(p.sales_expiry_date || p.after_sales_expiry_date);
      var blExp = portalDate(p.bill_of_lading_expiry_date || p.after_departure_expiry_date);
      if (salesExp && cells[iAS]) cells[iAS].textContent = salesExp;
      if (blExp && cells[iAD]) cells[iAD].textContent = blExp;
    });
  }

  async function enhance() {
    var claimId = getClaimId();
    if (!claimId) return;
    var policies = await loadPolicies(claimId);
    fillPolicyTable(policies);
  }

  function boot() {
    var t = null;
    function schedule() {
      clearTimeout(t);
      t = setTimeout(function () { enhance().catch(function () {}); }, 400);
    }
    schedule();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(schedule, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPolicyTableFill = { version: '1.1.0', enhance: enhance };
})(window);
