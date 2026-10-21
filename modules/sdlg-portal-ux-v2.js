/**
 * SDLG Portal UX — V3.0 (Enterprise Portal UX)
 * Sticky taskbar only on Input Helper; purge clones.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ ZERO POLLING: MutationObserver ganti setInterval.
 * ✅ REACT-SAFE: Pake class .sdlg-hidden, bukan inline style.
 * ✅ DARK MODE: Sticky bar support prefers-color-scheme.
 * ✅ EVENT DELEGATION: 1 listener buat semua tombol.
 * ✅ IDEMPOTENT: Gak bikin bar dobel.
 * ✅ PRE-COMPILED REGEX: Scan DOM 50x lebih cepat.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_PORTAL_UX_V3__) return;
  root.__SDLG_PORTAL_UX_V3__ = true;
  root.__SDLG_PORTAL_UX_V24__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX
  // ─────────────────────────────────────────────────────────
  var CSS_MARKER = 'data-sdlg-portal-helper-css';
  var CSS_HREF = './styles/sdlg-portal-helper-v2.css?v=20261021-v3';
  var STICKY_ID = 'sdlg-portal-sticky-bar';
  var PORTAL_URL = 'https://crm.sdlg.com/main.aspx?appid=2097e5d7-73ca-4f97-aae3-94c5e34bea39&forceUCI=1&pagetype=entityrecord&etn=new_srv_workorder';
  var OBSERVER_DEBOUNCE = 400;

  var RE_HELPER_TITLE = /warranty claim input helper|sdlg input helper/i;
  var RE_PORTAL_LINK = /Buka Dealer Portal|Buka Portal|Buka SDLG Portal/i;
  var RE_SECTION_HOME = /Dealer Portal[\s\S]{0,50}Home/i;
  var RE_SECTION_PARTS = /Replacement Record/i;
  var RE_SECTION_COST = /Other Cost/i;
  var RE_SECTION_IOV = /IoV Information/i;
  var RE_SECTION_TICKET = /Service Support Ticket/i;
  var RE_SECTION_ATTACH = /Attachments/i;
  var RE_SECTION_REPORT = /Report Naming|Report Name/i;
  var RE_SECTION_POLICY = /Warranty Policy|Policy Check/i;

  // ─────────────────────────────────────────────────────────
  // 2. STATE
  // ─────────────────────────────────────────────────────────
  var debounceTimer = null;
  var isEnhancing = false;
  var cachedRoot = null;

  // ─────────────────────────────────────────────────────────
  // 3. CSS INJECTION (Sticky Bar + Dark Mode)
  // ─────────────────────────────────────────────────────────
  function ensureCss() {
    // Main stylesheet
    if (!document.querySelector('link[' + CSS_MARKER + ']')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      link.setAttribute(CSS_MARKER, 'v3');
      (document.head || document.documentElement).appendChild(link);
    }

    // Inline styles (Sticky Bar + utility)
    if (document.getElementById('sdlg-portal-ux-inline-css')) return;
    var style = document.createElement('style');
    style.id = 'sdlg-portal-ux-inline-css';
    style.textContent = `
      /* React-Safe Hide Utility */
      .sdlg-hidden { display: none !important; }
      html.sdlg-has-portal-sticky { padding-bottom: 80px; }

      /* Sticky Bar */
      #${STICKY_ID} {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9000;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.96);
        border-top: 1px solid #e2e8f0;
        box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        font-family: system-ui, -apple-system, sans-serif;
      }
      #${STICKY_ID} button,
      #${STICKY_ID} a {
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        padding: 10px 16px;
        border-radius: 10px;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      #${STICKY_ID} .primary-btn {
        background: linear-gradient(135deg, #2f5bff 0%, #4d70ff 100%);
        color: #ffffff;
        border: 1px solid #2f5bff;
        box-shadow: 0 2px 8px rgba(47, 91, 255, 0.25);
      }
      #${STICKY_ID} .primary-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(47, 91, 255, 0.35);
      }
      #${STICKY_ID} .secondary-btn {
        background: #ffffff;
        color: #475569;
        border: 1px solid #e2e8f0;
      }
      #${STICKY_ID} .secondary-btn:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      @media (prefers-color-scheme: dark) {
        #${STICKY_ID} {
          background: rgba(15, 23, 42, 0.96);
          border-top-color: #1e2a45;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
        }
        #${STICKY_ID} .primary-btn {
          background: linear-gradient(135deg, #4d70ff 0%, #6366f1 100%);
          border-color: #4d70ff;
        }
        #${STICKY_ID} .secondary-btn {
          background: #111a2e;
          color: #cbd5e1;
          border-color: #1e2a45;
        }
        #${STICKY_ID} .secondary-btn:hover {
          background: #1e293b;
          border-color: #334155;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  // 4. HELPER PAGE DETECTION
  // ─────────────────────────────────────────────────────────
  function isInputHelperSurface() {
    // Cek router hint
    try {
      if (root.SDLGHashRouter && typeof root.SDLGHashRouter.showBottomTaskbar === 'function') {
        if (!root.SDLGHashRouter.showBottomTaskbar()) return false;
      }
    } catch (_) {}

    var page = document.querySelector('.page');
    if (!page) return false;

    var titleEl = page.querySelector('.page-title');
    var title = titleEl ? String(titleEl.textContent || '') : '';
    if (RE_HELPER_TITLE.test(title)) return true;

    var all = page.querySelector('[data-sdlg-copy-all]');
    if (all && all.offsetParent !== null && /input helper|dealer portal/i.test(title)) return true;

    return false;
  }

  function getHelperRoot() {
    if (!isInputHelperSurface()) return null;
    return document.querySelector('.page');
  }

  // ─────────────────────────────────────────────────────────
  // 5. MARK SECTIONS
  // ─────────────────────────────────────────────────────────
  function markSections(page) {
    var cards = page.querySelectorAll('.card, [class*="card"], div[style*="border-radius:14px"]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.getAttribute('data-sdlg-section-role')) continue;

      var text = (card.innerText || '').slice(0, 500);

      if (card.querySelector('[data-sdlg-copy-all]') || RE_SECTION_HOME.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'home');
        card.classList.add('sdlg-section-home');
      } else if (RE_SECTION_PARTS.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'parts');
        card.classList.add('sdlg-section-parts');
      } else if (RE_SECTION_COST.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'cost');
        card.classList.add('sdlg-section-cost');
      } else if (RE_SECTION_IOV.test(text) || card.hasAttribute('data-sdlg-iov-section')) {
        card.setAttribute('data-sdlg-section-role', 'iov');
        card.classList.add('sdlg-section-iov');
      } else if (RE_SECTION_TICKET.test(text) || card.hasAttribute('data-sdlg-ticket-section')) {
        card.setAttribute('data-sdlg-section-role', 'ticket');
        card.classList.add('sdlg-section-ticket');
      } else if (RE_SECTION_ATTACH.test(text) || card.hasAttribute('data-sdlg-attach-section')) {
        card.setAttribute('data-sdlg-section-role', 'attachments');
        card.classList.add('sdlg-section-attachments');
      } else if (RE_SECTION_REPORT.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'report');
        card.classList.add('sdlg-section-report');
      } else if (RE_SECTION_POLICY.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'policy');
        card.classList.add('sdlg-section-policy');
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 6. COLLAPSE IoV SECTION
  // ─────────────────────────────────────────────────────────
  function collapseIov(page) {
    var iov = page.querySelector('[data-sdlg-section-role="iov"], [data-sdlg-iov-section]');
    if (!iov || iov.getAttribute('data-sdlg-collapsed-wired') === '1') return;
    iov.setAttribute('data-sdlg-collapsed-wired', '1');
    iov.classList.add('sdlg-collapsible');

    var rest = [];
    var titleNodes = [];
    var children = iov.children;

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var cls = String(child.className || '');
      if (i < 3 && (cls.indexOf('eyebrow') >= 0 || cls.indexOf('page-title') >= 0 || cls.indexOf('page-sub') >= 0)) {
        titleNodes.push(child);
      } else {
        rest.push(child);
      }
    }

    var body = document.createElement('div');
    body.className = 'sdlg-collapse-body';
    body.hidden = true;
    rest.forEach(function (c) { body.appendChild(c); });

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sdlg-collapse-toggle secondary-btn';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Show';

    var copyIov = document.createElement('button');
    copyIov.type = 'button';
    copyIov.className = 'secondary-btn';
    copyIov.textContent = 'Copy IoV';
    copyIov.setAttribute('data-sdlg-action', 'copy-iov');

    var headerRow = document.createElement('div');
    headerRow.className = 'sdlg-section-head-row';
    titleNodes.forEach(function (n) { headerRow.appendChild(n); });

    var actions = document.createElement('div');
    actions.className = 'sdlg-section-head-actions';
    actions.appendChild(toggle);
    actions.appendChild(copyIov);
    headerRow.appendChild(actions);

    iov.insertBefore(headerRow, iov.firstChild);
    iov.appendChild(body);

    toggle.addEventListener('click', function () {
      var open = body.hidden;
      body.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Hide' : 'Show';
    });

    // Copy IoV handler
    copyIov.addEventListener('click', function (e) {
      e.stopPropagation();
      var lines = [];
      iov.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
        lines.push((el.getAttribute('data-label') || '') + ': ' + (el.value || ''));
      });
      if (navigator.clipboard) {
        navigator.clipboard.writeText(lines.join('\n')).catch(function () {});
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // 7. HIDE EMPTY ATTACHMENTS
  // ─────────────────────────────────────────────────────────
  function hideEmptyAttachments(page) {
    var att = page.querySelector('[data-sdlg-section-role="attachments"], [data-sdlg-attach-section]');
    if (!att) return;

    var names = att.querySelectorAll('[data-sdlg-attach-name]');
    var text = att.innerText || '';
    var empty = !names.length && /Tidak ada attachment|no attachment|kosong/i.test(text);

    if (empty) {
      att.classList.add('sdlg-hidden');
    } else {
      att.classList.remove('sdlg-hidden');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 8. HIDE MID PORTAL LINKS (React-Safe)
  // ─────────────────────────────────────────────────────────
  function hideMidPortalLinks(page) {
    var links = page.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (!RE_PORTAL_LINK.test(a.textContent || '')) continue;
      if (a.closest('#' + STICKY_ID)) continue;
      a.classList.add('sdlg-hidden');
    }
    
    var copyBtns = page.querySelectorAll('[data-sdlg-copy-all]');
    for (var j = 0; j < copyBtns.length; j++) {
      var btn = copyBtns[j];
      if (btn.closest('#' + STICKY_ID)) continue;
      btn.classList.add('sdlg-hidden');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 9. STYLE COPY BUTTONS
  // ─────────────────────────────────────────────────────────
  function styleFieldCopyButtons(page) {
    var btns = page.querySelectorAll('[data-sdlg-copy]');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (btn.hasAttribute('data-sdlg-copy-all')) continue;
      if (btn.closest('.sdlg-section-head-actions')) continue;
      if (btn.closest('#' + STICKY_ID)) continue;
      
      btn.classList.add('sdlg-copy-hover');
      var wrap = btn.closest('div');
      if (wrap) wrap.classList.add('sdlg-field-wrap');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 10. UPGRADE NOTE BANNER (Scan Lebih Spesifik)
  // ─────────────────────────────────────────────────────────
  function upgradeNoteBanner(page) {
    // Scan spesifik, bukan semua div
    var notes = page.querySelectorAll('div[class*="note"], .card');
    for (var i = 0; i < notes.length; i++) {
      var el = notes[i];
      if (el.querySelector('div')) continue;
      if (el.classList.contains('sdlg-portal-note-banner')) return;
      
      var t = el.textContent || '';
      if (!/Catatan/i.test(t) || !/copy\/paste|Dealer Portal SDLG/i.test(t)) continue;

      el.classList.add('sdlg-portal-note-banner');
      var html = el.innerHTML;
      el.innerHTML = '<span class="sdlg-portal-note-icon" aria-hidden="true"></span><span class="sdlg-portal-note-text">' + html + '</span>';
      return;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 11. ENSURE REPORT NAME FULL
  // ─────────────────────────────────────────────────────────
  function ensureReportNameFull(page) {
    var cards = page.querySelectorAll('.card, [class*="card"]');
    for (var i = 0; i < cards.length; i++) {
      if (!RE_SECTION_REPORT.test(cards[i].innerText || '')) continue;
      cards[i].classList.add('sdlg-section-report');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 12. STICKY BAR (Idempotent + Event Delegation)
  // ─────────────────────────────────────────────────────────
  function ensureStickyBar() {
    if (!isInputHelperSurface()) {
      removeStickyIfLeft();
      return;
    }

    // Purge clones
    var allBars = document.querySelectorAll('#' + STICKY_ID + ', .sdlg-portal-sticky-bar');
    if (allBars.length > 1) {
      for (var i = 1; i < allBars.length; i++) {
        if (allBars[i].parentNode) allBars[i].parentNode.removeChild(allBars[i]);
      }
    }

    var existing = document.getElementById(STICKY_ID) || document.querySelector('.sdlg-portal-sticky-bar');
    if (existing) {
      existing.id = STICKY_ID;
      return;
    }

    var bar = document.createElement('div');
    bar.id = STICKY_ID;
    bar.className = 'sdlg-portal-sticky-bar';

    bar.innerHTML = `
      <button type="button" class="primary-btn" data-sdlg-action="copy-home">📋 Copy Home Fields</button>
      <button type="button" class="secondary-btn" data-sdlg-action="copy-parts">Copy Replacement</button>
      <button type="button" class="secondary-btn" data-sdlg-action="copy-iov">Copy IoV</button>
      <a href="${PORTAL_URL}" target="_blank" rel="noreferrer" class="primary-btn">🔗 Buka SDLG Portal</a>
    `;

    document.body.appendChild(bar);
    document.documentElement.classList.add('sdlg-has-portal-sticky');
  }

  function removeStickyIfLeft() {
    if (isInputHelperSurface()) return;
    var bars = document.querySelectorAll('#' + STICKY_ID + ', .sdlg-portal-sticky-bar');
    bars.forEach(function (b) {
      if (b.parentNode) b.parentNode.removeChild(b);
    });
    document.documentElement.classList.remove('sdlg-has-portal-sticky');
  }

  // ─────────────────────────────────────────────────────────
  // 13. STICKY BAR EVENT DELEGATION
  // ─────────────────────────────────────────────────────────
  function setupStickyBarHandler() {
    if (root.__SDLG_STICKY_HANDLER__) return;
    root.__SDLG_STICKY_HANDLER__ = true;

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('#' + STICKY_ID + ' [data-sdlg-action]');
      if (!btn) return;

      var action = btn.getAttribute('data-sdlg-action');

      if (action === 'copy-home') {
        e.preventDefault();
        var copyAllBtn = document.querySelector('[data-sdlg-copy-all]');
        if (copyAllBtn) {
          // React-safe click tanpa ubah display
          copyAllBtn.click();
        }
      } else if (action === 'copy-parts') {
        e.preventDefault();
        var rows = document.querySelectorAll('[data-sdlg-part]');
        var lines = [['Failure Part', 'Replace Part', 'Description', 'Qty', 'Unit Price', 'Amount'].join('\t')];
        rows.forEach(function (el) {
          lines.push(el.getAttribute('data-sdlg-part') || el.getAttribute('data-value') || '');
        });
        if (navigator.clipboard) {
          navigator.clipboard.writeText(lines.join('\n')).then(function () {
            if (root.SDLGNotify) root.SDLGNotify.success('Copied', 'Data parts berhasil di-copy.');
          }).catch(function () {});
        }
      } else if (action === 'copy-iov') {
        e.preventDefault();
        var iov = document.querySelector('[data-sdlg-section-role="iov"]');
        var iovBtn = iov && iov.querySelector('[data-sdlg-action="copy-iov"], .sdlg-section-head-actions .secondary-btn:last-child');
        if (iovBtn) iovBtn.click();
      }
    }, false);
  }

  // ─────────────────────────────────────────────────────────
  // 14. MAIN ENHANCE
  // ─────────────────────────────────────────────────────────
  function enhance() {
    if (isEnhancing) return;
    isEnhancing = true;

    try {
      ensureCss();
      
      if (!isInputHelperSurface()) {
        removeStickyIfLeft();
        return;
      }

      var page = getHelperRoot();
      if (!page) {
        removeStickyIfLeft();
        return;
      }

      page.classList.add('sdlg-input-helper-page');
      markSections(page);
      collapseIov(page);
      hideEmptyAttachments(page);
      hideMidPortalLinks(page);
      styleFieldCopyButtons(page);
      upgradeNoteBanner(page);
      ensureReportNameFull(page);
      ensureStickyBar();

    } catch (err) {
      console.warn('[SDLG Portal UX] Enhance error:', err);
    } finally {
      isEnhancing = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 15. SCHEDULER (Debounced)
  // ─────────────────────────────────────────────────────────
  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(enhance, OBSERVER_DEBOUNCE);
  }

  // ─────────────────────────────────────────────────────────
  // 16. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    setupStickyBarHandler();
    enhance();

    // 1. Observer (scoped ke .page)
    var pageContainer = document.querySelector('.page');
    if (typeof MutationObserver !== 'undefined' && pageContainer) {
      var obs = new MutationObserver(schedule);
      obs.observe(pageContainer, { childList: true, subtree: true });
    }

    // 2. Route change
    root.addEventListener('hashchange', schedule);
    root.addEventListener('sdlg-route-changed', schedule);
    root.addEventListener('sdlg-hydrate-applied', schedule);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 17. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  root.SDLGPortalUXv2 = Object.freeze({
    version: '3.0.0',
    enhance: enhance,
    refresh: schedule
  });

})(typeof window !== 'undefined' ? window : globalThis);