/**
 * SDLG Notifications — V3.0 (Ultimate Notification Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ AUTO DARK MODE: Ngikutin tema sistem (prefers-color-scheme).
 * ✅ SMART TIMER: Pause on hover (resume dari sisa waktu).
 * ✅ PROGRESS BAR: Visual sisa waktu auto-dismiss.
 * ✅ KEYBOARD SUPPORT: Tekan Esc buat nutup toast aktif.
 * ✅ A11Y READY: role="alert", aria-live, tabindex.
 * ✅ EVENT DELEGATION: 1 listener buat semua tombol.
 * ✅ REDUCED MOTION: Hormati setting user.
 * ✅ IMMUTABLE API: Object.freeze().
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;
  if (window.__SDLG_NOTIFY_V3__) return;
  window.__SDLG_NOTIFY_V3__ = true;
  window.__SDLG_NOTIFY__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI
  // ─────────────────────────────────────────────────────────
  var MAX_VISIBLE = 3;
  var AUTO_DISMISS = { success: 4000, info: 5000, warning: 6000, error: 8000 };
  var CONTAINER_ID = 'sdlg-notify-container';
  var STYLE_ID = 'sdlg-notify-styles-v3';

  var container = null;
  var queue = [];
  var visibleToasts = [];
  var toastIdCounter = 0;

  // ─────────────────────────────────────────────────────────
  // 2. STYLES (Dark Mode + Progress Bar)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${CONTAINER_ID} {
        position: fixed !important; top: 24px !important; right: 24px !important;
        z-index: 2147483647 !important;
        display: flex !important; flex-direction: column !important; gap: 12px !important;
        width: calc(100vw - 48px) !important; max-width: 400px !important;
        pointer-events: none !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }

      .sdlg-toast {
        --toast-bg: #ffffff;
        --toast-border: #e2e8f0;
        --toast-text: #0f172a;
        --toast-text-muted: #475569;
        --toast-detail-bg: #f8fafc;
        --toast-detail-border: #e2e8f0;
        
        pointer-events: auto !important;
        background: var(--toast-bg) !important;
        border: 1px solid var(--toast-border) !important;
        border-left-width: 4px !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1) !important;
        padding: 16px !important;
        display: flex !important; gap: 12px !important; align-items: flex-start !important;
        position: relative !important; overflow: hidden !important;
        opacity: 1 !important; visibility: visible !important;
        transform: translateX(0) !important;
        animation: sdlgToastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      
      @media (prefers-color-scheme: dark) {
        .sdlg-toast {
          --toast-bg: #1e293b;
          --toast-border: #334155;
          --toast-text: #f8fafc;
          --toast-text-muted: #cbd5e1;
          --toast-detail-bg: #0f172a;
          --toast-detail-border: #334155;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4) !important;
        }
      }

      @keyframes sdlgToastIn {
        from { opacity: 0; transform: translateX(40px) scale(0.95); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes sdlgToastOut {
        to { opacity: 0; transform: translateX(40px) scale(0.95); }
      }
      @keyframes sdlgProgress {
        from { width: 100%; }
        to { width: 0%; }
      }

      .sdlg-toast--closing {
        animation: sdlgToastOut 0.3s ease forwards !important;
      }

      .sdlg-toast--error   { border-left-color: #dc2626 !important; }
      .sdlg-toast--warning { border-left-color: #d97706 !important; }
      .sdlg-toast--success { border-left-color: #16a34a !important; }
      .sdlg-toast--info    { border-left-color: #2f5bff !important; }

      .sdlg-toast__icon {
        width: 32px !important; height: 32px !important; border-radius: 8px !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        flex-shrink: 0 !important; color: #fff !important;
        font-size: 16px !important; font-weight: 900 !important; line-height: 1 !important;
      }
      .sdlg-toast--error .sdlg-toast__icon   { background: #dc2626 !important; }
      .sdlg-toast--warning .sdlg-toast__icon { background: #d97706 !important; }
      .sdlg-toast--success .sdlg-toast__icon { background: #16a34a !important; }
      .sdlg-toast--info .sdlg-toast__icon    { background: #2f5bff !important; }

      .sdlg-toast__body { flex: 1 !important; min-width: 0 !important; }
      .sdlg-toast__title { font-size: 13px !important; font-weight: 800 !important; color: var(--toast-text) !important; margin-bottom: 4px !important; line-height: 1.3 !important; }
      .sdlg-toast__msg { font-size: 12px !important; color: var(--toast-text-muted) !important; line-height: 1.5 !important; word-break: break-word !important; }

      .sdlg-toast__details {
        margin-top: 8px !important; padding: 8px 10px !important;
        background: var(--toast-detail-bg) !important; border: 1px solid var(--toast-detail-border) !important;
        border-radius: 8px !important; font-family: monospace !important; font-size: 10px !important;
        color: var(--toast-text-muted) !important; max-height: 120px !important; overflow-y: auto !important;
        display: none !important;
      }
      .sdlg-toast__details--open { display: block !important; }

      .sdlg-toast__actions { display: flex !important; gap: 6px !important; margin-top: 10px !important; }
      .sdlg-toast__btn {
        background: var(--toast-detail-bg) !important; border: 1px solid var(--toast-detail-border) !important;
        border-radius: 6px !important; padding: 5px 10px !important; font-size: 11px !important;
        font-weight: 700 !important; color: var(--toast-text-muted) !important; cursor: pointer !important;
        font-family: inherit !important; transition: all 0.15s !important;
      }
      .sdlg-toast__btn:hover { opacity: 0.8 !important; }
      .sdlg-toast__close {
        background: transparent !important; border: none !important; padding: 4px !important;
        cursor: pointer !important; color: var(--toast-text-muted) !important;
        font-size: 16px !important; line-height: 1 !important; opacity: 0.6 !important;
      }
      .sdlg-toast__close:hover { opacity: 1 !important; }

      .sdlg-toast__progress {
        position: absolute !important; bottom: 0 !important; left: 0 !important;
        height: 3px !important; background: rgba(0,0,0,0.1) !important;
      }
      @media (prefers-color-scheme: dark) {
        .sdlg-toast__progress { background: rgba(255,255,255,0.1) !important; }
      }
      .sdlg-toast--error   .sdlg-toast__progress { background: #dc2626 !important; }
      .sdlg-toast--warning .sdlg-toast__progress { background: #d97706 !important; }
      .sdlg-toast--success .sdlg-toast__progress { background: #16a34a !important; }
      .sdlg-toast--info    .sdlg-toast__progress { background: #2f5bff !important; }

      /* A11y: Reduce Motion */
      @media (prefers-reduced-motion: reduce) {
        .sdlg-toast, .sdlg-toast--closing, .sdlg-toast__progress { animation-duration: 0.01ms !important; }
      }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 3. CONTAINER SETUP
  // ─────────────────────────────────────────────────────────
  function ensureContainer() {
    if (container && container.parentNode) return container;
    container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Notifikasi');
    }
    
    var appendFn = function () {
      if (!container.parentNode) (document.body || document.documentElement).appendChild(container);
    };
    
    if (document.body) appendFn();
    else document.addEventListener('DOMContentLoaded', appendFn, { once: true });
    
    return container;
  }

  // ─────────────────────────────────────────────────────────
  // 4. ESCAPE HTML
  // ─────────────────────────────────────────────────────────
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─────────────────────────────────────────────────────────
  // 5. RENDER TOAST
  // ─────────────────────────────────────────────────────────
  var ICONS = { error: '!', warning: '!', success: '✓', info: 'i' };
  var TITLES = { error: 'Error', warning: 'Peringatan', success: 'Berhasil', info: 'Info' };

  function renderToast(opts) {
    var type = opts.type || 'info';
    var title = opts.title || TITLES[type] || 'Notifikasi';
    var message = opts.message || '';
    var details = opts.details || '';
    var autoDismiss = opts.autoDismiss != null ? opts.autoDismiss : (AUTO_DISMISS[type] || 5000);

    var id = ++toastIdCounter;
    var el = document.createElement('div');
    el.className = 'sdlg-toast sdlg-toast--' + type;
    el.setAttribute('data-toast-id', id);
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.setAttribute('tabindex', '0');

    var detailsHTML = details
      ? `<div class="sdlg-toast__details" data-details>${escapeHTML(details)}</div>
         <div class="sdlg-toast__actions">
           <button class="sdlg-toast__btn" data-action="toggle">Lihat detail</button>
           <button class="sdlg-toast__btn" data-action="copy">Salin</button>
         </div>`
      : '';

    el.innerHTML = `
      <div class="sdlg-toast__icon" aria-hidden="true">${ICONS[type]}</div>
      <div class="sdlg-toast__body">
        <div class="sdlg-toast__title">${escapeHTML(title)}</div>
        ${message ? `<div class="sdlg-toast__msg">${escapeHTML(message)}</div>` : ''}
        ${detailsHTML}
      </div>
      <button class="sdlg-toast__close" aria-label="Tutup notifikasi">✕</button>
      ${autoDismiss > 0 ? `<div class="sdlg-toast__progress" style="animation-duration:${autoDismiss}ms; animation-name:sdlgProgress; animation-timing-function:linear; animation-fill-mode:forwards;"></div>` : ''}
    `;

    // ─── Timer Logic (Smart Pause) ───
    var progressEl = el.querySelector('.sdlg-toast__progress');
    var timer = null;
    var remaining = autoDismiss;
    var startTime = Date.now();
    var isPaused = false;

    function startTimer() {
      if (remaining <= 0) return;
      startTime = Date.now();
      timer = setTimeout(function () { dismiss(id); }, remaining);
      if (progressEl) progressEl.style.animationPlayState = 'running';
    }

    function pauseTimer() {
      if (!timer || isPaused) return;
      clearTimeout(timer);
      remaining -= (Date.now() - startTime);
      isPaused = true;
      if (progressEl) progressEl.style.animationPlayState = 'paused';
    }

    function resumeTimer() {
      if (!isPaused) return;
      isPaused = false;
      startTimer();
    }

    if (autoDismiss > 0) {
      startTimer();
      el.addEventListener('mouseenter', pauseTimer);
      el.addEventListener('mouseleave', resumeTimer);
      el.addEventListener('focusin', pauseTimer);
      el.addEventListener('focusout', function (e) {
        if (!el.contains(e.relatedTarget)) resumeTimer();
      });
    }

    el.__sdlgDismiss = function () {
      clearTimeout(timer);
      el.removeEventListener('mouseenter', pauseTimer);
      el.removeEventListener('mouseleave', resumeTimer);
      el.classList.add('sdlg-toast--closing');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        visibleToasts = visibleToasts.filter(function (t) { return t.id !== id; });
        flushQueue();
      }, 300);
    };

    return el;
  }

  // ─────────────────────────────────────────────────────────
  // 6. DISMISS & QUEUE
  // ─────────────────────────────────────────────────────────
  function dismiss(id) {
    var toast = visibleToasts.find(function (t) { return t.id === id; });
    if (toast && toast.el.__sdlgDismiss) toast.el.__sdlgDismiss();
  }

  function flushQueue() {
    while (visibleToasts.length < MAX_VISIBLE && queue.length > 0) {
      render(queue.shift());
    }
  }

  function render(opts) {
    var c = ensureContainer();
    var el = renderToast(opts);
    c.appendChild(el);
    visibleToasts.push({ id: parseInt(el.getAttribute('data-toast-id'), 10), el: el });
  }

  function show(opts) {
    injectStyles();
    ensureContainer();
    if (visibleToasts.length >= MAX_VISIBLE) queue.push(opts);
    else render(opts);
  }

  // ─────────────────────────────────────────────────────────
  // 7. EVENT DELEGATION (1 Listener untuk Semua Toast)
  // ─────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    
    var toast = btn.closest('.sdlg-toast');
    if (!toast) return;
    
    var toastId = parseInt(toast.getAttribute('data-toast-id'), 10);
    var action = btn.getAttribute('data-action');

    // Close button
    if (btn.classList.contains('sdlg-toast__close')) {
      dismiss(toastId);
      return;
    }

    // Toggle details
    if (action === 'toggle') {
      var detailsEl = toast.querySelector('[data-details]');
      if (detailsEl) {
        var isOpen = detailsEl.classList.toggle('sdlg-toast__details--open');
        btn.textContent = isOpen ? 'Sembunyikan' : 'Lihat detail';
      }
      return;
    }

    // Copy
    if (action === 'copy') {
      var title = toast.querySelector('.sdlg-toast__title').textContent;
      var msg = toast.querySelector('.sdlg-toast__msg');
      var det = toast.querySelector('[data-details]');
      var text = title + (msg ? '\n' + msg.textContent : '') + (det ? '\n\n' + det.textContent : '');
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '✓ Tersalin';
          setTimeout(function () { btn.textContent = 'Salin'; }, 1500);
        });
      }
    }
  });

  // ─────────────────────────────────────────────────────────
  // 8. KEYBOARD SUPPORT (Esc to Dismiss)
  // ─────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!visibleToasts.length) return;
    
    // Dismiss the most recent toast
    var latest = visibleToasts[visibleToasts.length - 1];
    dismiss(latest.id);
  });

  // ─────────────────────────────────────────────────────────
  // 9. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  function makeTyped(type) {
    return function (titleOrOpts, message, details) {
      if (typeof titleOrOpts === 'object' && titleOrOpts) {
        show(Object.assign({ type: type }, titleOrOpts));
      } else {
        show({ type: type, title: titleOrOpts, message: message, details: details });
      }
    };
  }

  injectStyles();
  
  window.SDLGNotify = Object.freeze({
    version: '3.0.0',
    show: show,
    error:   makeTyped('error'),
    warning: makeTyped('warning'),
    success: makeTyped('success'),
    info:    makeTyped('info'),
    clear: function () {
      queue = [];
      visibleToasts.forEach(function (t) { if (t.el.parentNode) t.el.parentNode.removeChild(t.el); });
      visibleToasts = [];
    }
  });

  // ─────────────────────────────────────────────────────────
  // 10. GLOBAL ERROR HANDLERS
  // ─────────────────────────────────────────────────────────
  var isHandling = false;
  
  window.addEventListener('error', function (event) {
    if (isHandling || (event.filename && /^(chrome|moz|safari)-extension:\/\//.test(event.filename))) return;
    isHandling = true;
    try {
      window.SDLGNotify.error('Ada yang salah', event.message || 'Terjadi kesalahan', event.error && event.error.stack);
    } catch (_) {}
    setTimeout(function () { isHandling = false; }, 300);
  });

  window.addEventListener('unhandledrejection', function (event) {
    if (isHandling || !event || !event.reason) return;
    var stack = (event.reason && event.reason.stack) || String(event.reason);
    if (/extension:\/\//.test(stack)) return;
    isHandling = true;
    try {
      window.SDLGNotify.error('Terjadi kesalahan', event.reason.message || 'Permintaan gagal', stack);
    } catch (_) {}
    setTimeout(function () { isHandling = false; }, 300);
  });

})();