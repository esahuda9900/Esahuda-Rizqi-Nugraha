/**
 * SDLG Portal Finance v5.5 — Ultimate UX & Performance Update
 * New: Read-only output fields, Reset Rates, Auto-save indicator, Input Debounce.
 * Fixes: Infinite loop, CPU overload, Console spam.
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V55__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V55__ = true;
  window.__SDLG_PORTAL_FINANCE_UX_V5__ = true;

  var STORAGE_KEY = 'sdlg:finance-rates:v1';
  var DEFAULT_LABOUR = 25;
  var DEFAULT_MILEAGE = 0.5;
  var IS_DEBUG = window.location.search.indexOf('debug=true') > -1;

  // Helper log agar console bersih saat production
  function log() {
    if (IS_DEBUG) console.info.apply(console, ['[SDLG finance]', ...arguments]);
  }

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

  // Fitur Anti-Lag: Tunggu user berhenti ngetik baru hitung
  function debounce(func, wait) {
    var timeout;
    return function () {
      var context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () { func.apply(context, args); }, wait);
    };
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
  if (!(state.labourRate > 0)) state.labourRate = DEFAULT_LABOUR;
  if (!(state.mileageRate > 0)) state.mileageRate = DEFAULT_MILEAGE;

  function saveRates() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function root() {
    return document.querySelector('[data-sdlg-input-helper]');
  }

  // Anti-Tamper: Kunci input hasil hitungan agar tidak bisa diedit manual
  function makeReadOnly(el) {
    if (!el) return;
    if (!el.readOnly) {
      el.readOnly = true;
      el.style.backgroundColor = '#f1f5f9'; // Kasih warna abu-abu biar user tau itu otomatis
      el.style.cursor = 'not-allowed';
    }
  }

  function setInput(el, value, isCalculated) {
    if (!el) return;
    if (isCalculated) makeReadOnly(el);
    
    var next = String(value);
    if (el.value === next) return; // Mencegah infinite loop
    
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, next);
      else el.value = next;
    } catch (_) { el.value = next; }
    try { el.setAttribute('value', next); el.defaultValue = next; } catch (_) {}
  }

  function setByIdOrLabel(id, label, value, isCalculated) {
    var el = document.getElementById(id);
    if (el) setInput(el, value, isCalculated);
    document.querySelectorAll('[id="' + id + '"]').forEach(function (n) { setInput(n, value, isCalculated); });
    if (label) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (n) {
        if ((n.getAttribute('data-label') || '') === label) setInput(n, value, isCalculated);
      });
    }
  }

  function isDash(s) {
    return s == null || /^\s*$/.test(s) || s === '\u2014' || s === '-' || s === '\u2013' || /^kosong$/i.test(String(s));
  }

  function readHrsKm() {
    var hrsEl = document.getElementById('sdlg_repairLabor');
    var kmEl = document.getElementById('sdlg_serviceMileage');
    var hrs = num(hrsEl && hrsEl.value);
    var km = num(kmEl && kmEl.value);
    if (hrs == null && window.__SDLG_LIVE_CLAIM__) hrs = num(window.__SDLG_LIVE_CLAIM__.labour_hrs);
    if (km == null && window.__SDLG_LIVE_CLAIM__) km = num(window.__SDLG_LIVE_CLAIM__.mileage_km);
    return { hrs: hrs, km: km };
  }

  function partsTotal() {
    var total = 0;
    var claim = window.__SDLG_LIVE_CLAIM__;
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

    // isCalculated = true -> Membuat input menjadi Read-Only
    setByIdOrLabel('sdlg_labourAmount', 'Labour Amount', money(labour), true);
    setByIdOrLabel('sdlg_mileageAmount', 'Mileage Amount', money(mileage), true);

    var oa = document.getElementById('sdlg_otherAmount');
    if (oa && (isDash(oa.value) || oa.value === '' || oa.value === '0' || oa.value === '0.00')) {
      setByIdOrLabel('sdlg_otherAmount', 'Other Amount', money(other), true);
    }
    
    var otherVal = oa ? (num(oa.value) != null ? num(oa.value) : other) : other;
    var total = partsAmt + labour + mileage + otherVal;
    setByIdOrLabel('sdlg_totalAmount', 'Total Amount Claimed', money(total), true);

    log('Calculated: labour=', money(labour), 'hrs=', hrs, 'rate=', labourRate, 'total=', money(total));
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
    box.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-size:13px;box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
    
    // UI Panel yang lebih rapi + Tombol Reset
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<div style="font-weight:700;color:#0f172a">⚙️ Rate Calculator</div>' +
        '<button type="button" id="sdlg_reset_rates" style="font-size:11px;padding:4px 8px;background:#e2e8f0;border:none;border-radius:4px;cursor:pointer;color:#475569;">Reset Default</button>' +
      '</div>' +
      '<div style="display:flex;gap:15px;flex-wrap:wrap;align-items:center">' +
        '<label style="display:flex;align-items:center;gap:5px;">Labour rate <input data-sdlg-rate="labour" type="number" step="0.01" value="' +
        state.labourRate +
        '" style="width:70px;padding:4px;border:1px solid #cbd5e1;border-radius:4px;"/></label>' +
        '<label style="display:flex;align-items:center;gap:5px;">Mileage rate <input data-sdlg-rate="mileage" type="number" step="0.01" value="' +
        state.mileageRate +
        '" style="width:70px;padding:4px;border:1px solid #cbd5e1;border-radius:4px;"/></label>' +
        '<span id="sdlg_save_status" style="font-size:11px;color:#10b981;opacity:0;transition:opacity 0.3s;">✓ Saved!</span>' +
      '</div>';
      
    var anchor = null;
    r.querySelectorAll('div').forEach(function (d) {
      if (/^Other Cost Details$/i.test(String(d.textContent || '').trim()) && !anchor) anchor = d;
    });
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor);
    else r.appendChild(box);

    // Event Listener untuk Input Rate
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
      
      // Efek visual "Saved!"
      var status = document.getElementById('sdlg_save_status');
      if (status) {
        status.style.opacity = '1';
        clearTimeout(window.__sdlg_save_timer);
        window.__sdlg_save_timer = setTimeout(function() { status.style.opacity = '0'; }, 1500);
      }
    });

    // Event Listener untuk Tombol Reset
    box.querySelector('#sdlg_reset_rates').addEventListener('click', function() {
      state.labourRate = DEFAULT_LABOUR;
      state.mileageRate = DEFAULT_MILEAGE;
      saveRates();
      
      var inL = box.querySelector('[data-sdlg-rate="labour"]');
      var inM = box.querySelector('[data-sdlg-rate="mileage"]');
      if (inL) inL.value = DEFAULT_LABOUR;
      if (inM) inM.value = DEFAULT_MILEAGE;
      
      recompute();
    });
  }

  function bindHrsKmListeners() {
    ['sdlg_repairLabor', 'sdlg_serviceMileage'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.getAttribute('data-sdlg-fin-bound') === '1') return;
      el.setAttribute('data-sdlg-fin-bound', '1');
      
      // Gunakan Debounce (tunggu 200ms setelah user berhenti ngetik)
      var debouncedRecompute = debounce(recompute, 200);
      el.addEventListener('input', debouncedRecompute);
      el.addEventListener('change', debouncedRecompute);
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
    if (window.__SDLG_FINANCE_UX_ENHANCING__) return;
    window.__SDLG_FINANCE_UX_ENHANCING__ = true;

    try {
      var r = root();
      if (!r) { purgeExtraPanels(); return; }
      ensureCalcPanel(r);
      bindHrsKmListeners();
      recompute();
      scrubKosong(r);
    } catch (e) {
      if (IS_DEBUG) console.warn('[SDLG finance-ux v5.5]', e);
    } finally {
      window.__SDLG_FINANCE_UX_ENHANCING__ = false;
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var deb = null;
      var observer = new MutationObserver(function () {
        if (window.__SDLG_FINANCE_UX_ENHANCING__) return;
        clearTimeout(deb);
        deb = setTimeout(enhance, 800);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SDLGPortalFinance = {
    version: '5.5.0',
    recompute: recompute,
    getRates: function () {
      return { labourRate: state.labourRate, mileageRate: state.mileageRate, otherRate: state.otherRate };
    }
  };
  
  if (IS_DEBUG) console.info('[SDLG finance-ux] v5.5 Loaded (Debug Mode ON)');
})();