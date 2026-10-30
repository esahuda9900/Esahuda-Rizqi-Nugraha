/**
 * SDLG Claim Field Registry + Smart Module Loader — V2.1
 *
 * Clean 2026-10-30: only load modules that still exist in /modules
 * (archived files no longer requested → console 404 silence).
 */
(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI FIELD DATABASE
  // ─────────────────────────────────────────────────────────
  var CLAIM_SELECT = [
    'claim_id', 'model', 'serial_no', 'customer', 'repair_method', 'technical_personnel',
    'causing_part_no', 'causing_part_desc', 'failure_part_location', 'fault_description',
    'cause_analyze', 'comment', 'parts', 'hm_failure', 'hm_completion', 'sales_date',
    'failure_date', 'dealer_repair_date', 'completion_date', 'dealer_claim_date',
    'labour_amount', 'mileage_amount', 'other_amount', 'total_amount', 'mileage_km', 'labour_hrs',
    'dealer_wo_so', 'branch', 'customer'
  ];

  function pickFirst() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v == null) continue;
      var s = String(v).trim();
      if (!s) continue;
      if (/^kosong$/i.test(s) || /^xxx+$/i.test(s) || /^unknown$/i.test(s) || s === '\u2014' || s === '-' || s === '\u2013') continue;
      return s;
    }
    return '';
  }

  function stripTechPrefix(s) {
    return String(s || '').replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
  }

  global.SDLG_CLAIM_FIELDS = Object.freeze({
    CLAIM_SELECT: CLAIM_SELECT.join(','),
    CLAIM_SELECT_LIST: Object.freeze(CLAIM_SELECT),
    FORBIDDEN_COLUMNS: Object.freeze(['service_type', 'work_location', 'branch_name', 'service_method']),
    pickFirst: pickFirst,
    stripTechPrefix: stripTechPrefix
  });

  // ─────────────────────────────────────────────────────────
  // 2. MODUL AKTIF SAJA (yang masih ada di /modules, bukan _archive)
  // ─────────────────────────────────────────────────────────
  var MODULES = [
    { src: './modules/sdlg-hash-router.js?v=20261030-clean-v1', attr: 'data-sdlg-hash-router' },
    { src: './modules/sdlg-portal-finance-ux.js?v=20261030-clean-v1', attr: 'data-sdlg-finance-ux' },
    { src: './modules/sdlg-ui-polish-v3.js?v=20261030-clean-v1', attr: 'data-sdlg-ui-polish-v3' }
  ];

  // Removed (archived → 404):
  // sdlg-route-finish.js, sdlg-auth-route-guard.js,
  // sdlg-overview-session-gate.js, sdlg-overview-ux.js

  // ─────────────────────────────────────────────────────────
  // 3. SMART LOADER
  // ─────────────────────────────────────────────────────────
  function loadScript(mod) {
    return new Promise(function (resolve) {
      if (document.querySelector('script[' + mod.attr + ']')) {
        return resolve({ ok: true, skipped: true });
      }

      var s = document.createElement('script');
      s.src = mod.src;
      s.async = false;
      s.setAttribute(mod.attr, '1');

      s.onload = function () {
        console.log('[SDLG Loader] ✅ Loaded: ' + mod.attr);
        resolve({ ok: true });
      };

      s.onerror = function () {
        console.warn('[SDLG Loader] ❌ Gagal load: ' + mod.src);
        if (global.SDLGNotify && global.SDLGNotify.error) {
          global.SDLGNotify.error('Modul Gagal Dimuat', 'File berikut gagal di-download: ' + mod.attr);
        }
        resolve({ ok: false, error: mod.src });
      };

      (document.head || document.documentElement).appendChild(s);
    });
  }

  function loadAllModules() {
    console.info('[SDLG Loader] Memulai proses load ' + MODULES.length + ' modul...');

    var chain = Promise.resolve();

    MODULES.forEach(function (mod) {
      chain = chain.then(function () {
        return loadScript(mod);
      });
    });

    chain.then(function () {
      console.info('[SDLG Loader] 🎉 SEMUA MODUL SELESAI DI-LOAD!');
      global.dispatchEvent(new CustomEvent('sdlg-modules-ready'));
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadAllModules, { once: true });
    } else {
      loadAllModules();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
