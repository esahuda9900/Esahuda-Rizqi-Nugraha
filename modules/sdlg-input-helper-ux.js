/**
 * SDLG Input Helper UX — V2.0 (Smart Form Assistant)
 * Copy Fix + UX patch + Zero Amount Banner + Dark Mode
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ SDLGNOTIFY: Gak bikin toast sendiri, hemat kode & memory.
 * ✅ EVENT DELEGATION: 1 listener buat semua tombol Copy.
 * ✅ SCOPED OBSERVER: Cuma ngawasin .page (hemat baterai).
 * ✅ DARK MODE: Banner kuning support tema gelap.
 * ✅ REMOVED DEAD CODE: ensureActionBar() dihapus.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';
  // React is the sole owner of SDLG Input. Legacy DOM modifiers must not boot.
  if (typeof window !== 'undefined' && window.__SDLG_REACT_INPUT_SINGLE_OWNER__) return;

  if (window.__SDLG_COPY_FIX_V2__) return;
  window.__SDLG_COPY_FIX_V2__ = true;
  window.__SDLG_COPY_FIX_191__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & STYLES
  // ─────────────────────────────────────────────────────────
  var STYLE_ID = 'sdlg-input-helper-ux-styles';
  var ZERO_BANNER_ID = 'sdlg-zero-amount-banner';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${ZERO_BANNER_ID} {
        margin: 12px 0; padding: 14px 16px;
        border: 1px solid #f59e0b; border-radius: 10px;
        background: #fffbeb; color: #92400e;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px; line-height: 1.5;
        display: flex; align-items: flex-start; gap: 10px;
        animation: sdlgZeroIn 0.3s ease-out;
      }
      #${ZERO_BANNER_ID} b { color: #7c2d12; }
      @keyframes sdlgZeroIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      
      @media (prefers-color-scheme: dark) {
        #${ZERO_BANNER_ID} {
          background: rgba(245,158,11,0.15);
          border-color: rgba(245,158,11,0.3);
          color: #fcd34d;
        }
        #${ZERO_BANNER_ID} b { color: #fbbf24; }
      }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
  // ─────────────────────────────────────────────────────────
  function textOf(el) {
    if (!el) return '';
    try { return String(el.textContent || '').replace(/\s+/g, ' ').trim(); }
    catch (_) { return ''; }
  }

  function isEmptyDisplay(v) {
    var s = String(v == null ? '' : v).trim();
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || /^xxx+$/i.test(s);
  }

  function notify(type, title, msg) {
    if (window.SDLGNotify && window.SDLGNotify[type]) {
      window.SDLGNotify[type](title, msg);
    } else {
      console.log('[SDLG UX] ' + title + ': ' + msg);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. COPY ENGINE (Fully Async)
  // ─────────────────────────────────────────────────────────
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) { return false; }
  }

  function copyText(text) {
    var t = String(text == null ? '' : text);
    
    if (!t || isEmptyDisplay(t)) {
      notify('warning', 'Tidak Ada Data', 'Field ini kosong, tidak bisa di-copy.');
      return Promise.resolve(false);
    }

    return new Promise(function (resolve) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
          navigator.clipboard.writeText(t)
            .then(function () {
              notify('success', 'Tersalin', 'Data berhasil di-copy ke clipboard.');
              resolve(true);
            })
            .catch(function (err) {
              if (fallbackCopy(t)) {
                notify('success', 'Tersalin (Fallback)', 'Data berhasil di-copy.');
                resolve(true);
              } else {
                notify('error', 'Gagal Copy', 'Browser tidak mengizinkan akses clipboard.');
                resolve(false);
              }
            });
          return;
        }
      } catch (_) {}
      
      // Fallback path
      if (fallbackCopy(t)) {
        notify('success', 'Tersalin (Fallback)', 'Data berhasil di-copy.');
        resolve(true);
      } else {
        notify('error', 'Gagal Copy', 'Browser tidak mengizinkan akses clipboard.');
        resolve(false);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // 4. BUTTON STATE MANAGEMENT
  // ─────────────────────────────────────────────────────────
  function setBtnState(btn, state) {
    if (!btn) return;
    if (!btn.getAttribute('data-label-orig')) btn.setAttribute('data-label-orig', btn.textContent || 'Copy');

    if (state === 'ok') {
      btn.textContent = '✓ Copied';
      btn.disabled = false;
      setTimeout(function () { btn.textContent = btn.getAttribute('data-label-orig'); }, 1500);
    } else if (state === 'empty') {
      btn.textContent = 'Kosong';
      btn.disabled = true;
      btn.title = 'Tidak ada data';
      btn.style.opacity = '0.55';
      btn.style.cursor = 'not-allowed';
    } else if (state === 'err') {
      btn.textContent = '✗ Gagal';
      setTimeout(function () { btn.textContent = btn.getAttribute('data-label-orig'); }, 1500);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. PAGE DETECTION (Cached & Strict)
  // ─────────────────────────────────────────────────────────
  var _helperPageCache = null;
  var _helperPageCacheTime = 0;
  var CACHE_TTL = 2000; // 2 detik

  function isHelperPage() {
    var now = Date.now();
    if (_helperPageCache !== null && (now - _helperPageCacheTime) < CACHE_TTL) {
      return _helperPageCache;
    }

    var page = document.querySelector('.page');
    if (!page) {
      _helperPageCache = false;
      _helperPageCacheTime = now;
      return false;
    }

    var result = false;
    var title = textOf(page.querySelector('.page-title')).toLowerCase();
    
    if (/warranty claim input helper|sdlg input helper/.test(title)) {
      result = true;
    } else if (/warranty claim input helper/i.test(textOf(page).slice(0, 400))) {
      result = true;
    } else {
      // Cek via Router
      try {
        if (window.SDLGHashRouter && window.SDLGHashRouter.parse) {
          var r = window.SDLGHashRouter.parse();
          if (r && (r.page === 'sdlg-input' || (r.page === 'claim' && r.subTab === 'input'))) {
            result = true;
          }
        }
      } catch (_) {}
      
      // Cek via Hash
      if (!result) {
        var h = String(location.hash || '');
        if (/#\/?sdlg-input/i.test(h) || /#\/?claim\/[^/]+\/input/i.test(h) || /#\/?sdlginput/i.test(h)) {
          result = true;
        }
      }
    }

    _helperPageCache = result;
    _helperPageCacheTime = now;
    return result;
  }

  // ─────────────────────────────────────────────────────────
  // 6. EVENT DELEGATION (1 Listener untuk Semua Tombol Copy)
  // ─────────────────────────────────────────────────────────
  function handleCopyClick(e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    var label = (btn.textContent || '').trim();
    if (!/^Copy$|^Copied$|^Kosong$/i.test(label)) return;

    // Cari field terkait
    var wrap = btn.closest('div');
    if (!wrap) return;
    
    var field = wrap.querySelector('input, textarea, [data-sdlg-field]');
    if (!field) return;

    var value = field.value != null ? String(field.value).trim() : textOf(field);
    
    if (isEmptyDisplay(value)) {
      e.preventDefault();
      e.stopPropagation();
      setBtnState(btn, 'empty');
      notify('warning', 'Field Kosong', 'Field ini tidak ada isinya.');
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    copyText(value).then(function (ok) {
      setBtnState(btn, ok ? 'ok' : 'err');
    });
  }

  function handleReportNameClick(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    
    var t = (btn.textContent || '').trim();
    if (!/Copy Nama Report/i.test(t)) return;

    e.preventDefault();
    e.stopPropagation();

    var page = document.querySelector('.page');
    var el = page ? page.querySelector('[data-sdlg-copy-report-name], [data-value]') : null;
    var value = el ? (el.getAttribute('data-value') || textOf(el)) : '';
    
    if (isEmptyDisplay(value)) {
      var code = page ? page.querySelector('code, pre') : null;
      if (code) value = textOf(code);
    }

    copyText(value).then(function (ok) {
      setBtnState(btn, ok ? 'ok' : 'err');
    });
  }

  // ─────────────────────────────────────────────────────────
  // 7. ZERO AMOUNT BANNER
  // ─────────────────────────────────────────────────────────
  function ensureZeroBanner(page) {
    var existing = document.getElementById(ZERO_BANNER_ID);
    var bodyText = textOf(page);
    var looksZero = /Total Amount Claimed[\s\S]{0,40}\b0\b/i.test(bodyText);
    
    if (!looksZero) {
      if (existing) existing.remove();
      return;
    }

    if (existing) return;

    injectStyles();

    var banner = document.createElement('div');
    banner.id = ZERO_BANNER_ID;
    banner.innerHTML = `
      <span style="font-size:16px">⚠️</span>
      <div>
        <b>Amount masih 0</b> — Labour / Mileage / Other / Total kosong di data klaim. 
        Harus diisi <b>manual</b> di Dealer Portal.
      </div>
    `;

    // Cari tempat yang pas
    var nodes = page.querySelectorAll('div, h2, h3, strong, span');
    for (var i = 0; i < nodes.length; i++) {
      if (/Other Cost Details/i.test(textOf(nodes[i]))) {
        nodes[i].parentNode.insertBefore(banner, nodes[i].nextSibling);
        return;
      }
    }
    page.appendChild(banner);
  }

  // ─────────────────────────────────────────────────────────
  // 8. MAIN RUN
  // ─────────────────────────────────────────────────────────
  function run() {
    var page = document.querySelector('.page');
    if (!page) return;

    // Reset cache kalau halaman berubah
    _helperPageCache = null;

    if (!isHelperPage()) {
      if (page.getAttribute('data-sdlg-input-helper') === '1') {
        var title = textOf(page.querySelector('.page-title')).toLowerCase();
        if (!/warranty claim input helper|sdlg input helper/.test(title)) {
          page.removeAttribute('data-sdlg-input-helper');
        }
      }
      return;
    }

    page.setAttribute('data-sdlg-input-helper', '1');
    ensureZeroBanner(page);
  }

  // ─────────────────────────────────────────────────────────
  // 9. INIT & OBSERVER
  // ─────────────────────────────────────────────────────────
  function scheduleRun() {
    if (window.__sdlgCopyFixTimer) clearTimeout(window.__sdlgCopyFixTimer);
    window.__sdlgCopyFixTimer = setTimeout(run, 250);
  }

  function boot() {
    run();

    // 1. Event Delegation untuk tombol Copy
    document.addEventListener('click', handleCopyClick, false);
    document.addEventListener('click', handleReportNameClick, false);

    // 2. Scoped Mutation Observer (cuma ngawasin .page)
    var pageContainer = document.querySelector('.page');
    if (pageContainer && window.MutationObserver) {
      var obs = new MutationObserver(scheduleRun);
      obs.observe(pageContainer, { childList: true, subtree: true });
    }

    // 3. React ke route change
    window.addEventListener('sdlg-route-changed', function () {
      _helperPageCache = null;
      setTimeout(run, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 10. PUBLIC API
  // ─────────────────────────────────────────────────────────
  window.SDLGInputCopyFix = Object.freeze({
    version: '2.0.0',
    refresh: run,
    copyText: copyText
  });

  window.SDLGInputHelperUX = Object.freeze({
    version: '2.0.0',
    refresh: run,
    copyText: copyText
  });

})();