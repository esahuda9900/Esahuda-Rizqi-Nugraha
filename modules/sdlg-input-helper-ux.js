/**
 * SDLG Input Helper — Copy Fix + SWOT UX patch v1.8.1
 * Standalone progressive enhancement. Safe to load after core modules.
 * Fixes: clipboard silent fail, empty payload no-feedback, missing Copy All,
 * zero-amount warning, sticky action bar.
 */
(function () {
  'use strict';
  if (window.__SDLG_COPY_FIX_181__) return;
  window.__SDLG_COPY_FIX_181__ = true;

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
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, t.length);
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
      showToast('Gagal copy \u2014 pilih teks manual', 'err');
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
    return /input|helper|portal/.test(t) || page.getAttribute('data-sdlg-input-helper') === '1' ||
      /Warranty Claim Input Helper/i.test(textOf(page));
  }

  function collectPayloads(page) {
    var items = [];
    page.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
      var label = el.getAttribute('data-label') || '';
      var val = String(el.value || '').trim();
      if (label && !isEmptyDisplay(val)) items.push({ label: label, value: val });
    });
    page.querySelectorAll('[data-sdlg-extra-field]').forEach(function (wrap) {
      var label = wrap.getAttribute('data-sdlg-extra-field') || '';
      var box = wrap.querySelector('[data-copy-box]');
      var val = box ? textOf(box) : '';
      if (label && !isEmptyDisplay(val)) items.push({ label: label, value: val });
    });
    var report = page.querySelector('[data-sdlg-copy-report-name], [data-value]');
    if (report) {
      var rv = report.getAttribute('data-value') || textOf(report);
      if (!isEmptyDisplay(rv)) items.push({ label: 'Report Name', value: rv });
    }
    return items;
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
      if (/Copy All/i.test(t) && btn.getAttribute('data-sdlg-copy-all-hard') !== '1') {
        btn.setAttribute('data-sdlg-copy-all-hard', '1');
        btn.addEventListener('click', function (e) {
          var list = collectPayloads(page);
          if (!list.length) { e.preventDefault(); showToast('Tidak ada field siap copy', 'warn'); return; }
          var block = list.map(function (it) { return it.label + ':\n' + it.value; }).join('\n\n');
          copyText(block).then(function (ok) { setBtnState(btn, ok ? 'ok' : 'err'); });
        }, true);
      }
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

    page.querySelectorAll('[data-sdlg-extra-field] button').forEach(function (btn) {
      if (btn.getAttribute('data-sdlg-copy-hard') === '1') return;
      btn.setAttribute('data-sdlg-copy-hard', '1');
      var wrap = btn.closest('[data-sdlg-extra-field]');
      var box = wrap && wrap.querySelector('[data-copy-box]');
      var val = box ? textOf(box) : '';
      if (isEmptyDisplay(val)) { setBtnState(btn, 'empty'); return; }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var current = box ? textOf(box) : '';
        copyText(current).then(function (ok) { setBtnState(btn, ok ? 'ok' : 'err'); });
      }, true);
    });
  }

  function ensureActionBar(page) {
    if (!page.querySelector('[data-sdlg-field]')) {
      var old = document.getElementById(ACTION_ID);
      if (old) old.remove();
      return;
    }
    var items = collectPayloads(page);
    var bar = document.getElementById(ACTION_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = ACTION_ID;
      bar.style.cssText =
        'position:sticky;top:96px;z-index:24;display:flex;flex-wrap:wrap;align-items:center;gap:8px;' +
        'padding:10px 14px;margin:0 0 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;' +
        'box-shadow:0 1px 3px rgba(15,23,42,.06)';
      var sel = document.getElementById('sdlg-input-selected-bar');
      if (sel && sel.parentNode) sel.parentNode.insertBefore(bar, sel.nextSibling);
      else page.insertBefore(bar, page.firstChild);
    }
    var sig = String(items.length);
    if (bar.getAttribute('data-sig') === sig) return;
    bar.setAttribute('data-sig', sig);
    bar.innerHTML = '';

    var prog = document.createElement('span');
    prog.style.cssText = 'font-size:12px;color:#475569;font-weight:600';
    prog.textContent = items.length + ' field siap';
    bar.appendChild(prog);

    var bodyText = textOf(page);
    if (/Total Amount Claimed[\s\S]{0,40}\b0\b/i.test(bodyText) || /Labour Amount[\s\S]{0,20}\b0\b/i.test(bodyText)) {
      var warn = document.createElement('span');
      warn.style.cssText = 'font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e';
      warn.textContent = 'Amount = 0 \u2014 lengkapi di portal';
      bar.appendChild(warn);
    }

    var spacer = document.createElement('span');
    spacer.style.flex = '1';
    bar.appendChild(spacer);

    function mk(label, primary, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = primary ? 'primary-btn' : 'secondary-btn';
      b.textContent = label;
      b.style.cssText = 'min-height:34px;font-size:12px;font-weight:650;cursor:pointer';
      b.addEventListener('click', fn);
      return b;
    }

    bar.appendChild(mk('Copy All (Labeled)', false, function () {
      var list = collectPayloads(page);
      if (!list.length) { showToast('Tidak ada field siap copy', 'warn'); return; }
      copyText(list.map(function (it) { return it.label + ':\n' + it.value; }).join('\n\n'));
    }));
    bar.appendChild(mk('Copy All (TSV)', false, function () {
      var list = collectPayloads(page);
      if (!list.length) { showToast('Tidak ada field siap copy', 'warn'); return; }
      copyText('Label\tValue\n' + list.map(function (it) {
        return (it.label || '').replace(/\t/g, ' ') + '\t' + (it.value || '').replace(/\t|\n/g, ' ');
      }).join('\n'));
    }));
    bar.appendChild(mk('\u2197 Buka Dealer Portal', true, function () {
      window.open('https://dealer.sdlg.com', '_blank', 'noopener');
    }));
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
    if (!isHelperPage()) return;
    var page = document.querySelector('.page');
    if (!page) return;
    page.setAttribute('data-sdlg-input-helper', '1');
    hardenButtons(page);
    ensureActionBar(page);
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

  window.SDLGInputCopyFix = { version: '1.8.1', refresh: run, copyText: copyText };
  window.SDLGInputHelperUX = { version: '1.8.1', refresh: run, copyText: copyText };
})();
