/**
 * SDLG Policy + Repair hard-fix v2.1 — safe RegExp
 */
(function (root) {
  'use strict';
  if (root.__SDLG_POLICY_REPAIR_HARDFIX_V21__) return;
  root.__SDLG_POLICY_REPAIR_HARDFIX_V21__ = true;

  var RE_ISO_DATE = new RegExp(String.raw`^(\d{4})-(\d{2})-(\d{2})`);
  var RE_CLAIM_HEADER = new RegExp(String.raw`\b(\d{4}-\d{4}-SDLG-PFR)\s*[\u00B7\u2022|]`);
  var RE_CLAIM_CARD = new RegExp(String.raw`\bCLAIM\s*\n?\s*(\d{4}-\d{4}-SDLG-PFR)\b`, 'i');
  var RE_CLAIM_ANY = new RegExp(String.raw`\b(\d{4}-\d{4}-SDLG-PFR)\b`);

  function portalDate(value) {
    if (value == null || value === '') return '';
    var s = String(value).trim();
    var m = s.match(RE_ISO_DATE);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
    return s;
  }

  function client() {
    return (root.sdlgSupabase && root.sdlgSupabase.from) ? root.sdlgSupabase : null;
  }

  function claimIdFromPage() {
    var text = (document.body && document.body.innerText) || '';
    var m = text.match(RE_CLAIM_HEADER);
    if (m) return m[1];
    m = text.match(RE_CLAIM_CARD);
    if (m) return m[1];
    m = text.match(RE_CLAIM_ANY);
    return m ? m[1] : '';
  }

  var cache = Object.create(null);

  async function loadAll(claimId) {
    if (!claimId) return null;
    if (cache[claimId]) return cache[claimId];
    var c = client();
    if (!c) return null;
    try {
      var res = await Promise.all([
        c.from('claims').select('claim_id,dealer_repair_date,completion_date,dealer_wo_so,branch,customer,technical_personnel').eq('claim_id', claimId).maybeSingle(),
        c.from('claim_warranty_policy_matrix_v').select('warranty_policy_matrix').eq('claim_id', claimId).maybeSingle()
      ]);
      var claim = res[0] && res[0].data;
      var matrix = res[1] && res[1].data && res[1].data.warranty_policy_matrix;
      if (res[0] && res[0].error) console.warn('[hardfix] claims', res[0].error);
      if (res[1] && res[1].error) console.warn('[hardfix] matrix', res[1].error);
      var out = { claim: claim, policies: (matrix && matrix.policies) || [] };
      if (claim || out.policies.length) cache[claimId] = out;
      return out;
    } catch (e) {
      console.warn('[hardfix]', e);
      return null;
    }
  }

  function ensureRepairField() {
    var existing = document.querySelector('[data-sdlg-field][data-label="Date of repair report"]');
    if (existing) return existing;
    var fail = document.querySelector('[data-sdlg-field][data-label="Failure Date"]');
    if (!fail) return null;
    var failWrap = fail.closest('div[style]') || fail.parentElement;
    var grid = failWrap && failWrap.parentElement;
    if (!grid) return null;
    var wrap = document.createElement('div');
    wrap.setAttribute('data-sdlg-hardfix-repair', '1');
    wrap.style.cssText = 'border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff';
    var lab = document.createElement('div');
    lab.style.cssText = 'font-size:11px;font-weight:600;color:#475569;margin-bottom:6px';
    lab.textContent = 'Date of repair report *';
    wrap.appendChild(lab);
    var input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-sdlg-field', '1');
    input.setAttribute('data-label', 'Date of repair report');
    input.style.cssText = 'width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12px;background:#f8fafc';
    wrap.appendChild(input);
    if (failWrap.nextSibling) grid.insertBefore(wrap, failWrap.nextSibling);
    else grid.appendChild(wrap);
    return input;
  }

  function setRepair(dateStr) {
    if (!dateStr) return;
    var el = ensureRepairField();
    if (!el) return;
    if (String(el.value || '').trim() === dateStr) return;
    el.value = dateStr;
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
      iCat = 0; iAS = 3; iAD = 4;
    }

    var ths = table.querySelectorAll('thead th');
    if (ths[iAS]) { ths[iAS].textContent = 'OOW (Sales)'; ths[iAS].title = 'OOW dihitung dari Sales Date'; }
    if (ths[iAD]) { ths[iAD].textContent = 'OOW (B/L)'; ths[iAD].title = 'OOW dihitung dari Bill of Lading'; }

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

  async function tick() {
    if (!document.querySelector('[data-sdlg-copy-all], [data-sdlg-field]')) return;
    var id = claimIdFromPage();
    if (!id) return;
    var data = await loadAll(id);
    if (!data) return;
    if (data.claim) {
      var repair = portalDate(data.claim.dealer_repair_date || data.claim.completion_date);
      if (repair) setRepair(repair);
    }
    if (data.policies && data.policies.length) fillPolicyTable(data.policies);
  }

  function boot() {
    var t = null;
    function schedule() {
      clearTimeout(t);
      t = setTimeout(function () { tick().catch(function () {}); }, 300);
    }
    schedule();
    if (document.body && typeof MutationObserver !== 'undefined') {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(schedule, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPolicyRepairHardfix = { version: '2.1.0', tick: tick };
})(window);
