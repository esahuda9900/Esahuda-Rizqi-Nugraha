/**
 * SDLG Portal Finance v5.3 — never use labourRate<=0; force hrs*25 when amount stuck at 0.
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V53__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V53__ = true;
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

  function safeRate(v, fallback) {
    var n = num(v);
    if (n == null || n <= 0) return fallback;
    return n;
  }

  function loadRates() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { labourRate: DEFAULT_LABOUR, mileageRate: DEFAULT_MILEAGE, otherRate: 0, partPrices: {} };
      var o = JSON.parse(raw);
      return {
        labourRate: safeRate(o.labourRate, DEFAULT_LABOUR),
        mileageRate: safeRate(o.mileageRate, DEFAULT_MILEAGE),
        otherRate: num(o.otherRate) != null && num(o.otherRate) >= 0 ? num(o.otherRate) : 0,
        partPrices: o.partPrices && typeof o.partPrices === 'object' ? o.partPrices : {}
      };
    } catch (_) {
      return { labourRate: DEFAULT_LABOUR, mileageRate: DEFAULT_MILEAGE, otherRate: 0, partPrices: {} };
    }
  }

  var state = loadRates();
  // heal bad rates from previous sessions
  if (!(state.labourRate > 0)) state.labourRate = DEFAULT_LABOUR;
  if (!(state.mileageRate > 0)) state.mileageRate = DEFAULT_MILEAGE;

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
    try { el.setAttribute('value', next); el.defaultValue = next; } catch (_) {}
  }

  function setByIdOrLabel(id, label, value) {
    var el = document.getElementById(id);
    if (el) setInput(el, value);
    document.querySelectorAll('[id="' + id + '"]').forEach(function (n) { setInput(n, value); });
    if (label) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (n) {
        if ((n.getAttribute('data-label') || '') === label) setInput(n, value);
      });
    }
  }

  function isDash(s) {
    return s == null || /^\s*$/.test(s) || s === '\u2014' || s === '-' || s === '\u2013' || /^kosong$/i.test(String(s));
  }

  function currentClaimId() {
    var r = root();
    if (r) {
      var selects = r.querySelectorAll('select');
      for (var i = 0; i < selects.length; i++) {
        var value = String(selects[i].value || '').trim();
        if (/^\\d{3,4}-\\d{4}-SDLG-PFR$/i.test(value)) return value;
      }
    }
    var hash = String(window.location && window.location.hash || '');
    var match = hash.match(/(?:sdlg-input|sdlginput|claims|claim)\\/([^/?#]+)/i);
    if (match) {
      try { return decodeURIComponent(match[1]).trim(); } catch (_) { return String(match[1]).trim(); }
    }
    return '';
  }

  function verifiedLiveClaim() {
    var claim = window.__SDLG_LIVE_CLAIM__;
    var id = currentClaimId();
    if (!claim || !id || String(claim.claim_id || '').trim().toUpperCase() !== id.toUpperCase()) return null;
    return claim;
  }

  function readHrsKm() {
    var hrsEl = document.getElementById('sdlg_repairLabor');
    var kmEl = document.getElementById('sdlg_serviceMileage');
    var hrs = num(hrsEl && hrsEl.value);
    var km = num(kmEl && kmEl.value);
    var claim = verifiedLiveClaim();
    if (hrs == null && claim) hrs = num(claim.labour_hrs);
    if (km == null && claim) km = num(claim.mileage_km);
    return { hrs: hrs, km: km };
  }

  function partsTotal() {
    var total = 0;
    var claim = verifiedLiveClaim();
    var parts = claim && Array.isArray(claim.parts) ? claim.parts : [];
    parts.forEach(function (p) {
      var qty = num(p && (p.qty || p.quantity)) || 0;
      var price = num(p && (p.unit_price || p.price || p.amount));
      if (price == null) {
        var pn = p && (p.part_no || p.failure_part || p.replace_part);
        if (pn && state.partPrices[pn] != null) price = num(state.partPrices[pn]);
      }
      if (price != null && qty > 0) total += price * qty;
    });
    return total;
  }

  function recompute() {
    var r = root();
    if (!r) return;
    var hk = readHrsKm();
    var hrs = hk.hrs != null ? hk.hrs : 0;
    var km = hk.km != null ? hk.km : 0;

    var labourRate = safeRate(state.labourRate, DEFAULT_LABOUR);
    var mileageRate = safeRate(state.mileageRate, DEFAULT_MILEAGE);
    state.labourRate = labourRate;
    state.mileageRate = mileageRate;

    var labour = hrs * labourRate;
    var mileage = km * mileageRate;
    var other = state.otherRate != null && state.otherRate >= 0 ? state.otherRate : 0;
    var partsAmt = partsTotal();

    setByIdOrLabel('sdlg_labourAmount', 'Labour Amount', money(labour));
    setByIdOrLabel('sdlg_mileageAmount', 'Mileage Amount', money(mileage));

    var oa = document.getElementById('sdlg_otherAmount');
    if (oa && (isDash(oa.value) || oa.value === '' || oa.value === '0' || oa.value === '0.00')) {
      setByIdOrLabel('sdlg_otherAmount', 'Other Amount', money(other));
    }
    var otherVal = oa ? (num(oa.value) != null ? num(oa.value) : other) : other;
    var total = partsAmt + labour + mileage + otherVal;
    setByIdOrLabel('sdlg_totalAmount', 'Total Amount Claimed', money(total));

    try {
      console.info('[SDLG finance] labour=', money(labour), 'hrs=', hrs, 'rate=', labourRate, 'mileage=', money(mileage), 'total=', money(total));
    } catch (_) {}
  }

  function purgeExtraPanels() {
    var panels = document.querySelectorAll('[data-sdlg-finance-panel]');
    if (panels.length > 1) {
      for (var i = 1; i < panels.length; i++) {
        try { panels[i].remove(); } catch (_) {}
      }
    }
  }

  function ensureCalcPanel(r) {
    if (r.querySelector('[data-sdlg-finance-panel]')) return;
    var box = document.createElement('div');
    box.setAttribute('data-sdlg-finance-panel', '1');
    box.style.cssText = 'margin:12px 0;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:12px;';
    box.innerHTML =
      '<div style="font-weight:700;margin-bottom:6px;color:#0f172a">Rate Calculator</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<label>Labour rate <input data-sdlg-rate="labour" type="number" step="0.01" value="' +
      state.labourRate +
      '" style="width:80px;margin-left:4px"/></label>' +
      '<label>Mileage rate <input data-sdlg-rate="mileage" type="number" step="0.01" value="' +
      state.mileageRate +
      '" style="width:80px;margin-left:4px"/></label>' +
      '</div>';
    var anchor = null;
    r.querySelectorAll('div').forEach(function (d) {
      if (/^Other Cost Details$/i.test(String(d.textContent || '').trim()) && !anchor) anchor = d;
    });
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor);
    else r.appendChild(box);

    box.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var kind = t.getAttribute('data-sdlg-rate');
      if (!kind) return;
      var v = num(t.value);
      if (kind === 'labour') state.labourRate = safeRate(v, DEFAULT_LABOUR);
      else if (kind === 'mileage') state.mileageRate = safeRate(v, DEFAULT_MILEAGE);
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
      try { console.warn('[SDLG finance-ux v5.3]', e); } catch (_) {}
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var deb = null;
      new MutationObserver(function () {
        clearTimeout(deb);
        deb = setTimeout(enhance, 400);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(function () {
      purgeExtraPanels();
      recompute();
      scrubKosong(root());
    }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SDLGPortalFinance = {
    version: '5.3.0',
    recompute: recompute,
    getRates: function () {
      return { labourRate: state.labourRate, mileageRate: state.mileageRate, otherRate: state.otherRate };
    }
  };
  console.info('[SDLG finance-ux] v5.3 safe rates');
})();
