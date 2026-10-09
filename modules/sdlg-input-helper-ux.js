/**
 * SDLG Input Helper — Copy Fix + UX patch v1.9.1 — strict page detection
 */
(function () {
  'use strict';
  if (window.__SDLG_COPY_FIX_191__) return;
  window.__SDLG_COPY_FIX_191__ = true;

  var ACTION_ID = 'sdlg-input-action-bar';
  var TOAST_ID = 'sdlg-input-toast';
  var ZERO_ID = 'sdlg-zero-amount-banner';

  function textOf(el) {
    if (!el) return '';
    try { return String(el.textContent || '').replace(/\s+/g, ' ').trim(); }
    catch (_) { return ''; }
  }

  function isEmptyDisplay(v) {
    var s = String(v == null ? '' : v).trim();
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || /^xxx+$/i.test(s);
  }

  function showToast(msg, kind) {
    kind = kind || 'ok';
    var el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      el.setAttribute('role', 'status');
      el.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;' +
        'box-shadow:0 8px 24px rgba(15,23,42,.18);pointer-events:none;' +
        'transition:opacity .2s;opacity:0';
      document.body.appendChild(el);
    }
    el.style.background = kind === 'err' ? '#b91c1c' : kind === 'warn' ? '#b45309' : '#047857';
    el.style.color = '#fff';
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(window.__sdlgToastTimer);
    window.__sdlgToastTimer = setTimeout(function () { el.style.opacity = '0'; }, 1800);
  }

  function fallbackCopy(t) {
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select(); ta.setSelectionRange(0, t.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) { return false; }
  }

  function copyText(text) {
    var t = String(text == null ? '' : text);
    if (!t || isEmptyDisplay(t)) {
      showToast('Tidak ada data untuk di-copy', 'warn');
      return Promise.resolve(false);
    }
    function ok() { showToast('Tersalin ke clipboard', 'ok'); return true; }
    function fail(r) {
      if (fallbackCopy(t)) { showToast('Tersalin (fallback)', 'ok'); return true; }
      showToast('Gagal copy — pilih teks manual', 'err');
      console.warn('[SDLG CopyFix]', r);
      return false;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        return navigator.clipboard.writeText(t).then(ok).catch(fail);
      }
    } catch (e) { return Promise.resolve(fail(e)); }
    return Promise.resolve(fail('no-api'));
  }

  function setBtnState(btn, state) {
    if (!btn) return;
    if (!btn.getAttribute('data-label-orig')) btn.setAttribute('data-label-orig', btn.textContent || 'Copy');
    if (state === 'ok') {
      btn.textContent = 'Copied';
      btn.disabled = false;
      setTimeout(function () { btn.textContent = btn.getAttribute('data-label-orig'); }, 1200);
    } else if (state === 'empty') {
      btn.textContent = 'Kosong';
      btn.disabled = true;
      btn.title = 'Tidak ada data';
      btn.style.opacity = '0.55';
      btn.style.cursor = 'not-allowed';
    } else if (state === 'err') {
      btn.textContent = 'Gagal';
      setTimeout(function () { btn.textContent = btn.getAttribute('data-label-orig'); }, 1400);
    }
  }

  function isHelperPage() {
    var page = document.querySelector('.page');
    if (!page) return false;
    var t = textOf(page.querySelector('.page-title')).toLowerCase();
    if (/warranty claim input helper|sdlg input helper/.test(t)) return true;
    if (/warranty claim input helper/i.test(textOf(page).slice(0, 400))) return true;
    try {
      if (window.SDLGHashRouter && window.SDLGHashRouter.parse) {
        var r = window.SDLGHashRouter.parse();
        if (r && (r.page === 'sdlg-input' || (r.page === 'claim' && r.subTab === 'input'))) return true;
      }
      var h = String(location.hash || '');
      if (/#\/?sdlg-input/i.test(h) || /#\/?claim\/[^/]+\/input/i.test(h) || /#\/?sdlginput/i.test(h)) return true;
    } catch (_) {}
    return false;
  }

  function hardenButtons(page) {
    page.querySelectorAll('[data-sdlg-field]').forEach(function (field) {
      var wrap = field.closest('div') || field.parentElement;
      if (!wrap) return;
      wrap.querySelectorAll('button').forEach(function (btn) {
        if (btn.getAttribute('data-sdlg-copy-hard') === '1') return;
        var label = (btn.textContent || '').trim();
        if (!/^Copy$/i.test(label) && !/^Copied$/i.test(label) && !/^Kosong$/i.test(label)) return;
        btn.setAttribute('data-sdlg-copy-hard', '1');
        var val = String(field.value || '').trim();
        if (isEmptyDisplay(val)) { setBtnState(btn, 'empty'); return; }
        btn.addEventListener('click', function (e) {
          var current = String(field.value || '').trim();
          if (isEmptyDisplay(current)) {
            e.preventDefault(); e.stopPropagation();
            setBtnState(btn, 'empty');
            showToast('Field ini kosong', 'warn');
            return;
          }
          copyText(current).then(function (ok) { setBtnState(btn, ok ? 'ok' : 'err'); });
        }, true);
      });
    });

    page.querySelectorAll('button').forEach(function (btn) {
      var t = (btn.textContent || '').trim();
      if (/Copy Nama Report/i.test(t) && btn.getAttribute('data-sdlg-report-hard') !== '1') {
        btn.setAttribute('data-sdlg-report-hard', '1');
        btn.addEventListener('click', function () {
          var el = page.querySelector('[data-sdlg-copy-report-name], [data-value]');
          var v = el ? (el.getAttribute('data-value') || textOf(el)) : '';
          if (isEmptyDisplay(v)) {
            var code = page.querySelector('code, pre');
            if (code) v = textOf(code);
          }
          copyText(v).then(function (ok) { setBtnState(btn, ok ? 'ok' : 'err'); });
        }, true);
      }
    });
  }

  function ensureActionBar() {
    var old = document.getElementById(ACTION_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function ensureZeroBanner(page) {
    var existing = document.getElementById(ZERO_ID);
    var bodyText = textOf(page);
    var looksZero = /Total Amount Claimed[\s\S]{0,40}\b0\b/i.test(bodyText);
    if (!looksZero) { if (existing) existing.remove(); return; }
    if (existing) return;
    var banner = document.createElement('div');
    banner.id = ZERO_ID;
    banner.style.cssText =
      'margin:12px 0;padding:12px 14px;border:1px solid #f59e0b;border-radius:8px;' +
      'background:#fffbeb;color:#92400e;font-size:13px;line-height:1.45';
    banner.innerHTML =
      '<b>\u26a0 Amount masih 0</b> \u2014 Labour / Mileage / Other / Total kosong di data claim. ' +
      'Harus diisi <b>manual</b> di Dealer Portal.';
    var nodes = page.querySelectorAll('div, h2, h3, strong, span');
    for (var i = 0; i < nodes.length; i++) {
      if (/Other Cost Details/i.test(textOf(nodes[i]))) {
        nodes[i].parentNode.insertBefore(banner, nodes[i].nextSibling);
        return;
      }
    }
    page.appendChild(banner);
  }

  function run() {
    var page = document.querySelector('.page');
    if (!isHelperPage()) {
      if (page && page.getAttribute('data-sdlg-input-helper') === '1') {
        var t = textOf(page.querySelector('.page-title')).toLowerCase();
        if (!/warranty claim input helper|sdlg input helper/.test(t)) page.removeAttribute('data-sdlg-input-helper');
      }
      return;
    }
    if (!page) return;
    page.setAttribute('data-sdlg-input-helper', '1');
    hardenButtons(page);
    ensureActionBar();
    ensureZeroBanner(page);
  }

  function boot() {
    run();
    var obs = new MutationObserver(function () {
      clearTimeout(window.__sdlgCopyFixTimer);
      window.__sdlgCopyFixTimer = setTimeout(run, 250);
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    document.addEventListener('click', function () {
      setTimeout(run, 200);
      setTimeout(run, 600);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SDLGInputCopyFix = { version: '1.9.1', refresh: run, copyText: copyText };
  window.SDLGInputHelperUX = { version: '1.9.1', refresh: run, copyText: copyText };
})();
