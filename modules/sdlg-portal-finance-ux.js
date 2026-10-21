/**
 * SDLG Portal Finance — V6.0 (Enterprise Finance Engine)
 * Read-only output fields, Reset Rates, Auto-save indicator, Input Debounce.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V6.0:
 * ✅ REACT-SAFE: Native setter + dispatchEvent.
 * ✅ DARK MODE: CSS class buat panel kalkulator.
 * ✅ ZERO LAG: Batch lookup + scoped observer.
 * ✅ IDEMPOTENT: Panel gak bakal dobel.
 * ✅ CLEAN LOGGING: Cuma muncul di ?debug=true.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_PORTAL_FINANCE_V6__) return;
  window.__SDLG_PORTAL_FINANCE_V6__ = true;
  window.__SDLG_PORTAL_FINANCE_UX_V55__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & STATE
  // ─────────────────────────────────────────────────────────
  var STORAGE_KEY = 'sdlg:finance-rates:v1';
  var STYLE_ID = 'sdlg-finance-styles';
  var DEFAULT_LABOUR = 25;
  var DEFAULT_MILEAGE = 0.5;
  var IS_DEBUG = /[?&]debug=true/.test(String(location.search || ''));

  var state = {
    labourRate: DEFAULT_LABOUR,
    mileageRate: DEFAULT_MILEAGE,
    otherRate: 0,
    partPrices: {}
  };

  var isEnhancing = false;
  var debounceTimer = null;

  // Pre-compiled native setter (React-safe)
  var inputValueSetter = (function () {
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      return desc && desc.set ? desc.set : null;
    } catch (_) { return null; }
  })();

  // ─────────────────────────────────────────────────────────
  // 2. LOGGING (Debug Only)
  // ─────────────────────────────────────────────────────────
  function log() {
    if (!IS_DEBUG) return;
    console.info.apply(console, ['[SDLG Finance]'].concat([].slice.call(arguments)));
  }

  // ─────────────────────────────────────────────────────────
  // 3. UTILITIES
  // ─────────────────────────────────────────────────────────
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

  function debounce(func, wait) {
    var timeout;
    return function () {
      var context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () { func.apply(context, args); }, wait);
    };
  }

  function isDash(s) {
    return s == null || /^\s*$/.test(s) || s === '\u2014' || s === '-' || s === '\u2013' || /^kosong$/i.test(String(s));
  }

  // ─────────────────────────────────────────────────────────
  // 4. STORAGE (Rates)
  // ─────────────────────────────────────────────────────────
  function loadRates() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      state.labourRate = safeRate(o.labourRate, DEFAULT_LABOUR);
      state.mileageRate = safeRate(o.mileageRate, DEFAULT_MILEAGE);
      state.otherRate = num(o.otherRate) != null && num(o.otherRate) >= 0 ? num(o.otherRate) : 0;
      state.partPrices = o.partPrices && typeof o.partPrices === 'object' ? o.partPrices : {};
    } catch (_) {}
  }

  function saveRates() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  loadRates();

  // ─────────────────────────────────────────────────────────
  // 5. STYLES (Dark Mode Ready)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      [data-sdlg-finance-panel] {
        margin: 12px 0;
        padding: 14px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        transition: background-color 0.3s, border-color 0.3s;
      }
      [data-sdlg-finance-panel] .sdlg-fin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      [data-sdlg-finance-panel] .sdlg-fin-title {
        font-weight: 800;
        color: #0f172a;
        font-size: 14px;
      }
      [data-sdlg-finance-panel] .sdlg-fin-reset {
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        cursor: pointer;
        color: #475569;
        transition: background-color 0.15s;
      }
      [data-sdlg-finance-panel] .sdlg-fin-reset:hover {
        background: #e2e8f0;
      }
      [data-sdlg-finance-panel] .sdlg-fin-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        align-items: center;
      }
      [data-sdlg-finance-panel] .sdlg-fin-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
        color: #475569;
      }
      [data-sdlg-finance-panel] .sdlg-rate-input {
        width: 72px;
        padding: 6px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
      }
      [data-sdlg-finance-panel] .sdlg-rate-input:focus {
        border-color: #2f5bff;
        box-shadow: 0 0 0 3px rgba(47, 91, 255, 0.1);
      }
      [data-sdlg-finance-panel] .sdlg-save-status {
        font-size: 11px;
        font-weight: 700;
        color: #16a34a;
        opacity: 0;
        transition: opacity 0.3s;
      }
      
      /* Read-Only Styling */
      input.sdlg-calculated-readonly {
        background-color: #f1f5f9 !important;
        color: #64748b !important;
        cursor: not-allowed !important;
        border-style: dashed !important;
      }

      @media (prefers-color-scheme: dark) {
        [data-sdlg-finance-panel] {
          background: #111a2e;
          border-color: #1e2a45;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        [data-sdlg-finance-panel] .sdlg-fin-title { color: #f8fafc; }
        [data-sdlg-finance-panel] .sdlg-fin-reset {
          background: #1e293b;
          border-color: #334155;
          color: #cbd5e1;
        }
        [data-sdlg-finance-panel] .sdlg-fin-reset:hover {
          background: #334155;
        }
        [data-sdlg-finance-panel] .sdlg-fin-label { color: #94a3b8; }
        [data-sdlg-finance-panel] .sdlg-rate-input {
          background: #0f172a;
          border-color: #334155;
          color: #f8fafc;
        }
        [data-sdlg-finance-panel] .sdlg-rate-input:focus {
          border-color: #4d70ff;
        }
        input.sdlg-calculated-readonly {
          background-color: #1e293b !important;
          color: #94a3b8 !important;
          border-color: #334155 !important;
        }
      }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 6. DOM HELPERS (React-Safe)
  // ─────────────────────────────────────────────────────────
  function getRoot() {
    return document.querySelector('[data-sdlg-input-helper]');
  }

  function makeReadOnly(el) {
    if (!el || el.readOnly) return;
    el.readOnly = true;
    el.classList.add('sdlg-calculated-readonly');
  }

  function setInputValue(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.value === next) return; // Cegah loop

    try {
      if (inputValueSetter && el.tagName === 'INPUT') {
        inputValueSetter.call(el, next);
      } else {
        el.value = next;
      }
    } catch (_) {
      el.value = next;
    }

    // Dispatch events so React updates its state
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function setField(id, label, value, isCalc) {
    var els = [];

    // Lookup by ID
    if (id) {
      var byId = document.getElementById(id);
      if (byId) els.push(byId);
    }
    
    // Lookup by Label
    if (label) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
        if ((el.getAttribute('data-label') || '') === label) {
          if (els.indexOf(el) === -1) els.push(el);
        }
      });
    }

    els.forEach(function (el) {
      if (isCalc) makeReadOnly(el);
      setInputValue(el, value);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 7. CALCULATION ENGINE
  // ─────────────────────────────────────────────────────────
  function readHrsKm() {
    var hrsEl = document.getElementById('sdlg_repairLabor');
    var kmEl = document.getElementById('sdlg_serviceMileage');
    
    var hrs = num(hrsEl && hrsEl.value);
    var km = num(kmEl && kmEl.value);

    if (hrs == null && window.__SDLG_LIVE_CLAIM__) {
      hrs = num(window.__SDLG_LIVE_CLAIM__.labour_hrs);
    }
    if (km == null && window.__SDLG_LIVE_CLAIM__) {
      km = num(window.__SDLG_LIVE_CLAIM__.mileage_km);
    }
    return { hrs: hrs, km: km };
  }

  function calculatePartsTotal() {
    var total = 0;
    var claim = window.__SDLG_LIVE_CLAIM__;
    var parts = claim && Array.isArray(claim.parts) ? claim.parts : [];

    parts.forEach(function (p) {
      var qty = num(p && (p.qty || p.quantity)) || 0;
      var price = num(p && (p.unit_price || p.price || p.amount));
      
      if (price == null) {
        var pn = p && (p.part_no || p.failure_part || p.replace_part);
        if (pn && state.partPrices[pn] != null) {
          price = num(state.partPrices[pn]);
        }
      }
      if (price != null && qty > 0) total += price * qty;
    });

    return total;
  }

  function recompute() {
    var r = getRoot();
    if (!r) return;

    var hk = readHrsKm();
    var hrs = hk.hrs != null ? hk.hrs : 0;
    var km = hk.km != null ? hk.km : 0;

    var labourRate = safeRate(state.labourRate, DEFAULT_LABOUR);
    var mileageRate = safeRate(state.mileageRate, DEFAULT_MILEAGE);
    
    // Update state with safe rates
    state.labourRate = labourRate;
    state.mileageRate = mileageRate;

    var labour = hrs * labourRate;
    var mileage = km * mileageRate;
    var other = state.otherRate != null && state.otherRate >= 0 ? state.otherRate : 0;
    var partsAmt = calculatePartsTotal();

    // 1. Labour & Mileage
    setField('sdlg_labourAmount', 'Labour Amount', money(labour), true);
    setField('sdlg_mileageAmount', 'Mileage Amount', money(mileage), true);

    // 2. Other Amount (only set if empty/zero to avoid overwriting user's manual input)
    var oa = document.getElementById('sdlg_otherAmount');
    if (oa && (isDash(oa.value) || oa.value === '' || oa.value === '0' || oa.value === '0.00')) {
      setField('sdlg_otherAmount', 'Other Amount', money(other), true);
    }

    // 3. Total
    var otherVal = oa ? (num(oa.value) != null ? num(oa.value) : other) : other;
    var total = partsAmt + labour + mileage + otherVal;
    setField('sdlg_totalAmount', 'Total Amount Claimed', money(total), true);

    log('Calculated: labour=', money(labour), 'hrs=', hrs, 'rate=', labourRate, 'total=', money(total));
  }

  // ─────────────────────────────────────────────────────────
  // 8. RATE PANEL UI
  // ─────────────────────────────────────────────────────────
  function ensureCalcPanel(r) {
    if (r.querySelector('[data-sdlg-finance-panel]')) return;
    injectStyles();

    var box = document.createElement('div');
    box.setAttribute('data-sdlg-finance-panel', '1');

    box.innerHTML = `
      <div class="sdlg-fin-header">
        <div class="sdlg-fin-title">⚙️ Rate Calculator</div>
        <button type="button" class="sdlg-fin-reset" id="sdlg_reset_rates">Reset Default</button>
      </div>
      <div class="sdlg-fin-row">
        <label class="sdlg-fin-label">
          Labour rate 
          <input data-sdlg-rate="labour" type="number" step="0.01" value="${state.labourRate}" class="sdlg-rate-input"/>
        </label>
        <label class="sdlg-fin-label">
          Mileage rate 
          <input data-sdlg-rate="mileage" type="number" step="0.01" value="${state.mileageRate}" class="sdlg-rate-input"/>
        </label>
        <span id="sdlg_save_status" class="sdlg-save-status">✓ Saved!</span>
      </div>
    `;

    // Insert before "Other Cost Details" or append
    var anchor = null;
    r.querySelectorAll('div').forEach(function (d) {
      if (/^Other Cost Details$/i.test(String(d.textContent || '').trim()) && !anchor) {
        anchor = d;
      }
    });

    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(box, anchor);
    } else {
      r.appendChild(box);
    }

    // Event Listener: Rate Input
    box.addEventListener('input', function (e) {
      var t = e.target;
      var kind = t && t.getAttribute ? t.getAttribute('data-sdlg-rate') : null;
      if (!kind) return;

      var v = num(t.value);
      if (kind === 'labour') state.labourRate = safeRate(v, DEFAULT_LABOUR);
      else if (kind === 'mileage') state.mileageRate = safeRate(v, DEFAULT_MILEAGE);
      
      saveRates();
      recompute();

      // Show Saved Status
      var status = document.getElementById('sdlg_save_status');
      if (status) {
        status.style.opacity = '1';
        clearTimeout(window.__sdlg_save_timer);
        window.__sdlg_save_timer = setTimeout(function () { status.style.opacity = '0'; }, 1500);
      }
    });

    // Event Listener: Reset Button
    var resetBtn = box.querySelector('#sdlg_reset_rates');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
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
  }

  // ─────────────────────────────────────────────────────────
  // 9. BIND INPUT LISTENERS (Debounced)
  // ─────────────────────────────────────────────────────────
  function bindHrsKmListeners() {
    ['sdlg_repairLabor', 'sdlg_serviceMileage'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.getAttribute('data-sdlg-fin-bound') === '1') return;
      el.setAttribute('data-sdlg-fin-bound', '1');
      
      var debouncedRecompute = debounce(recompute, 200);
      el.addEventListener('input', debouncedRecompute);
      el.addEventListener('change', debouncedRecompute);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 10. SCRUB "KOSONG"
  // ─────────────────────────────────────────────────────────
  function scrubKosong(r) {
    if (!r) return;
    r.querySelectorAll('*').forEach(function (n) {
      if (n.childNodes && n.childNodes.length === 1 && n.childNodes[0].nodeType === 3) {
        if (/^\s*Kosong\s*$/i.test(n.textContent || '')) {
          n.textContent = '\u2014';
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // 11. MAIN ENHANCE LOOP
  // ─────────────────────────────────────────────────────────
  function enhance() {
    if (isEnhancing) return;
    isEnhancing = true;

    try {
      var r = getRoot();
      if (!r) return;
      
      ensureCalcPanel(r);
      bindHrsKmListeners();
      recompute();
      scrubKosong(r);
    } catch (e) {
      if (IS_DEBUG) console.warn('[SDLG Finance] Enhance error:', e);
    } finally {
      isEnhancing = false;
    }
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(enhance, 500);
  }

  // ─────────────────────────────────────────────────────────
  // 12. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    enhance();

    // 1. Observer: Cuma ngawasin area form
    var r = getRoot() || document.body;
    if (typeof MutationObserver !== 'undefined' && r) {
      var obs = new MutationObserver(schedule);
      obs.observe(r, { childList: true, subtree: true });
    }

    // 2. Event dari hydrate
    window.addEventListener('sdlg-hydrate-applied', schedule);
    window.addEventListener('sdlg-input-claim', schedule);
    window.addEventListener('hashchange', schedule);
    window.addEventListener('sdlg-route-changed', schedule);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 13. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  window.SDLGPortalFinance = Object.freeze({
    version: '6.0.0',
    recompute: recompute,
    getRates: function () {
      return {
        labourRate: state.labourRate,
        mileageRate: state.mileageRate,
        otherRate: state.otherRate
      };
    }
  });

  if (IS_DEBUG) console.info('[SDLG Finance] V6.0 Engine loaded');

})();