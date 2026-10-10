/**
 * SDLG Portal Finance + UX polish v4.0
 * Auto-calc labour/mileage amounts with default rates (25 / 0.5).
 * Live update on hrs/km/rate change. Warning when rate missing.
 * Persists rates in localStorage. Does not write to DB (portal copy workflow).
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V4__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V4__ = true;
  window.__SDLG_PORTAL_FINANCE_UX_V3__ = true;

  var STORAGE_KEY = 'sdlg:finance-rates:v1';
  var DEFAULT_LABOUR = 25;
  var DEFAULT_MILEAGE = 0.5;

  function loadRates() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        return {
          labourRate: p.labourRate != null ? Number(p.labourRate) : DEFAULT_LABOUR,
          mileageRate: p.mileageRate != null ? Number(p.mileageRate) : DEFAULT_MILEAGE,
          otherRate: p.otherRate != null ? Number(p.otherRate) : null,
          partPrices: p.partPrices || {}
        };
      }
    } catch (_) {}
    return {
      labourRate: DEFAULT_LABOUR,
      mileageRate: DEFAULT_MILEAGE,
      otherRate: null,
      partPrices: {}
    };
  }

  function saveRates() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        labourRate: state.labourRate,
        mileageRate: state.mileageRate,
        otherRate: state.otherRate,
        partPrices: state.partPrices
      }));
    } catch (_) {}
  }

  var state = loadRates();

  function num(v) {
    if (v == null || v === '') return null;
    var n = Number(String(v).replace(/,/g, '.').replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function money(v) {
    var n = num(v);
    if (n == null) return '0.00';
    return n.toFixed(2);
  }

  function isDash(s) {
    s = String(s == null ? '' : s).trim();
    return !s || s === '\u2014' || s === '-' || s === '\u2013';
  }

  function root() {
    return document.querySelector('[data-sdlg-input-helper]');
  }

  function setInput(el, value) {
    if (!el) return;
    var next = String(value);
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, next);
      else el.value = next;
    } catch (_) {
      el.value = next;
    }
    try { el.setAttribute('value', next); } catch (_) {}
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function readHrsKm() {
    return {
      hrs: num((document.getElementById('sdlg_repairLabor') || {}).value),
      km: num((document.getElementById('sdlg_serviceMileage') || {}).value)
    };
  }

  function sumParts(r) {
    var partsSum = 0;
    try {
      r.querySelectorAll('table').forEach(function (table) {
        var head = (table.querySelector('thead') || {}).textContent || '';
        if (!/Unit Price/i.test(head) || !/Failure Part/i.test(head)) return;
        table.querySelectorAll('tbody tr').forEach(function (tr) {
          var cells = tr.querySelectorAll('td');
          if (cells.length < 7) return;
          var qty = num(cells[4].textContent);
          var priceCell = cells[5];
          var amountCell = cells[6];
          var idx = tr.rowIndex || 0;
          var price = state.partPrices['p' + idx];
          if (price == null) price = num(priceCell && priceCell.textContent);
          if (price != null && qty != null) {
            var amt = qty * price;
            partsSum += amt;
            if (amountCell) amountCell.textContent = money(amt);
            if (priceCell && state.partPrices['p' + idx] != null) priceCell.textContent = money(price);
          } else {
            var existing = num(amountCell && amountCell.textContent);
            if (existing != null) partsSum += existing;
          }
        });
      });
    } catch (_) {}
    return partsSum;
  }

  function recompute() {
    var r = root();
    if (!r) return;
    var hk = readHrsKm();
    var labourAmt = null;
    var mileageAmt = null;

    var la = document.getElementById('sdlg_labourAmount');
    if (la) {
      if (state.labourRate != null && state.labourRate > 0 && hk.hrs != null && hk.hrs > 0) {
        labourAmt = hk.hrs * state.labourRate;
        setInput(la, money(labourAmt));
      } else if (isDash(la.value) || la.value === '' || la.value === '0' || la.value === '0.00') {
        setInput(la, '0.00');
        labourAmt = 0;
      } else {
        labourAmt = num(la.value) || 0;
      }
    }

    var ma = document.getElementById('sdlg_mileageAmount');
    if (ma) {
      if (state.mileageRate != null && state.mileageRate > 0 && hk.km != null && hk.km > 0) {
        mileageAmt = hk.km * state.mileageRate;
        setInput(ma, money(mileageAmt));
      } else if (isDash(ma.value) || ma.value === '' || ma.value === '0' || ma.value === '0.00') {
        setInput(ma, '0.00');
        mileageAmt = 0;
      } else {
        mileageAmt = num(ma.value) || 0;
      }
    }

    var oa = document.getElementById('sdlg_otherAmount');
    var otherAmt = 0;
    if (oa) {
      if (state.otherRate != null) {
        otherAmt = state.otherRate;
        setInput(oa, money(otherAmt));
      } else if (isDash(oa.value) || oa.value === '' || oa.value === '0') {
        setInput(oa, '0.00');
        otherAmt = 0;
      } else {
        otherAmt = num(oa.value) || 0;
      }
    }

    var partsSum = sumParts(r);
    var total = partsSum + (labourAmt || 0) + (mileageAmt || 0) + (otherAmt || 0);
    var ta = document.getElementById('sdlg_totalAmount');
    if (ta) setInput(ta, money(total));

    var sum = r.querySelector('[data-sdlg-finance-summary]');
    if (sum) {
      sum.innerHTML =
        '<span style="font-weight:800">Labour:</span> USD ' + money(labourAmt) +
        ' &nbsp;·&nbsp; <span style="font-weight:800">Mileage:</span> USD ' + money(mileageAmt) +
        ' &nbsp;·&nbsp; <span style="font-weight:800">Parts:</span> USD ' + money(partsSum) +
        ' &nbsp;·&nbsp; <span style="font-weight:800;color:#0f172a">Total:</span> <strong>USD ' + money(total) + '</strong>';
    }

    updateWarning(r, hk);
  }

  function updateWarning(r, hk) {
    var box = r.querySelector('[data-sdlg-finance-warn]');
    if (!box) return;
    var msgs = [];
    if (hk.hrs != null && hk.hrs > 0 && (state.labourRate == null || state.labourRate <= 0)) {
      msgs.push('Labour rate belum diisi (ada ' + hk.hrs + ' jam).');
    }
    if (hk.km != null && hk.km > 0 && (state.mileageRate == null || state.mileageRate <= 0)) {
      msgs.push('Mileage rate belum diisi (ada ' + hk.km + ' km).');
    }
    if (msgs.length) {
      box.style.display = 'block';
      box.textContent = '\u26a0\ufe0f ' + msgs.join(' ');
    } else {
      box.style.display = 'none';
      box.textContent = '';
    }
  }

  function ensureCalcPanel(r) {
    if (r.querySelector('[data-sdlg-finance-calc]')) {
      var lr = r.querySelector('[data-sdlg-rate="labour"]');
      var mr = r.querySelector('[data-sdlg-rate="mileage"]');
      if (lr && (lr.value === '' || lr.value == null) && state.labourRate != null) lr.value = state.labourRate;
      if (mr && (mr.value === '' || mr.value == null) && state.mileageRate != null) mr.value = state.mileageRate;
      return;
    }
    var box = document.createElement('div');
    box.setAttribute('data-sdlg-finance-calc', '1');
    box.style.cssText = 'margin:12px 0;padding:12px 14px;background:#fffbeb;border:1px solid #f59e0b;border-radius:12px;font-size:12px;color:#78350f';
    box.innerHTML =
      '<div style="font-weight:800;font-size:13px;margin-bottom:6px">Kalkulasi finansial (auto)</div>' +
      '<div style="margin-bottom:8px;line-height:1.45">Rate default: Labour 25 / jam, Mileage 0.5 / km. Amount dihitung otomatis dari jam &amp; km. (Copy ke portal; tidak menulis DB.)</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Labour Rate / jam<input data-sdlg-rate="labour" type="number" step="any" value="' + (state.labourRate != null ? state.labourRate : '') + '" placeholder="25" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Mileage Rate / km<input data-sdlg-rate="mileage" type="number" step="any" value="' + (state.mileageRate != null ? state.mileageRate : '') + '" placeholder="0.5" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Other Amount<input data-sdlg-rate="other" type="number" step="any" value="' + (state.otherRate != null ? state.otherRate : '') + '" placeholder="0" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '</div>' +
      '<div data-sdlg-finance-summary style="margin-top:10px;padding:8px 10px;background:#fff;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#0f172a"></div>' +
      '<div data-sdlg-finance-warn style="display:none;margin-top:8px;padding:8px 10px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;font-size:11px;font-weight:700;color:#92400e"></div>';

    var anchor = document.getElementById('sdlg_labourAmount');
    if (anchor && anchor.closest('div')) {
      var parent = anchor.closest('[style*="grid"]') || anchor.parentElement;
      if (parent && parent.parentElement) parent.parentElement.insertBefore(box, parent);
      else if (anchor.parentElement) anchor.parentElement.insertBefore(box, anchor);
      else r.insertBefore(box, r.firstChild);
    } else {
      r.insertBefore(box, r.firstChild);
    }

    box.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var kind = t.getAttribute('data-sdlg-rate');
      if (!kind) return;
      var v = num(t.value);
      if (kind === 'labour') state.labourRate = v;
      else if (kind === 'mileage') state.mileageRate = v;
      else if (kind === 'other') state.otherRate = v;
      else if (/^part/.test(kind)) state.partPrices[kind] = v;
      saveRates();
      recompute();
    });
  }

  function bindHrsKmListeners() {
    ['sdlg_repairLabor', 'sdlg_serviceMileage'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__sdlgFinanceBound) return;
      el.__sdlgFinanceBound = true;
      el.addEventListener('input', function () { recompute(); });
      el.addEventListener('change', function () { recompute(); });
    });
  }

  function formatStaticMoney(r) {
    try {
      r.querySelectorAll('table').forEach(function (table) {
        var head = (table.querySelector('thead') || {}).textContent || '';
        if (!/Unit Price/i.test(head)) return;
        table.querySelectorAll('tbody tr').forEach(function (tr) {
          var cells = tr.querySelectorAll('td');
          if (cells.length < 7) return;
          if (cells[5] && (isDash(cells[5].textContent) || cells[5].textContent.trim() === '0')) cells[5].textContent = '0.00';
          if (cells[6] && (isDash(cells[6].textContent) || cells[6].textContent.trim() === '0')) cells[6].textContent = '0.00';
        });
      });
      ['sdlg_labourAmount', 'sdlg_mileageAmount', 'sdlg_otherAmount', 'sdlg_totalAmount'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (isDash(el.value) || el.value === '' || el.value === '0') setInput(el, '0.00');
      });
    } catch (_) {}
  }

  function collapseReportName(r) {
    if (r.querySelector('[data-sdlg-report-toggle]')) return;
    var blocks = r.querySelectorAll('div');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if ((b.textContent || '').indexOf('Nama Report') < 0) continue;
      if ((b.textContent || '').length > 900) continue;
      var mono = null;
      var kids = b.querySelectorAll('div');
      for (var k = 0; k < kids.length; k++) {
        if (/monospace/i.test(kids[k].getAttribute('style') || '')) { mono = kids[k]; break; }
      }
      if (!mono || (mono.textContent || '').length < 100) return;
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

  function enhance() {
    var r = root();
    if (!r) return;
    try {
      formatStaticMoney(r);
      ensureCalcPanel(r);
      bindHrsKmListeners();
      recompute();
      collapseReportName(r);
    } catch (e) {
      console.warn('[SDLG finance-ux v4]', e && e.message ? e.message : e);
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(enhance, 400);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SDLGPortalFinance = {
    version: '4.0.0',
    recompute: recompute,
    getRates: function () { return { labourRate: state.labourRate, mileageRate: state.mileageRate, otherRate: state.otherRate }; }
  };
  console.info('[SDLG finance-ux] v4.0 auto-calc defaults labour=25 mileage=0.5');
})();
