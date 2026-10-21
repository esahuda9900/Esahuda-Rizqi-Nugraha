/**
 * SDLG App Bootloader — V2.0 (Smart Orchestrator)
 * 
 * ═══════════════════════════════════════════════════════════
 * TUGAS FILE INI:
 * ✅ Nunggu DOM & Modul Core siap.
 * ✅ Ngecek kesehatan sistem (Preflight Check).
 * ✅ Nampilin error ke web (via SDLGNotify) kalau boot gagal.
 * ✅ Ngukur performa loading.
 * ✅ Nembak event 'sdlg-app-ready' buat kode lain.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  
  var BOOT_START_TIME = performance.now();
  var HAS_BOOTED = false;

  // Utility: Lapor error ke web (bukan console)
  function reportError(title, msg, details) {
    if (window.SDLGNotify && window.SDLGNotify.error) {
      window.SDLGNotify.error(title, msg, details);
    } else {
      console.error('[BOOT FAILED] ' + title + ': ' + msg, details || '');
    }
  }

  // Utility: Nunggu sampai kondisi tertentu terpenuhi (polling ringan)
  function waitFor(conditionFn, timeoutMs, intervalMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function () {
        if (conditionFn()) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Timeout menunggu dependensi'));
        }
      }, intervalMs || 100);
    });
  }

  // ═════════════════════════════════════════════════════════
  // PROSES BOOTING UTAMA
  // ═════════════════════════════════════════════════════════
  async function boot() {
    if (HAS_BOOTED) return { ok: true, message: 'Already booted' };
    
    try {
      console.info('[SDLG Boot] Memulai proses booting...');

      // 1. Tunggu DOM siap
      if (document.readyState === 'loading') {
        await new Promise(function (resolve) {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // 2. Tunggu SDLGNotify siap (maksimal 3 detik)
      // Kalau gak siap, kita tetep lanjut tapi error gak bakal muncul di web.
      await waitFor(function () { return !!window.SDLGNotify; }, 3000, 50)
        .catch(function () { console.warn('[SDLG Boot] SDLGNotify lambat dimuat.'); });

      // 3. Tunggu Modul Core siap (constants, date, currency)
      // Kita pake API dari sdlg-core-bridge yang udah lu pasang
      if (window.SDLGCore && typeof window.SDLGCore.ready === 'function') {
        var coreReady = window.SDLGCore.ready();
        if (!coreReady) {
          console.info('[SDLG Boot] Menunggu Core modules...');
          await waitFor(function () { return window.SDLGCore.ready(); }, 10000, 200)
            .catch(function () {
              throw new Error('Modul Core (constants/date/currency) gagal dimuat dalam 10 detik.');
            });
        }
      }

      // 4. Cek Database Client (Supabase) - Opsional
      if (!window.sdlgSupabase) {
        console.warn('[SDLG Boot] sdlgSupabase belum siap, mungkin akan di-init belakangan.');
      }

      // ═════════════════════════════════════════════════════
      // SEMUA SIAP! 
      // ═════════════════════════════════════════════════════
      HAS_BOOTED = true;
      var bootTime = Math.round(performance.now() - BOOT_START_TIME);
      
      console.info('[SDLG Boot] ✅ Sistem siap dalam ' + bootTime + 'ms');
      
      // Nembak sinyal ke seluruh web kalau aplikasi udah siap
      window.dispatchEvent(new CustomEvent('sdlg-app-ready', { 
        detail: { bootTimeMs: bootTime } 
      }));

      return { ok: true, phase: 'ready', bootTimeMs: bootTime };

    } catch (err) {
      console.error('[SDLG Boot] ❌ Gagal:', err);
      
      // Tampilkan error di web biar user tau
      reportError(
        'Gagal Memuat Aplikasi',
        'Sistem tidak dapat dijalankan. Coba refresh halaman.',
        err.message + '\n' + (err.stack || '')
      );
      
      return { ok: false, error: err.message };
    }
  }

  // ═════════════════════════════════════════════════════════
  // EKSEKUSI
  // ═════════════════════════════════════════════════════════
  
  // Jalanin otomatis pas file ini di-load
  boot();

  // Expose API ke window biar bisa dipanggil manual kalau perlu
  window.SDLGBoot = Object.freeze({
    version: '2.0.0-smart',
    boot: boot, // Bisa dipanggil ulang manual kalau butuh
    isBooted: function () { return HAS_BOOTED; }
  });

})();