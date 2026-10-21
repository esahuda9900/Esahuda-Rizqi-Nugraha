/**
 * Phase C bridge — load flat core modules.
 * Base-path aware for GitHub Project Pages (/Esahuda-Rizqi-Nugraha/) and Cloudflare root (/).
 * 
 * V2.0: + Banner error UI kalau ada modul gagal dimuat
 *       + Tombol "Coba Lagi" tanpa refresh
 *       + Tombol "Tutup" biar user bisa dismiss
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  if (window.__SDLG_CORE_BRIDGE__) return;
  window.__SDLG_CORE_BRIDGE__ = true;

  // ═════════════════════════════════════════════════════════
  // Daftar file (dengan path yang benar untuk project lu)
  // ═════════════════════════════════════════════════════════
  var FILES = [
    { src: 'modules/sdlg-core-constants.js', marker: 'data-sdlg-core-constants', name: 'Constants' },
    { src: 'modules/sdlg-core-date.js',      marker: 'data-sdlg-core-date',      name: 'Date Utils' },
    { src: 'modules/sdlg-core-currency.js',  marker: 'data-sdlg-core-currency',  name: 'Currency' }
  ];

  var failures = [];

  // ═════════════════════════════════════════════════════════
  // Path resolver — INI WAJIB, jangan dihapus!
  // Biar jalan di GitHub Pages maupun Cloudflare
  // ═════════════════════════════════════════════════════════
  function resolvePath(rel) {
    rel = String(rel || '').replace(/^\//, '');
    try {
      var baseEl = document.querySelector('base[href]');
      if (baseEl && baseEl.href) {
        return new URL(rel, baseEl.href).href;
      }
    } catch (_) {}
    try {
      var path = String(location.pathname || '/');
      var parts = path.split('/').filter(Boolean);
      if (parts.length && parts[0].indexOf('.') < 0 && /github\.io$/i.test(location.hostname || '')) {
        return '/' + parts[0] + '/' + rel;
      }
    } catch (_) {}
    return './' + rel;
  }

  // ═════════════════════════════════════════════════════════
  // Tunggu body siap sebelum tampilkan banner
  // ═════════════════════════════════════════════════════════
  function whenBodyReady(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  // ═════════════════════════════════════════════════════════
  // 🎨 BANNER ERROR — muncul kalau ada file gagal
  // ═════════════════════════════════════════════════════════
  function showErrorBanner(failedModules) {
    var existing = document.getElementById('sdlg-core-error-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'sdlg-core-error-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');

    var listHTML = failedModules.map(function (m) {
      return '• <b>' + m.name + '</b>';
    }).join('<br>');

    banner.innerHTML =
      '<div style="' +
        'position:fixed;top:20px;right:20px;z-index:999999;max-width:420px;' +
        'background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);' +
        'border:1px solid #fecaca;border-left:4px solid #dc2626;' +
        'border-radius:14px;padding:16px 20px;' +
        'box-shadow:0 20px 40px -10px rgba(220,38,38,.25);' +
        'font-family:"Plus Jakarta Sans",-apple-system,sans-serif;' +
        'animation:sdlgSlideIn .35s cubic-bezier(.16,1,.3,1)' +
      '">' +
        '<div style="display:flex;align-items:flex-start;gap:12px">' +
          '<div style="' +
            'width:36px;height:36px;background:#dc2626;border-radius:10px;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
            'color:#fff;font-size:20px;font-weight:900;line-height:1' +
          '">!</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:14px;font-weight:800;color:#991b1b;margin-bottom:6px">' +
              'Modul Gagal Dimuat' +
            '</div>' +
            '<div style="font-size:12px;color:#7f1d1d;line-height:1.6;margin-bottom:14px;word-break:break-word">' +
              listHTML +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button id="sdlg-core-retry" style="' +
                'background:#dc2626;color:#fff;border:none;padding:8px 16px;' +
                'border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;' +
                'font-family:inherit;transition:background .2s' +
              '">↻ Coba Lagi</button>' +
              '<button id="sdlg-core-dismiss" style="' +
                'background:transparent;color:#991b1b;border:1px solid #fecaca;' +
                'padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;' +
                'cursor:pointer;font-family:inherit' +
              '">Tutup</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<style>@keyframes sdlgSlideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}</style>';

    whenBodyReady(function () {
      document.body.appendChild(banner);
    });

    // Tombol Tutup
    setTimeout(function () {
      var btnDismiss = document.getElementById('sdlg-core-dismiss');
      if (btnDismiss) btnDismiss.onclick = function () {
        banner.style.transition = 'opacity .3s, transform .3s';
        banner.style.opacity = '0';
        banner.style.transform = 'translateX(30px)';
        setTimeout(function () { banner.remove(); }, 300);
      };

      // Tombol Coba Lagi
      var btnRetry = document.getElementById('sdlg-core-retry');
      if (btnRetry) btnRetry.onclick = function () {
        banner.remove();
        FILES.forEach(function (m) {
          var old = document.querySelector('script[' + m.marker + ']');
          if (old) old.remove();
        });
        failures = [];
        loadAll();
      };
    }, 50);

    // Auto-hilang setelah 12 detik
    setTimeout(function () {
      if (banner.parentNode) {
        banner.style.transition = 'opacity .3s';
        banner.style.opacity = '0';
        setTimeout(function () { if (banner.parentNode) banner.remove(); }, 300);
      }
    }, 12000);
  }

  // ═════════════════════════════════════════════════════════
  // 🔧 LOAD SATU MODUL
  // ═════════════════════════════════════════════════════════
  function loadModule(mod, done) {
    if (document.querySelector('script[' + mod.marker + ']')) return done(null);

    var s = document.createElement('script');
    s.src = resolvePath(mod.src);  // ← PENTING: pakai resolvePath!
    s.async = false;
    s.setAttribute(mod.marker, '1');

    s.onload = function () { done(null); };
    s.onerror = function () {
      s.remove();
      done(mod);
    };

    (document.head || document.documentElement).appendChild(s);
  }

  // ═════════════════════════════════════════════════════════
  // 🔁 LOAD SEMUA FILE (berurutan)
  // ═════════════════════════════════════════════════════════
  function loadAll() {
    var i = 0;
    function next() {
      if (i >= FILES.length) {
        if (failures.length > 0) {
          showErrorBanner(failures);
          window.dispatchEvent(new CustomEvent('sdlg-core-error', { detail: failures }));
        } else {
          window.dispatchEvent(new CustomEvent('sdlg-core-ready'));
        }
        return;
      }
      var mod = FILES[i++];
      loadModule(mod, function (failed) {
        if (failed) failures.push(failed);
        next();
      });
    }
    next();
  }

  loadAll();

  // ═════════════════════════════════════════════════════════
  // 📡 PUBLIC API
  // ═════════════════════════════════════════════════════════
  window.SDLGCore = {
    version: '2.0.0-phase-c-basepath',
    ready: function () {
      return !!(window.SDLGCoreDate && window.SDLGCoreCurrency && window.SDLGCoreConstants);
    },
    showError: function (mods) { showErrorBanner(mods || failures); }
  };
})();