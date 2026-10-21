/**
 * SDLG Notifications — Sistem Notifikasi Terpusat V2.0 (Bulletproof)
 * 
 * FIX: 
 * ✅ Paksa z-index maksimal (gak bisa ketutup elemen lain)
 * ✅ Paksa opacity 1 (gak bakal transparan kalau animasi gagal)
 * ✅ Gak butuh Google Fonts (anti error CSP)
 * ✅ Ditempel langsung ke <html> biar gak kerusuh sama layout body
 */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;
  if (window.__SDLG_NOTIFY__) return;
  window.__SDLG_NOTIFY__ = true;

  var MAX_VISIBLE = 3;
  var AUTO_DISMISS = { success: 4000, info: 5000, warning: 0, error: 0 };

  var container = null;
  var queue = [];
  var visible = 0;

  // ═════════════════════════════════════════════════════════
  // SETUP DOM & STYLES
  // ═════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('sdlg-notify-styles')) return;
    var s = document.createElement('style');
    s.id = 'sdlg-notify-styles';
    s.textContent = [
      /* Container wajib nempel di pojok kanan atas, z-index maksimal */
      '#sdlg-notify-container{position:fixed!important;top:24px!important;right:24px!important;z-index:2147483647!important;display:flex!important;flex-direction:column!important;gap:12px!important;width:calc(100vw - 48px)!important;max-width:400px!important;pointer-events:none!important;}',
      
      /* Toast dasar: background putih, wajib opacity 1 */
      '.sdlg-toast{pointer-events:auto!important;background:#ffffff!important;border-radius:12px!important;border:1px solid #e2e8f0!important;border-left-width:4px!important;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1)!important;padding:16px!important;display:flex!important;gap:12px!important;align-items:flex-start!important;position:relative!important;overflow:hidden!important;opacity:1!important;visibility:visible!important;transform:translateX(0)!important;transition:all 0.3s cubic-bezier(0.16,1,0.3,1)!important;animation:sdlgSlideIn 0.4s cubic-bezier(0.16,1,0.3,1)!important;}',
      '@keyframes sdlgSlideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}',
      
      /* Varian Warna */
      '.sdlg-toast--error{border-left-color:#dc2626!important;}',
      '.sdlg-toast--warning{border-left-color:#d97706!important;}',
      '.sdlg-toast--success{border-left-color:#16a34a!important;}',
      '.sdlg-toast--info{border-left-color:#2f5bff!important;}',
      
      /* Ikon */
      '.sdlg-toast__icon{width:32px!important;height:32px!important;border-radius:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;color:#fff!important;font-size:16px!important;font-weight:900!important;line-height:1!important;font-family:sans-serif!important;}',
      '.sdlg-toast--error .sdlg-toast__icon{background:#dc2626!important;}',
      '.sdlg-toast--warning .sdlg-toast__icon{background:#d97706!important;}',
      '.sdlg-toast--success .sdlg-toast__icon{background:#16a34a!important;}',
      '.sdlg-toast--info .sdlg-toast__icon{background:#2f5bff!important;}',
      
      /* Teks */
      '.sdlg-toast__body{flex:1!important;min-width:0!important;font-family:inherit!important;}',
      '.sdlg-toast__title{font-size:13px!important;font-weight:800!important;color:#0f172a!important;margin-bottom:4px!important;line-height:1.3!important;}',
      '.sdlg-toast__msg{font-size:12px!important;color:#475569!important;line-height:1.5!important;word-break:break-word!important;}',
      
      /* Detail & Tombol */
      '.sdlg-toast__details{margin-top:8px!important;padding:8px 10px!important;background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:8px!important;font-family:monospace!important;font-size:10px!important;color:#64748b!important;max-height:120px!important;overflow-y:auto!important;display:none!important;}',
      '.sdlg-toast__details--open{display:block!important;}',
      '.sdlg-toast__actions{display:flex!important;gap:6px!important;margin-top:10px!important;}',
      '.sdlg-toast__btn{background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:6px!important;padding:5px 10px!important;font-size:11px!important;font-weight:700!important;color:#475569!important;cursor:pointer!important;font-family:inherit!important;}',
      '.sdlg-toast__btn:hover{background:#f1f5f9!important;color:#0f172a!important;}',
      '.sdlg-toast__close{background:transparent!important;border:none!important;padding:4px!important;cursor:pointer!important;color:#94a3b8!important;font-size:16px!important;line-height:1!important;}',
      '.sdlg-toast__close:hover{color:#0f172a!important;}',
      
      /* Animasi Keluar */
      '.sdlg-toast--closing{opacity:0!important;transform:translateX(40px)!important;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function ensureContainer() {
    if (container && container.parentNode) return container;
    container = document.getElementById('sdlg-notify-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sdlg-notify-container';
      // Tembak ke documentElement (<html>) biar gak bentrok sama body
      (document.documentElement || document.body).appendChild(container);
    }
    return container;
  }

  // ═════════════════════════════════════════════════════════
  // RENDER TOAST
  // ═════════════════════════════════════════════════════════
  var ICONS = { error: '!', warning: '!', success: '✓', info: 'i' };
  var TITLES = { error: 'Error', warning: 'Peringatan', success: 'Berhasil', info: 'Info' };

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function dismiss(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('sdlg-toast--closing');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      visible = Math.max(0, visible - 1);
      flushQueue();
    }, 300);
  }

  function renderToast(opts) {
    var type = opts.type || 'info';
    var title = opts.title || TITLES[type] || 'Notifikasi';
    var message = opts.message || '';
    var details = opts.details || '';
    var autoDismiss = opts.autoDismiss != null ? opts.autoDismiss : AUTO_DISMISS[type] || 0;

    var el = document.createElement('div');
    el.className = 'sdlg-toast sdlg-toast--' + type;
    
    var detailsHTML = details
      ? '<div class="sdlg-toast__details" data-details>' + escapeHTML(details) + '</div>' +
        '<div class="sdlg-toast__actions"><button class="sdlg-toast__btn" data-toggle-details>Lihat detail</button><button class="sdlg-toast__btn" data-copy>Salin</button></div>'
      : '';

    el.innerHTML =
      '<div class="sdlg-toast__icon">' + ICONS[type] + '</div>' +
      '<div class="sdlg-toast__body">' +
        '<div class="sdlg-toast__title">' + escapeHTML(title) + '</div>' +
        (message ? '<div class="sdlg-toast__msg">' + escapeHTML(message) + '</div>' : '') +
        detailsHTML +
      '</div>' +
      '<button class="sdlg-toast__close" aria-label="Tutup">✕</button>';

    // Event Listeners
    el.querySelector('.sdlg-toast__close').addEventListener('click', function () { dismiss(el); });

    var toggleBtn = el.querySelector('[data-toggle-details]');
    var detailsEl = el.querySelector('[data-details]');
    if (toggleBtn && detailsEl) {
      toggleBtn.addEventListener('click', function () {
        detailsEl.classList.toggle('sdlg-toast__details--open');
        toggleBtn.textContent = detailsEl.classList.contains('sdlg-toast__details--open') ? 'Sembunyikan' : 'Lihat detail';
      });
    }

    var copyBtn = el.querySelector('[data-copy]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = title + '\n' + message + (details ? '\n\n' + details : '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            copyBtn.textContent = '✓ Tersalin';
            setTimeout(function () { copyBtn.textContent = 'Salin'; }, 1500);
          });
        }
      });
    }

    if (autoDismiss > 0) {
      var timer = setTimeout(function () { dismiss(el); }, autoDismiss);
      el.addEventListener('mouseenter', function () { clearTimeout(timer); });
      el.addEventListener('mouseleave', function () { timer = setTimeout(function () { dismiss(el); }, 2000); });
    }

    return el;
  }

  // ═════════════════════════════════════════════════════════
  // QUEUE & SHOW
  // ═════════════════════════════════════════════════════════
  function render(opts) {
    var c = ensureContainer();
    c.appendChild(renderToast(opts));
    visible++;
  }

  function flushQueue() {
    while (visible < MAX_VISIBLE && queue.length > 0) {
      render(queue.shift());
    }
  }

  function show(opts) {
    injectStyles();
    ensureContainer();
    if (visible >= MAX_VISIBLE) queue.push(opts);
    else render(opts);
  }

  function makeTyped(type) {
    return function (titleOrOpts, message, details) {
      if (typeof titleOrOpts === 'object' && titleOrOpts) {
        show(Object.assign({ type: type }, titleOrOpts));
      } else {
        show({ type: type, title: titleOrOpts, message: message, details: details });
      }
    };
  }

  // ═════════════════════════════════════════════════════════
  // ERROR HANDLERS
  // ═════════════════════════════════════════════════════════
  var isHandling = false;
  window.addEventListener('error', function (event) {
    if (isHandling || (event.filename && /^(chrome|moz|safari)-extension:\/\//.test(event.filename))) return;
    isHandling = true;
    try { window.SDLGNotify.error('Ada yang salah', event.message || 'Terjadi kesalahan', event.error && event.error.stack); } catch (_) {}
    setTimeout(function () { isHandling = false; }, 300);
  });

  window.addEventListener('unhandledrejection', function (event) {
    if (isHandling || !event || !event.reason) return;
    var stack = (event.reason && event.reason.stack) || String(event.reason);
    if (/extension:\/\//.test(stack)) return;
    isHandling = true;
    try { window.SDLGNotify.error('Terjadi kesalahan', event.reason.message || 'Permintaan gagal', stack); } catch (_) {}
    setTimeout(function () { isHandling = false; }, 300);
  });

  // ═════════════════════════════════════════════════════════
  // EXPORT
  // ═════════════════════════════════════════════════════════
  injectStyles();
  window.SDLGNotify = {
    version: '2.0.0',
    show: show,
    error:   makeTyped('error'),
    warning: makeTyped('warning'),
    success: makeTyped('success'),
    info:    makeTyped('info'),
    clear: function () { queue = []; if (container) container.innerHTML = ''; visible = 0; }
  };
})();