/**
 * Paste → Parse → Simpan UX polish (FINAL v2.2)
 * The Definitive Edition: Scoped DOM, Throttled Observer, Zero Console Spam.
 */
(function () {
  'use strict';

  var STYLE_ID = 'sdlg-paste-parse-ux-style';
  var FOOTER_ID = 'sdlg-parse-sticky-footer';
  var scheduled = false;
  var isRunning = false;
  var IS_DEBUG = window.location.search.indexOf('debug=true') > -1;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${FOOTER_ID}{
        position:fixed;left:0;right:0;bottom:0;z-index:9990;
        display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-wrap:wrap;
        padding:10px 16px;background:rgba(255,255,255,.96);
        border-top:1px solid #e2e8f0;box-shadow:0 -4px 20px rgba(15,23,42,.08);
        backdrop-filter:blur(8px);
      }
      body.sdlg-parse-sticky-pad{padding-bottom:72px !important;}
      .sdlg-collapse-wrap{position:relative;}
      .sdlg-collapse-body{
        display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;
        overflow:hidden;max-height:4.8em;line-height:1.45;
      }
      .sdlg-collapse-body.sdlg-expanded{
        -webkit-line-clamp:unset;max-height:none;overflow:visible;
      }
      .sdlg-collapse-toggle{
        margin-top:4px;border:none;background:transparent;color:#2563eb;
        font-size:11px;font-weight:700;cursor:pointer;padding:0;
      }
      .sdlg-empty-dash{color:#9ca3af;font-style:italic;}
      .sdlg-dup-legend{
        font-size:11px;color:#64748b;margin:0 0 8px;padding:6px 10px;
        background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
      }
    `;
    document.head.appendChild(s);
  }

  function isParsePage() {
    var t = document.body ? (document.body.innerText || '') : '';
    return t.indexOf('Paste') >= 0 && t.indexOf('Parse') >= 0 && t.indexOf('Simpan') >= 0;
  }

  function findActionButtons() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
    var updateBtn = null, newBtn = null, cancelBtn = null;
    buttons.forEach(function (b) {
      if (b.closest('#' + FOOTER_ID)) return;
      var tx = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (/Update Klaim/i.test(tx)) updateBtn = b;
      else if (/Simpan sebagai Baru/i.test(tx)) newBtn = b;
      else if (/^\s*[\u2715xX]?\s*Batal\s*$/i.test(tx) || tx === 'Batal' || tx.indexOf('Batal') === 0) {
        if (!cancelBtn) cancelBtn = b;
      }
    });
    return { updateBtn: updateBtn, newBtn: newBtn, cancelBtn: cancelBtn };
  }

  function cloneAction(btn, label, primary) {
    if (!btn) return null;
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label || (btn.textContent || '').trim();
    b.disabled = !!btn.disabled;
    b.style.cssText = primary
      ? 'padding:10px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#c2410c,#ea580c);color:#fff;font-weight:700;font-size:13px;cursor:pointer;'
      : 'padding:10px 16px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-weight:600;font-size:13px;cursor:pointer;';
    
    if (btn.disabled) {
      b.style.opacity = '0.55';
      b.style.cursor = 'not-allowed';
    }
    
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      btn.click();
    });
    
    try {
      var obs = new MutationObserver(function () {
        if (!b) return;
        b.disabled = !!btn.disabled;
        b.style.opacity = btn.disabled ? '0.55' : '1';
        b.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
      });
      obs.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    } catch (_) {}
    return b;
  }

  function ensureStickyFooter() {
    var acts = findActionButtons();
    var existingFooter = document.getElementById(FOOTER_ID);

    if (!acts.updateBtn && !acts.newBtn) {
      if (existingFooter) existingFooter.remove();
      document.body.classList.remove('sdlg-parse-sticky-pad');
      return;
    }
    
    var foot = existingFooter;
    if (!foot) {
      foot = document.createElement('div');
      foot.id = FOOTER_ID;
      document.body.appendChild(foot);
      document.body.classList.add('sdlg-parse-sticky-pad');
    }
    
    var currentText = foot.innerText || '';
    var expectedText = (acts.cancelBtn ? 'Batal ' : '') + (acts.newBtn ? 'Simpan ' : '') + (acts.updateBtn ? 'Update ' : '');
    if (currentText.indexOf(expectedText) > -1 && foot.children.length > 0) return;

    foot.innerHTML = '';
    var legend = document.createElement('div');
    legend.className = 'sdlg-dup-legend';
    legend.style.marginRight = 'auto';
    legend.textContent = 'Hijau pada field = cocok master data · Kosong ditampilkan sebagai —';
    foot.appendChild(legend);

    if (acts.cancelBtn) foot.appendChild(cloneAction(acts.cancelBtn, 'Batal', false));
    if (acts.newBtn) foot.appendChild(cloneAction(acts.newBtn, (acts.newBtn.textContent.trim()), false));
    if (acts.updateBtn) foot.appendChild(cloneAction(acts.updateBtn, (acts.updateBtn.textContent.trim()), true));
  }

  function collapseLongBlocks() {
    var containers = document.querySelectorAll('[data-parse-result], .parse-result, main');
    if (!containers.length) containers = [document.body];

    containers.forEach(function(container) {
      var labels = Array.prototype.slice.call(container.querySelectorAll('div, span, label, strong'));
      labels.forEach(function (el) {
        var t = (el.textContent || '').trim();
        if (t === 'Fault' || t === 'Cause' || t === 'Comment' || t === 'Fault Details') {
          var row = el.parentElement;
          if (!row) return;
          var valueEl = null;
          var kids = row.children;
          if (kids && kids.length >= 2) valueEl = kids[kids.length - 1];
          if (!valueEl) return;
          if (valueEl.getAttribute('data-sdlg-collapse') === '1') return;
          var text = (valueEl.textContent || '').trim();
          if (text.length < 180) return;
          
          valueEl.setAttribute('data-sdlg-collapse', '1');
          var full = valueEl.textContent;
          valueEl.textContent = '';
          var wrap = document.createElement('div');
          wrap.className = 'sdlg-collapse-wrap';
          var body = document.createElement('div');
          body.className = 'sdlg-collapse-body';
          body.textContent = full;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sdlg-collapse-toggle';
          btn.textContent = 'Tampilkan selengkapnya';
          btn.addEventListener('click', function () {
            var open = body.classList.toggle('sdlg-expanded');
            btn.textContent = open ? 'Sembunyikan' : 'Tampilkan selengkapnya';
          });
          wrap.appendChild(body);
          wrap.appendChild(btn);
          valueEl.appendChild(wrap);
        }
      });
    });
  }

  function normalizeEmptyDashes() {
    var roots = document.querySelectorAll('[style*="border-radius: 14px"], [style*="border-radius:14px"]');
    roots.forEach(function (root) {
      var text = root.textContent || '';
      if (text.indexOf('IDENTIFIKASI') < 0 && text.indexOf('Fault') < 0 && text.indexOf('PARTS') < 0) return;
      root.querySelectorAll('td, div').forEach(function (el) {
        if (el.children && el.children.length) return;
        var t = (el.textContent || '').trim();
        if (t === '' || t === 'null' || t === 'undefined' || t === '---' || t === '--') {
          if (el.getAttribute('data-dash') !== '1') {
             el.textContent = '—';
             el.classList.add('sdlg-empty-dash');
             el.setAttribute('data-dash', '1');
          }
        }
      });
    });
  }

  function enhanceDuplicateBanner() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('div, span'));
    nodes.forEach(function (el) {
      var t = el.textContent || '';
      if (t.indexOf('Data ini cocok dengan klaim yang sudah ada') < 0) return;
      if (el.getAttribute('data-sdlg-dup-enhanced') === '1') return;
      var box = el.closest('div');
      if (!box) return;
      box.setAttribute('data-sdlg-dup-enhanced', '1');
      box.style.boxShadow = '0 0 0 2px rgba(245,158,11,.25)';
    });
  }

  function run() {
    if (!isParsePage() || isRunning) return;
    isRunning = true; 
    
    try {
      injectStyles();
      enhanceDuplicateBanner();
      collapseLongBlocks();
      normalizeEmptyDashes();
      ensureStickyFooter();
    } catch(e) {
      if (IS_DEBUG) console.warn('[SDLG paste-parse-ux]', e);
    } finally {
      isRunning = false; 
    }
  }

  var debounceTimer;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      scheduled = false;
      run();
    }, 250); 
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(function (mutations) {
      var selfMutated = mutations.every(function(m) { 
        return (m.target.id === FOOTER_ID || m.target.closest('#' + FOOTER_ID)); 
      });
      if (!selfMutated) schedule();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (IS_DEBUG) console.info('[SDLG] paste-parse-ux.js FINAL v2.2 loaded successfully');
})();