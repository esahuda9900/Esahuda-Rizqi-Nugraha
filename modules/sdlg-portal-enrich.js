/**
 * SDLG Portal enrich v1.2 — strict claim_id + prefill + full report name
 */
(function (root) {
  'use strict';
  if (root.__SDLG_PORTAL_ENRICH_V12__) return;
  root.__SDLG_PORTAL_ENRICH_V12__ = true;

  function formatDateDDMMYYYY(value) {
    if (value == null || value === '') return '';
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
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
    var m = text.match(/\b(\d{4}-\d{4}-SDLG-PFR)\s*[·|]/s*/);
    if (m) return m[1];
    var sel = document.querySelectorAll('select');
    for (var i = 0; i < sel.length; i++) {
      var v = String(sel[i].value || '').trim();
      if (/^\d{4}-\d{4}-SDLG-PFR$/.test(v)) return v;
      var opt = sel[i].selectedOptions && sel[i].selectedOptions[0];
      if (opt) {
        var ot = (opt.textContent || '').trim();
        var om = ot.match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/);
        if (om) return om[1];
      }
    }
    m = text.match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/);
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
        .select('claim_id,dealer_repair_date,completion_date,dealer_wo_so,branch,customer,model,serial_no,canonical_serial_no,hm_failure,fault_description,dealer_claim_no')
        .eq('claim_id', claimId)
        .maybeSingle();
      if (res && res.data) {
        cache[claimId] = res.data;
        return res.data;
      }
    } catch (_) {}
    return null;
  }

  function buildReportName(row) {
    var model = String(row.model || '').trim();
    var sn = String(row.serial_no || row.canonical_serial_no || '').replace(/\s+/g, '');
    var snShort = sn.slice(-6);
    var hm = row.hm_failure != null ? String(row.hm_failure).replace(/\s*(hr|hrs|hours).*$/i, '') : '';
    var complaint = String(row.fault_description || '').trim().replace(/[\r\n]+/g, ' ');
    var claimLabel = row.claim_id || 'Claim—';
    var wo = String(row.dealer_wo_so || '').trim() || 'WO—';
    var parts = [
      model && snShort ? ('SDLG ' + model + ' SN.' + snShort) : (model || 'SDLG'),
      hm ? (hm + ' hr') : 'HM.—',
      complaint || 'Complaint —',
      claimLabel,
      wo
    ];
    return parts.filter(Boolean).join(', ');
  }

  function applyReportName(full) {
    if (!full) return;
    var page = document.querySelector('.sdlg-input-helper-page') || document.body;
    var cards = page.querySelectorAll('.card, [class*="card"]');
    for (var c = 0; c < cards.length; c++) {
      if (!/Report Naming|Nama Report/i.test(cards[c].innerText || '')) continue;
      cards[c].classList.add('sdlg-section-report');
      var divs = cards[c].querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var tx = (divs[i].textContent || '').trim();
        if (/^SDLG\s+/i.test(tx) && tx.length > 12) {
          divs[i].classList.add('sdlg-report-name-text');
          divs[i].setAttribute('title', full);
          if (tx.indexOf('\u2026') >= 0 || tx.indexOf('…') >= 0 || /Claim[=—-]\s*$/i.test(tx) || tx.length < full.length * 0.7) {
            divs[i].textContent = full;
          }
          var copyBtn = cards[c].querySelector('[data-value]');
          if (copyBtn) copyBtn.setAttribute('data-value', full);
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
    if (repair) setField('Date of repair report', repair);

    var wo = String(row.dealer_wo_so || '').trim() || 'WO—';
    var branch = String(row.branch || '').trim();
    var customer = String(row.customer || '').trim();
    var loc = [wo, branch, customer].filter(Boolean).join(' ');
    if (loc) setField('Machine Location', loc);

    applyReportName(buildReportName(row));
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

  root.SDLGPortalEnrich = { version: '1.2.0', enrich: enrich, getSelectedClaimId: getSelectedClaimId };
})(window);
