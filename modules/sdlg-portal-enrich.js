/**
 * SDLG Portal enrich v1.4 — safe regex + repair date prefill
 */
(function (root) {
  'use strict';
  if (root.__SDLG_PORTAL_ENRICH_V14__) return;
  root.__SDLG_PORTAL_ENRICH_V14__ = true;

  var RE_CLAIM_HEADER = new RegExp(String.raw`\b(\d{4}-\d{4}-SDLG-PFR)\s*[\u00B7\u2022|]`);
  var RE_CLAIM_CARD = new RegExp(String.raw`\bCLAIM\s+(\d{4}-\d{4}-SDLG-PFR)\b`, 'i');
  var RE_CLAIM_ANY = new RegExp(String.raw`\b(\d{4}-\d{4}-SDLG-PFR)\b`);
  var RE_CLAIM_EXACT = new RegExp(String.raw`^\d{4}-\d{4}-SDLG-PFR$`);
  var RE_ISO_DATE = new RegExp(String.raw`^(\d{4})-(\d{2})-(\d{2})`);

  function formatDateDDMMYYYY(value) {
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

  function getSelectedClaimId() {
    var page = document.querySelector('.sdlg-input-helper-page');
    if (!page) {
      var all = document.querySelector('[data-sdlg-copy-all]');
      page = all ? all.closest('.page') : null;
    }
    var scope = page || document.body;
    var text = (scope && scope.innerText) || '';
    var m = text.match(RE_CLAIM_HEADER);
    if (m) return m[1];
    m = text.match(RE_CLAIM_CARD);
    if (m) return m[1];
    var sel = document.querySelectorAll('select');
    for (var i = 0; i < sel.length; i++) {
      var v = String(sel[i].value || '').trim();
      if (RE_CLAIM_EXACT.test(v)) return v;
      var opt = sel[i].selectedOptions && sel[i].selectedOptions[0];
      if (opt) {
        var om = String(opt.textContent || '').match(RE_CLAIM_ANY);
        if (om) return om[1];
      }
    }
    m = text.match(RE_CLAIM_ANY);
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
    try {
      el.value = value;
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
    var cols = 'claim_id,dealer_repair_date,completion_date,dealer_wo_so,branch,customer,model,serial_no,hm_failure,fault_description,dealer_claim_no,technical_personnel';
    try {
      var res = await client.from('claims').select(cols).eq('claim_id', claimId).maybeSingle();
      if (res && res.error) {
        console.warn('[SDLG enrich] select error', res.error);
        return null;
      }
      if (res && res.data) {
        cache[claimId] = res.data;
        return res.data;
      }
    } catch (e) {
      console.warn('[SDLG enrich] loadClaim', e);
    }
    return null;
  }

  function buildReportName(row) {
    var model = String(row.model || '').trim();
    var sn = String(row.serial_no || '').replace(/\s+/g, '');
    var snShort = sn.slice(-6);
    var hm = row.hm_failure != null ? String(row.hm_failure).replace(/\s*(hr|hrs|hours).*$/i, '') : '';
    var complaint = String(row.fault_description || '').trim().replace(/[\r\n]+/g, ' ');
    var claimLabel = row.claim_id || 'Claim-';
    var dealerClaim = String(row.dealer_claim_no || '').trim();
    var wo = String(row.dealer_wo_so || '').trim() || 'WO-';
    var parts = [
      model && snShort ? ('SDLG ' + model + ' SN.' + snShort) : (model || 'SDLG'),
      hm ? (hm + ' hr') : 'HM.-',
      complaint || 'Complaint -',
      claimLabel
    ];
    if (dealerClaim) parts.push(dealerClaim);
    parts.push(wo);
    return parts.filter(Boolean).join(', ');
  }

  function applyReportName(full) {
    if (!full) return;
    var page = document.querySelector('.sdlg-input-helper-page') || document.body;
    var cards = page.querySelectorAll('.card, [class*="card"]');
    for (var c = 0; c < cards.length; c++) {
      if (!/Report Naming|Nama Report/i.test(cards[c].innerText || '')) continue;
      var divs = cards[c].querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var tx = (divs[i].textContent || '').trim();
        if (/^SDLG\s+/i.test(tx) && tx.length > 12) {
          divs[i].setAttribute('title', full);
          if (tx.indexOf('\u2026') >= 0 || tx.indexOf('...') >= 0 || tx.length < full.length * 0.85) {
            divs[i].textContent = full;
          }
          return;
        }
      }
    }
  }

  async function enrich() {
    if (!document.querySelector('[data-sdlg-copy-all], [data-sdlg-field]')) return;
    var claimId = getSelectedClaimId();
    if (!claimId) return;
    var row = await loadClaim(claimId);
    if (!row) return;

    var repair = formatDateDDMMYYYY(row.dealer_repair_date || row.completion_date || '');
    if (repair) {
      if (!setField('Date of repair report', repair)) {
        setTimeout(function () { setField('Date of repair report', repair); }, 600);
      }
    }

    var wo = String(row.dealer_wo_so || '').trim() || 'WO-';
    var branch = String(row.branch || '').trim();
    var customer = String(row.customer || '').trim();
    var loc = [wo, branch, customer].filter(Boolean).join(' ');
    if (loc) setField('Machine Location', loc);

    var tech = String(row.technical_personnel || '').trim();
    if (tech && !/^unknown$/i.test(tech)) setField('Feedback Person', tech);

    applyReportName(buildReportName(row));
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
    setInterval(schedule, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPortalEnrich = {
    version: '1.4.0',
    enrich: enrich,
    getSelectedClaimId: getSelectedClaimId,
    formatDateDDMMYYYY: formatDateDDMMYYYY
  };
})(window);
