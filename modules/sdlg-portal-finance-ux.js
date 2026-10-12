/**
 * SDLG Portal Finance + UX polish v5.1
 * Labour = hrs × rate, Mileage = km × rate, Parts amount = qty × unit_price.
 * Forces values even when React paints 0.00 from empty DB columns.
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V51__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V51__ = true;
  window.__SDLG_PORTAL_FINANCE_UX_V5__ = true;

  var STORAGE_KEY = 'sdlg:finance-rates:v1';
  var DEFAULT_LABOUR = 25;
  var DEFAULT_MILEAGE = 0.5;

  function num(v) {
    if (v == null || v === '') return null;
    var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function money(n) {
    if (n == null || !Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
  }

  function loadRates() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { labourRate: DEFAULT_LABOUR, mileageRate: DEFAULT_MILEAGE, otherRate: 0, partPrices: {} };
      var o = JSON.parse(raw);
      return {
        labourRate: num(o.labourRate) != null ? num(o.labourRate) : DEFAULT_LABOUR,
        mileageRate: num(o.mileageRate) != null ? num(o.mileageRate) : DEFAULT_MILEAGE,
        otherRate: num(o.otherRate) != null ? num(o.otherRate) : 0,
        partPrices: o.partPrices && typeof o.partPrices === 'object' ? o.partPrices : {}
      };
    } catch (_) {
      return { labourRate: DEFAULT_LABOUR, mileageRate: DEFAULT_MILEAGE, otherRate: 0, partPrices: {} };
    }
  }

  var state = loadRates();

  function saveRates() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
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
    } catch (_) { el.value = next; }
    try { el.setAttribute('value', next); } catch (_) {}
  }

  function isDash(s) {
    return s == null || s === '' || s === '\u2014' || s === '-' || /^kosong$/i.test(String(s));
  }

  function readHrsKm() {
    return {
      hrs: num((document.getElementById('sdlg_repairLabor') || {}).value),
      km: num((document.getElementById('sdlg_serviceMileage') || {}).value)
    };
  }

  function partsTotal() {
    var total = 0;
    var claim = window.__SDLG_LIVE_CLAIM__;
    var parts = claim && Array.isArray(claim.parts) ? claim.parts : [];
    var r = root();
    if (!r) return 0;

    // Update table cells if present
    var rows = r.querySelectorAll('table tbody tr');
    rows.forEach(function (tr, idx) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 7) return;
      var p = parts[idx] || {};
      var qty = num(p.quantity != null ? p.quantity : p.qty) != null ? num(p.quantity != null ? p.quantity : p.qty) : num(cells[4] && cells[4].textContent);
      var unit = num(p.unit_price != null ? p.unit_price : p.unitPrice);
      if (unit == null) {
        var pn = String(p.failure_part || p.part_no || p.replace_part || (cells[1] && cells[1].textContent) || '').trim();
        if (pn && state.partPrices[pn] != null) unit = num(state.partPrices[pn]);
      }
      if (unit == null) unit = num(cells[5] && cells[5].textContent);
      if (unit == null) unit = 0;
      if (qty == null) qty = 1;
      var amt = qty * unit;
      total += amt;
      // Only overwrite display if we have a real price OR amount was empty/0
      if (cells[5] && (unit > 0 || isDash(cells[5].textContent) || cells[5].textContent === '0' || cells[5].textContent === '0.00')) {
        cells[5].textContent = money(unit);
      }
      if (cells[6]) cells[6].textContent = money(amt);
    });

    // If no table rows, sum from claim.parts
    if (!rows.length && parts.length) {
      parts.forEach(function (p) {
        var qty = num(p.quantity != null ? p.quantity : p.qty) || 1;
        var unit = num(p.unit_price != null ? p.unit_price : p.unitPrice) || 0;
        total += qty * unit;
      });
    }
    return total;
  }

  function recompute() {
    var r = root();
    if (!r) return;
    var hk = readHrsKm();
    var hrs = hk.hrs != null ? hk.hrs : 0;
    var km = hk.km != null ? hk.km : 0;

    var labour = hrs * (state.labourRate != null ? state.labourRate : DEFAULT_LABOUR);
    var mileage = km * (state.mileageRate != null ? state.mileageRate : DEFAULT_MILEAGE);
    var other = state.otherRate != null ? state.otherRate : 0;
    var partsAmt = partsTotal();

    var la = document.getElementById('sdlg_labourAmount');
    var ma = document.getElementById('sdlg_mileageAmount');
    var oa = document.getElementById('sdlg_otherAmount');
    var ta = document.getElementById('sdlg_totalAmount');

    // Always force labour/mileage from hrs×rate (override React 0.00 from empty DB)
    if (la) setInput(la, money(labour));
    if (ma) setInput(ma, money(mileage));
    if (oa && (isDash(oa.value) || oa.value === '' || oa.value === '0' || oa.value === '0.00')) setInput(oa, money(other));
    var otherVal = oa ? (num(oa.value) != null ? num(oa.value) : other) : other;
    var total = partsAmt + labour + mileage + otherVal;
    if (ta) setInput(ta, money(total));

    var summary = document.getElementById('sdlg-finance-summary');
    if (summary) {
      summary.innerHTML =
        '<b>Parts</b> ' + money(partsAmt) +
        ' &nbsp;·&nbsp; <b>Labour</b> ' + money(labour) +
        ' &nbsp;·&nbsp; <b>Mileage</b> ' + money(mileage) +
        ' &nbsp;·&nbsp; <b>Total</b> ' + money(total);
    }
  }

  function purgeExtraPanels() {
    var all = document.querySelectorAll('#sdlg-finance-calc-panel, [data-sdlg-finance-panel]');
    if (all.length <= 1) return;
    for (var i = 1; i < all.length; i++) {
      if (all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
  }

  function ensureCalcPanel(r) {
    purgeExtraPanels();
    if (document.getElementById('sdlg-finance-calc-panel')) return;

    var box = document.createElement('div');
    box.id = 'sdlg-finance-calc-panel';
    box.setAttribute('data-sdlg-finance-panel', '1');
    box.style.cssText = 'margin:12px 0;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:12px;color:#0f172a';
    box.innerHTML =
      '<div style="font-weight:800;margin-bottom:6px">Kalkulasi finansial (lokal)</div>' +
      '<div style="margin-bottom:8px;line-height:1.45;color:#64748b">Rate default: Labour 25 / jam, Mileage 0.5 / km. Tidak menulis DB.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px">' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Labour Rate / jam<input data-sdlg-rate="labour" type="number" step="0.01" value="' +
      (state.labourRate != null ? state.labourRate : '') +
      '" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:7px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Mileage Rate / km<input data-sdlg-rate="mileage" type="number" step="0.01" value="' +
      (state.mileageRate != null ? state.mileageRate : '') +
      '" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:7px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Other Amount<input data-sdlg-rate="other" type="number" step="0.01" value="' +
      (state.otherRate != null ? state.otherRate : 0) +
      '" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:7px"></label>' +
      '</div>' +
      '<div id="sdlg-finance-summary" style="font-size:12px;color:#0f172a"></div>';

    var anchor = null;
    r.querySelectorAll('div').forEach(function (d) {
      if (/^Other Cost Details$/i.test(String(d.textContent || '').trim()) && !anchor) anchor = d;
    });
    if (!anchor) {
      r.querySelectorAll('div').forEach(function (d) {
        if (/Labour Amount/i.test(d.textContent || '') && !anchor) anchor = d;
      });
    }
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor);
    else r.appendChild(box);

    box.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var kind = t.getAttribute('data-sdlg-rate');
      if (!kind) return;
      var v = num(t.value);
      if (kind === 'labour') state.labourRate = v;
      else if (kind === 'mileage') state.mileageRate = v;
      else if (kind === 'other') state.otherRate = v;
      saveRates();
      recompute();
    });
  }

  function bindHrsKmListeners() {
    ['sdlg_repairLabor', 'sdlg_serviceMileage'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.getAttribute('data-sdlg-fin-bound') === '1') return;
      el.setAttribute('data-sdlg-fin-bound', '1');
      el.addEventListener('input', recompute);
      el.addEventListener('change', recompute);
    });
  }

  function scrubKosong(r) {
    if (!r) return;
    r.querySelectorAll('*').forEach(function (n) {
      if (n.childNodes && n.childNodes.length === 1 && n.childNodes[0].nodeType === 3) {
        if (/^\s*Kosong\s*$/i.test(n.textContent || '')) n.textContent = '\u2014';
      }
    });
  }

  function enhance() {
    var r = root();
    if (!r) { purgeExtraPanels(); return; }
    try {
      ensureCalcPanel(r);
      bindHrsKmListeners();
      recompute();
      scrubKosong(r);
    } catch (e) {
      try { console.warn('[SDLG finance-ux v5.1]', e); } catch (_) {}
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var deb = null;
      new MutationObserver(function () {
        clearTimeout(deb);
        deb = setTimeout(enhance, 500);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(function () {
      purgeExtraPanels();
      recompute();
      scrubKosong(root());
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SDLGPortalFinance = {
    version: '5.1.0',
    recompute: recompute,
    getRates: function () {
      return { labourRate: state.labourRate, mileageRate: state.mileageRate, otherRate: state.otherRate };
    }
  };
  console.info('[SDLG finance-ux] v5.1 labour+parts');
})();
