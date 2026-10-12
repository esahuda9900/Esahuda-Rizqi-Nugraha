/**
 * SDLG Portal Finance + UX polish v5.0
 * Single calc panel (global dedupe). Auto labour/mileage amounts.
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V5__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V5__ = true;
  window.__SDLG_PORTAL_FINANCE_UX_V4__ = true;

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
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

  function recompute() {
    var r = root();
    if (!r) return;
    var hk = readHrsKm();
    var hrs = hk.hrs != null ? hk.hrs : 0;
    var km = hk.km != null ? hk.km : 0;
    var labour = hrs * (state.labourRate != null ? state.labourRate : DEFAULT_LABOUR);
    var mileage = km * (state.mileageRate != null ? state.mileageRate : DEFAULT_MILEAGE);
    var other = state.otherRate != null ? state.otherRate : 0;

    var la = document.getElementById('sdlg_labourAmount');
    var ma = document.getElementById('sdlg_mileageAmount');
    var oa = document.getElementById('sdlg_otherAmount');
    var ta = document.getElementById('sdlg_totalAmount');

    if (la) setInput(la, money(labour));
    if (ma) setInput(ma, money(mileage));
    if (oa && (isDash(oa.value) || oa.value === '' || oa.value === '0' || oa.value === '0.00')) setInput(oa, money(other));

    var otherVal = oa ? num(oa.value) || 0 : other;
    var total = labour + mileage + otherVal;
    if (ta) setInput(ta, money(total));

    var sum = r.querySelector('[data-sdlg-finance-summary]');
    if (sum) {
      sum.innerHTML =
        '<b>Labour</b> ' +
        money(labour) +
        ' &nbsp;·&nbsp; <b>Mileage</b> ' +
        money(mileage) +
        ' &nbsp;·&nbsp; <b>Other</b> ' +
        money(otherVal) +
        ' &nbsp;·&nbsp; <b>Total</b> ' +
        money(total);
    }
  }

  function purgeExtraPanels() {
    var all = document.querySelectorAll('[data-sdlg-finance-calc]');
    for (var i = 1; i < all.length; i++) {
      if (all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
    return document.querySelector('[data-sdlg-finance-calc]');
  }

  function ensureCalcPanel(r) {
    var existing = purgeExtraPanels();
    if (existing) {
      if (r && !r.contains(existing)) {
        var anchor0 = null;
        r.querySelectorAll('div').forEach(function (d) {
          if (/Other Cost Details|Labour Amount/i.test(d.textContent || '') && !anchor0) anchor0 = d;
        });
        if (anchor0 && anchor0.parentElement) anchor0.parentElement.insertBefore(existing, anchor0);
        else r.appendChild(existing);
      }
      return;
    }

    var box = document.createElement('div');
    box.setAttribute('data-sdlg-finance-calc', '1');
    box.style.cssText =
      'margin:12px 0;padding:12px 14px;background:#fffbeb;border:1px solid #f59e0b;border-radius:12px;font-size:12px;color:#78350f';
    box.innerHTML =
      '<div style="font-weight:800;font-size:13px;margin-bottom:6px">Kalkulasi finansial (auto)</div>' +
      '<div style="margin-bottom:8px;line-height:1.45">Rate default: Labour 25 / jam, Mileage 0.5 / km. (Copy ke portal; tidak menulis DB.)</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Labour Rate / jam<input data-sdlg-rate="labour" type="number" step="any" value="' +
      (state.labourRate != null ? state.labourRate : '') +
      '" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Mileage Rate / km<input data-sdlg-rate="mileage" type="number" step="any" value="' +
      (state.mileageRate != null ? state.mileageRate : '') +
      '" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Other Amount<input data-sdlg-rate="other" type="number" step="any" value="' +
      (state.otherRate != null ? state.otherRate : 0) +
      '" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '</div>' +
      '<div data-sdlg-finance-summary style="margin-top:10px;padding:8px 10px;background:#fff;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#0f172a"></div>';

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

  function formatStaticMoney(r) {}
  function collapseReportName(r) {}

  function enhance() {
    var r = root();
    if (!r) {
      purgeExtraPanels();
      return;
    }
    try {
      ensureCalcPanel(r);
      bindHrsKmListeners();
      recompute();
    } catch (e) {
      try {
        console.warn('[SDLG finance-ux v5]', e);
      } catch (_) {}
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var deb = null;
      new MutationObserver(function () {
        clearTimeout(deb);
        deb = setTimeout(enhance, 700);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(function () {
      purgeExtraPanels();
      recompute();
    }, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SDLGPortalFinance = {
    version: '5.0.0',
    recompute: recompute,
    getRates: function () {
      return { labourRate: state.labourRate, mileageRate: state.mileageRate, otherRate: state.otherRate };
    }
  };
  console.info('[SDLG finance-ux] v5.0 single panel');
})();
