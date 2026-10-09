/**
 * SDLG Portal Finance + UX polish v1.0
 * - Money cells: show 0.00 (not "—") when value is 0/null for price/amount columns
 * - Finance gap banner when hrs/km present but rates/amounts are 0
 * - Report name: collapse long text with Show more/less
 * - Declutter: hide per-field Copy buttons; keep section/global Copy All + report copy
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V1__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V1__ = true;

  function isDash(s) {
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || /^—$/.test(s);
  }

  function root() {
    return document.querySelector('[data-sdlg-input-helper]');
  }

  function formatPartsMoney(r) {
    var tables = r.querySelectorAll('table');
    tables.forEach(function (table) {
      var head = (table.querySelector('thead') && table.querySelector('thead').innerText) || '';
      if (!/Unit Price|Amount|Failure Part/i.test(head)) return;
      var rows = table.querySelectorAll('tbody tr');
      rows.forEach(function (tr) {
        var cells = tr.querySelectorAll('td');
        if (cells.length < 7) return;
        var up = cells[5];
        var am = cells[6];
        if (up && isDash(up.textContent.trim())) up.textContent = '0.00';
        else if (up && /^\d+(\.\d+)?$/.test(up.textContent.trim())) {
          var n = Number(up.textContent.trim());
          if (n === 0) up.textContent = '0.00';
        }
        if (am && isDash(am.textContent.trim())) am.textContent = '0.00';
        else if (am && /^\d+(\.\d+)?$/.test(am.textContent.trim())) {
          var n2 = Number(am.textContent.trim());
          if (n2 === 0) am.textContent = '0.00';
        }
      });
    });
  }

  function formatCostInputs(r) {
    ['sdlg_labourAmount', 'sdlg_mileageAmount', 'sdlg_otherAmount', 'sdlg_totalAmount'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var v = el.value;
      if (v === '' || isDash(v) || v === '0') {
        el.value = '0.00';
        try { el.setAttribute('value', '0.00'); } catch (_) {}
      }
    });
  }

  function financeBanner(r) {
    if (r.querySelector('[data-sdlg-finance-gap]')) return;
    var labourHrs = (document.getElementById('sdlg_repairLabor') || {}).value;
    var mileage = (document.getElementById('sdlg_serviceMileage') || {}).value;
    var labourAmt = (document.getElementById('sdlg_labourAmount') || {}).value;
    var mileAmt = (document.getElementById('sdlg_mileageAmount') || {}).value;
    var totalAmt = (document.getElementById('sdlg_totalAmount') || {}).value;
    var hrsN = Number(String(labourHrs || '').replace(',', '.'));
    var kmN = Number(String(mileage || '').replace(',', '.'));
    var laN = Number(String(labourAmt || '0').replace(',', '.'));
    var maN = Number(String(mileAmt || '0').replace(',', '.'));
    var taN = Number(String(totalAmt || '0').replace(',', '.'));
    var gaps = [];
    if (Number.isFinite(hrsN) && hrsN > 0 && (!Number.isFinite(laN) || laN === 0)) {
      gaps.push('Repair Labor ' + hrsN + ' hrs tetapi Labour Amount = 0 (labour_rate kosong di source claim).');
    }
    if (Number.isFinite(kmN) && kmN > 0 && (!Number.isFinite(maN) || maN === 0)) {
      gaps.push('Service Mileage ' + kmN + ' km tetapi Mileage Amount = 0 (mileage_rate kosong di source claim).');
    }
    if ((!Number.isFinite(taN) || taN === 0) && gaps.length) {
      gaps.push('Total Amount Claimed = 0 — isi rate/harga di Claim Detail sebelum submit ke Dealer Portal.');
    }
    if (!gaps.length) return;
    var box = document.createElement('div');
    box.setAttribute('data-sdlg-finance-gap', '1');
    box.style.cssText = 'background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:11px;color:#991b1b;line-height:1.45';
    box.innerHTML = '<b>Data finansial gap (dari source claim, bukan error UI):</b><ul style="margin:6px 0 0 16px;padding:0">' +
      gaps.map(function (g) { return '<li>' + g + '</li>'; }).join('') +
      '</ul><div style="margin-top:6px;color:#7f1d1d">UI menampilkan 0.00 agar jelas nilainya nol — bukan “data hilang di mapping”. Lengkapi harga/rate di form klaim jika pabrikan mensyaratkan amount > 0.</div>';
    var anchor = r.querySelector('#sdlg_labourAmount');
    if (anchor) {
      var card = anchor.closest('div[style*="border-radius:14px"]') || anchor.parentElement;
      if (card && card.parentElement) card.parentElement.insertBefore(box, card);
      else r.insertBefore(box, r.firstChild);
    } else {
      r.insertBefore(box, r.firstChild);
    }
  }

  function collapseReportName(r) {
    if (r.querySelector('[data-sdlg-report-toggle]')) return;
    var blocks = r.querySelectorAll('div');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var t = b.textContent || '';
      if (t.indexOf('Nama Report') < 0) continue;
      if (t.length > 800) continue;
      var mono = null;
      var kids = b.querySelectorAll('div');
      for (var k = 0; k < kids.length; k++) {
        var st = kids[k].getAttribute('style') || '';
        if (/monospace/i.test(st)) { mono = kids[k]; break; }
      }
      if (!mono) continue;
      var full = mono.textContent || '';
      if (full.length < 120) return;
      mono.style.maxHeight = '3.2em';
      mono.style.overflow = 'hidden';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-sdlg-report-toggle', '1');
      btn.textContent = 'Show more';
      btn.style.cssText = 'margin-top:6px;border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer';
      var expanded = false;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        expanded = !expanded;
        mono.style.maxHeight = expanded ? 'none' : '3.2em';
        btn.textContent = expanded ? 'Show less' : 'Show more';
      });
      if (mono.parentElement) mono.parentElement.appendChild(btn);
      return;
    }
  }

  function declutterCopy(r) {
    var buttons = r.querySelectorAll('button[data-sdlg-copy]');
    buttons.forEach(function (btn) {
      if (btn.getAttribute('data-sdlg-copy-all') != null) return;
      if (btn.getAttribute('data-sdlg-copy-report-name') != null) return;
      if (btn.textContent && /Copy/i.test(btn.textContent) && !btn.getAttribute('data-value')) {
        btn.style.display = 'none';
      }
    });
    var allBtn = r.querySelector('#sdlg-copy-all, [data-sdlg-copy-all]');
    if (allBtn && /Copy All/i.test(allBtn.textContent || '') && (allBtn.textContent || '').indexOf('Home') < 0) {
      allBtn.textContent = 'Copy Semua Field Home';
    }
  }

  function enhance() {
    var r = root();
    if (!r) return;
    try {
      formatPartsMoney(r);
      formatCostInputs(r);
      financeBanner(r);
      collapseReportName(r);
      declutterCopy(r);
    } catch (e) {
      console.warn('[SDLG finance-ux]', e && e.message ? e.message : e);
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(enhance, 350);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
