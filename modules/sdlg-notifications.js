/**
 * SDLG Notifications — Sistem Notifikasi Terpusat V1.0
 * 
 * Semua error JS + manual notification muncul di web (bukan Console).
 * User gak perlu buka DevTools.
 * 
 * CARA PAKAI (di file mana aja):
 *   SDLGNotify.error('Judul', 'Pesan', 'detail opsional')
 *   SDLGNotify.warning('Judul', 'Pesan')
 *   SDLGNotify.success('Judul', 'Pesan')
 *   SDLGNotify.info('Judul', 'Pesan')
 * 
 * Global error handler: otomatis aktif — semua error JS muncul di web.
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
  // SETUP DOM
  // ═════════════════════════════════════════════════════════
  function ensureContainer() {
    if (container && container.parentNode) return container;

    container = document.getElementById('sdlg-notify-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sdlg-notify-container';
      container.style.cssText =
        'position:fixed;top:20px;right:20px;z-index:2147483647;' +
        'display:flex;flex-direction:column;gap:12px;' +
        'width:min(420px,calc(100vw - 32px));pointer-events:none;' +
        'font-family:"Plus Jakarta Sans",-apple-system,BlinkMacSystemFont,sans-serif';
    }

    var append = function () {
      if (!container.parentNode) document.body.appendChild(container);
    };
    if (document.body) append();
    else document.addEventListener('DOMContentLoaded', append, { once: true });

    return container;
  }

  function injectStyles() {
    if (document.getElementById('sdlg-notify-styles')) return;
    var s = document.createElement('style');
    s.id = 'sdlg-notify-styles';
    s.textContent = [
      '@keyframes sdlgToastIn{from{opacity:0;transform:translateX(40px) scale(.95)}to{opacity:1;transform:translateX(0) scale(1)}}',
      '@keyframes sdlgToastOut{to{opacity:0;transform:translateX(40px) scale(.95)}}',
      '.sdlg-toast{pointer-events:auto;background:#fff;border-radius:14px;border:1px solid #e2e8f0;border-left-width:4px;box-shadow:0 20px 40px -10px rgba(15,23,42,.15);padding:14px 16px;display:flex;gap:12px;align-items:flex-start;animation:sdlgToastIn .3s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden;font-family:inherit}',
      '.sdlg-toast--closing{animation:sdlgToastOut .25s ease forwards}',
      '.sdlg-toast--error{border-left-color:#dc2626}',
      '.sdlg-toast--warning{border-left-color:#d97706}',
      '.sdlg-toast--success{border-left-color:#16a34a}',
      '.sdlg-toast--info{border-left-color:#2f5bff}',
      '.sdlg-toast__icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:16px;font-weight:900;line-height:1}',
      '.sdlg-toast--error .sdlg-toast__icon{background:#dc2626}',
      '.sdlg-toast--warning .sdlg-toast__icon{background:#d97706}',
      '.sdlg-toast--success .sdlg-toast__icon{background:#16a34a}',
      '.sdlg-toast--info .sdlg-toast__icon{background:#2f5bff}',
      '.sdlg-toast__body{flex:1;min-width:0}',
      '.sdlg-toast__title{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:3px;line-height:1.3}',
      '.sdlg-toast__msg{font-size:12px;color:#475569;line-height:1.5;word-break:break-word}',
      '.sdlg-toast__details{margin-top:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-family:"SF Mono",Monaco,monospace;font-size:10px;color:#64748b;max-height:120px;overflow-y:auto;word-break:break-all;display:none}',
      '.sdlg-toast__details--open{display:block}',
      '.sdlg-toast__actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}',
      '.sdlg-toast__btn{background:transparent;border:1px solid #e2e8f0;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit;transition:all .15s}',
      '.sdlg-toast__btn:hover{background:#f1f5f9;color:#0f172a;border-color:#cbd5e1}',
      '.sdlg-toast__close{background:transparent;border:none;padding:4px;cursor:pointer;color:#94a3b8;font-size:16px;line-height:1;flex-shrink:0}',
      '.sdlg-toast__close:hover{color:#0f172a}',
      '.sdlg-toast__progress{position:absolute;bottom:0;left:0;height:3px;background:#0f172a;opacity:.15;animation:sdlgProgress linear forwards}',
      '@keyframes sdlgProgress{from{width:100%}to{width:0%}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═════════════════════════════════════════════════════════
  // RENDER TOAST
  // ═════════════════════════════════════════════════════════
  var ICONS = { error: '!', warning: '!', success: '✓', info: 'i' };
  var TITLES = { error: 'Error', warning: 'Peringatan', success: 'Berhasil', info: 'Info' };

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function dismiss(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('sdlg-toast--closing');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      visible = Math.max(0, visible - 1);
      flushQueue();
    }, 260);
  }

  function renderToast(opts) {
    var type = opts.type || 'info';
    var title = opts.title || TITLES[type] || 'Notifikasi';
    var message = opts.message || '';
    var details = opts.details || '';
    var autoDismiss = opts.autoDismiss != null ? opts.autoDismiss : AUTO_DISMISS[type] || 0;

    var el = document.createElement('div');
    el.className = 'sdlg-toast sdlg-toast--' + type;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    var detailsHTML = details
      ? '<div class="sdlg-toast__details" data-details>' + escapeHTML(details) + '</div>' +
        '<div class="sdlg-toast__actions">' +
          '<button class="sdlg-toast__btn" data-toggle-details>Lihat detail</button>' +
          '<button class="sdlg-toast__btn" data-copy>Salin</button>' +
        '</div>'
      : '';

    el.innerHTML =
      '<div class="sdlg-toast__icon">' + ICONS[type] + '</div>' +
      '<div class="sdlg-toast__body">' +
        '<div class="sdlg-toast__title">' + escapeHTML(title) + '</div>' +
        (message ? '<div class="sdlg-toast__msg">' + escapeHTML(message) + '</div>' : '') +
        detailsHTML +
      '</div>' +
      '<button class="sdlg-toast__close" aria-label="Tutup">✕</button>' +
      (autoDismiss > 0 ? '<div class="sdlg-toast__progress" style="animation-duration:' + autoDismiss + 'ms"></div>' : '');

    // Tombol tutup
    el.querySelector('.sdlg-toast__close').addEventListener('click', function () { dismiss(el); });

    // Tombol lihat detail
    var toggleBtn = el.querySelector('[data-toggle-details]');
    var detailsEl = el.querySelector('[data-details]');
    if (toggleBtn && detailsEl) {
      toggleBtn.addEventListener('click', function () {
        var open = detailsEl.classList.toggle('sdlg-toast__details--open');
        toggleBtn.textContent = open ? 'Sembunyikan' : 'Lihat detail';
      });
    }

    // Tombol salin
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

    // Auto-dismiss (hover pause)
    if (autoDismiss > 0) {
      var timer = setTimeout(function () { dismiss(el); }, autoDismiss);
      el.addEventListener('mouseenter', function () { clearTimeout(timer); });
      el.addEventListener('mouseleave', function () {
        timer = setTimeout(function () { dismiss(el); }, 2000);
      });
    }

    return el;
  }

  // ═════════════════════════════════════════════════════════
  // QUEUE
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

  // ═════════════════════════════════════════════════════════
  // PUBLIC API
  // ═════════════════════════════════════════════════════════
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
  // GLOBAL ERROR HANDLERS — tangkap SEMUA error JS
  // ═════════════════════════════════════════════════════════
  var isHandling = false;

  window.addEventListener('error', function (event) {
    if (isHandling) return;
    // Abaikan error dari extension browser
    if (event.filename && /^(chrome|moz|safari)-extension:\/\//.test(event.filename)) return;

    isHandling = true;
    try {
      var msg = event.message || 'Terjadi kesalahan tidak terduga';
      var loc = event.filename ? event.filename + ':' + event.lineno : '';
      var stack = event.error && event.error.stack ? event.error.stack : loc;

      window.SDLGNotify.error(
        'Ada yang salah',
        msg,
        stack
      );
    } catch (_) { /* ignore */ }
    setTimeout(function () { isHandling = false; }, 300);
  });

  window.addEventListener('unhandledrejection', function (event) {
    if (isHandling) return;
    if (!event || !event.reason) return;

    var reason = event.reason;
    var stack = (reason && reason.stack) || String(reason);
    if (/extension:\/\//.test(stack)) return;

    isHandling = true;
    try {
      var msg = typeof reason === 'string' ? reason : (reason.message || 'Permintaan gagal');
      window.SDLGNotify.error(
        'Terjadi kesalahan',
        msg,
        stack
      );
    } catch (_) { /* ignore */ }
    setTimeout(function () { isHandling = false; }, 300);
  });

  // ═════════════════════════════════════════════════════════
  // EXPORT
  // ═════════════════════════════════════════════════════════
  injectStyles();
  window.SDLGNotify = {
    version: '1.0.0',
    show: show,
    error:   makeTyped('error'),
    warning: makeTyped('warning'),
    success: makeTyped('success'),
    info:    makeTyped('info'),
    clear: function () {
      queue = [];
      if (container) container.innerHTML = '';
      visible = 0;
    }
  };
})();