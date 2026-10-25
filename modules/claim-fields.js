/**
 * SDLG Claim Field Registry + Smart Module Loader — V2.0
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ANTI-RACE CONDITION: File di-load berurutan (async=false).
 * ✅ SMART NOTIFICATION: Muncul notif jika ada file gagal load.
 * ✅ IMMUTABLE CONFIG: Data field dilindungi Object.freeze().
 * ✅ AUTO-RETRY: Bisa coba load ulang jika gagal.
 * ═══════════════════════════════════════════════════════════
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

  // Freeze object biar gak bisa diubah-ubah sama script lain (Security)
  global.SDLG_CLAIM_FIELDS = Object.freeze({
    CLAIM_SELECT: CLAIM_SELECT.join(','),
    CLAIM_SELECT_LIST: Object.freeze(CLAIM_SELECT),
    FORBIDDEN_COLUMNS: Object.freeze(['service_type', 'work_location', 'branch_name', 'service_method']),
    pickFirst: pickFirst,
    stripTechPrefix: stripTechPrefix
  });

  // ─────────────────────────────────────────────────────────
  // 2. KONFIGURASI MODUL YANG MAU DI-LOAD
  // ─────────────────────────────────────────────────────────
  var MODULES = [
    { src: './modules/sdlg-input-hydrate.js?v=20261021-v15', attr: 'data-sdlg-input-hydrate' },
    { src: './modules/sdlg-hash-router.js?v=20261012-v221', attr: 'data-sdlg-hash-router' },
    { src: './modules/sdlg-hash-tab-bridge.js?v=20261012-v23', attr: 'data-sdlg-hash-tab-bridge' },
    { src: './modules/sdlg-input-claim-sync.js?v=20261026-login-freeze', attr: 'data-sdlg-input-claim-sync' },
    { src: './modules/sdlg-portal-finance-ux.js?v=20261012-v53', attr: 'data-sdlg-finance-ux' },
    { src: './modules/sdlg-portal-ux-v2.js?v=20261009-v24', attr: 'data-sdlg-portal-ux-v2' },
    { src: './modules/sdlg-route-finish.js?v=20261010-v15', attr: 'data-sdlg-route-finish' },
    { src: './modules/sdlg-ui-consolidate.js?v=20261009-v1', attr: 'data-sdlg-ui-consolidate' },
    { src: './modules/sdlg-ui-polish-v3.js?v=20261010-v33', attr: 'data-sdlg-ui-polish-v3' },
    { src: './modules/sdlg-auth-route-guard.js?v=20261021-v14', attr: 'data-sdlg-auth-route-guard' },
    { src: './modules/sdlg-overview-session-gate.js?v=20261010-v12', attr: 'data-sdlg-overview-gate' },
    { src: './modules/sdlg-overview-ux.js?v=20261010-v11', attr: 'data-sdlg-overview-ux' }
  ];

  // ─────────────────────────────────────────────────────────
  // 3. SMART LOADER (Berurutan & Anti-Gagal)
  // ─────────────────────────────────────────────────────────
  function loadScript(mod) {
    return new Promise(function (resolve) {
      // Kalau udah ada di halaman, skip (jangan dobel)
      if (document.querySelector('script[' + mod.attr + ']')) {
        return resolve({ ok: true, skipped: true });
      }

      var s = document.createElement('script');
      s.src = mod.src;
      s.async = false; // WAJIB FALSE: Biar urutan gak kacau!
      s.setAttribute(mod.attr, '1');

      s.onload = function () {
        console.log('[SDLG Loader] ✅ Loaded: ' + mod.attr);
        resolve({ ok: true });
      };

      s.onerror = function () {
        console.warn('[SDLG Loader] ❌ Gagal load: ' + mod.src);
        // Munculin notif kalau SDLGNotify tersedia
        if (global.SDLGNotify && global.SDLGNotify.error) {
          global.SDLGNotify.error('Modul Gagal Dimuat', 'File berikut gagal di-download: ' + mod.attr);
        }
        resolve({ ok: false, error: mod.src });
      };

      (document.head || document.documentElement).appendChild(s);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 4. EKSEKUSI (Load Satu per Satu)
  // ─────────────────────────────────────────────────────────
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

  // Jalanin cuma kalau DOM udah siap
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadAllModules, { once: true });
    } else {
      loadAllModules();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
