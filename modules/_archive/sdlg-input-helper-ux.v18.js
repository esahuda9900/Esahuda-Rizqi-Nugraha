/**
 * SDLG Input Helper — Deprecated Stub V2.0 (The Guardian)
 * 
 * ═══════════════════════════════════════════════════════════
 * STATUS: DEPRECATED (By Design)
 * 
 * ALASAN:
 * Implementasi asli sekarang ada di `modules/sdlg-input-helper-ux.js` (V2.0).
 * File ini dipertahankan hanya untuk backward compatibility 
 * (kalau ada script tag lama yang masih manggil).
 * 
 * UPGRADE V2.0:
 * ✅ IMMUTABLE: Gak bisa di-override / dihapus.
 * ✅ SENTINEL TRAP: Nangkep panggilan dari kode usang.
 * ✅ DEVELOPER GUIDANCE: Log jelas cuma sekali.
 * ✅ ZERO OVERHEAD: Gak makan CPU/RAM sama sekali.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_INPUT_HELPER_V2_GUARDIAN__) return;
  
  // 1. Lock Global Flag (Read-Only)
  try {
    Object.defineProperty(root, '__SDLG_INPUT_HELPER_V2_GUARDIAN__', { value: true, writable: false });
  } catch (_) {
    root.__SDLG_INPUT_HELPER_V2_GUARDIAN__ = true;
  }

  // 2. Cek dulu, apakah versi baru udah aktif?
  var realImplActive = !!(root.SDLGInputHelperUX && root.SDLGInputHelperUX.version);
  
  // 3. Console log (cuma sekali, gak spam)
  if (typeof console !== 'undefined' && console.info) {
    if (realImplActive) {
      // Versi baru aktif — log normal
      console.info(
        '%c[SDLG]%c Input Helper v18 stub → digantikan oleh sdlg-input-helper-ux.js (v' + 
        root.SDLGInputHelperUX.version + ')',
        'background:#2f5bff;color:white;padding:2px 6px;border-radius:4px;font-weight:700',
        'color:#64748b;font-size:12px'
      );
    } else {
      // Versi baru belum siap — kasih warning
      console.warn(
        '%c[SDLG WARNING]%c Input Helper v18 stub aktif, tapi sdlg-input-helper-ux.js belum ke-load!',
        'background:#dc2626;color:white;padding:2px 6px;border-radius:4px;font-weight:700',
        'color:#dc2626;font-size:12px'
      );
    }
  }

  // 4. Sentinel Trap untuk method-method lama
  function createTrap(methodName) {
    return function () {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[SDLG Guardian] ⚠️ Kode usang memanggil InputHelper.' + methodName + '()\n' +
          'Implementasi asli ada di: modules/sdlg-input-helper-ux.js (V2.0)\n' +
          'Silakan update referensi di kode lama Anda.'
        );
      }
      // Return false biar kode lama gak error, cuma diem aja
      return false;
    };
  }

  // 5. Stub Object yang Immutable
  var Stub = Object.freeze({
    version: '2.0.0-guardian',
    deprecated: true,
    active: false,
    reason: 'Superseded by modules/sdlg-input-helper-ux.js (V2.0)',
    successor: 'SDLGInputHelperUX',
    
    // Traps
    init: createTrap('init'),
    run: createTrap('run'),
    apply: createTrap('apply'),
    hydrate: createTrap('hydrate'),
    refresh: createTrap('refresh'),
    copyText: createTrap('copyText'),
    
    // Informasi
    info: function () {
      return 'File ini deprecated. Gunakan window.SDLGInputHelperUX (V2.0).';
    }
  });

  // 6. Pasang ke Window (Read-Only, gak bisa di-delete)
  try {
    Object.defineProperty(root, 'SDLGInputHelper', {
      value: Stub,
      writable: false,
      configurable: false
    });
  } catch (_) {
    // Fallback kalau browser kuno / udah ada yang pasang duluan
    if (!root.SDLGInputHelper) {
      root.SDLGInputHelper = Stub;
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);