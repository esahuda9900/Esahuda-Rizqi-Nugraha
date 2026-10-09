/**
 * SDLG Portal UX v2.3 — sticky taskbar only on real Input Helper page.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_PORTAL_UX_V23__) return;
  root.__SDLG_PORTAL_UX_V23__ = true;

  function ensureCss() {
    if (document.querySelector('link[data-sdlg-portal-helper-css="v23"]')) return;
    var hrefs = ['./styles/sdlg-portal-helper-v2.css?v=20261009-v2.3'];
    try {
      if (/github\.io/i.test(location.host)) {
        hrefs.push((location.pathname.split('/').slice(0, 2).join('/') || '') + '/styles/sdlg-portal-helper-v2.css?v=20261009-v2.3');
      }
    } catch (_) {}
    hrefs.forEach(function (href, i) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-sdlg-portal-helper-css', i === 0 ? 'v23' : String(i));
      (document.head || document.documentElement).appendChild(link);
    });
  }

  function portalUrl() {
    return 'https://crm.sdlg.com/main.aspx?appid=2097e5d7-73ca-4f97-aae3-94c5e34bea39&forceUCI=1&pagetype=entityrecord&etn=new_srv_workorder';
  }

  function isInputHelperSurface() {
    try {
      if (window.SDLGHashRouter && typeof window.SDLGHashRouter.showBottomTaskbar === 'function') {
        if (!window.SDLGHashRouter.showBottomTaskbar()) return false;
      }
    } catch (_) {}
    var page = document.querySelector('.page');
    if (!page) return false;
    var title = '';
    try { title = String((page.querySelector('.page-title') || {}).textContent || '').toLowerCase(); } catch (_) {}
    if (/warranty claim input helper|sdlg input helper/.test(title)) return true;
    var all = page.querySelector('[data-sdlg-copy-all]');
    if (all && all.offsetParent !== null && /input helper|dealer portal/i.test(title)) return true;
    return false;
  }

  function findPage() {
    if (!isInputHelperSurface()) return null;
    return document.querySelector('.page') || null;
  }

  function markSections(page) {
    page.querySelectorAll('.card, [class*="card"], div[style*="border-radius:14px"]').forEach(function (card) {
      if (card.getAttribute('data-sdlg-section-role')) return;
      var text = (card.innerText || '').slice(0, 500);
      if (card.querySelector('[data-sdlg-copy-all]') || (/Dealer Portal/i.test(text) && /Home/i.test(text))) {
        card.setAttribute('data-sdlg-section-role', 'home');
        card.classList.add('sdlg-section-home');
      } else if (/Replacement Record/i.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'parts');
        card.classList.add('sdlg-section-parts');
      } else if (/Other Cost/i.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'cost');
        card.classList.add('sdlg-section-cost');
      } else if (/IoV Information/i.test(text) || card.hasAttribute('data-sdlg-iov-section')) {
        card.setAttribute('data-sdlg-section-role', 'iov');
        card.classList.add('sdlg-section-iov');
      } else if (/Service Support Ticket/i.test(text) || card.hasAttribute('data-sdlg-ticket-section')) {
        card.setAttribute('data-sdlg-section-role', 'ticket');
        card.classList.add('sdlg-section-ticket');
      } else if (/Attachments/i.test(text) || card.hasAttribute('data-sdlg-attach-section')) {
        card.setAttribute('data-sdlg-section-role', 'attachments');
        card.classList.add('sdlg-section-attachments');
      } else if (/Report Naming|Report Name/i.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'report');
        card.classList.add('sdlg-section-report');
      } else if (/Warranty Policy|Policy Check/i.test(text)) {
        card.setAttribute('data-sdlg-section-role', 'policy');
        card.classList.add('sdlg-section-policy');
      }
    });
  }

  function collapseIov(page) {
    var iov = page.querySelector('[data-sdlg-section-role="iov"], [data-sdlg-iov-section]');
    if (!iov || iov.getAttribute('data-sdlg-collapsed-wired') === '1') return;
    iov.setAttribute('data-sdlg-collapsed-wired', '1');
    iov.classList.add('sdlg-collapsible');
    var rest = [];
    var titleNodes = [];
    Array.prototype.forEach.call(iov.children, function (child, i) {
      var t = (child.className || '') + ' ' + (child.textContent || '').slice(0, 48);
      if (i < 3 && (/eyebrow|page-title|page-sub|Dealer Portal|IoV/i.test(t) || child.classList.contains('eyebrow') || child.classList.contains('page-title') || child.classList.contains('page-sub'))) {
        titleNodes.push(child);
      } else rest.push(child);
    });
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
    copyIov.addEventListener('click', async function (e) {
      e.stopPropagation();
      var lines = [];
      iov.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
        lines.push((el.getAttribute('data-label') || '') + ': ' + (el.value || ''));
      });
      try { await navigator.clipboard.writeText(lines.join('\n')); } catch (_) {}
    });
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
  }

  function hideEmptyAttachments(page) {
    var att = page.querySelector('[data-sdlg-section-role="attachments"], [data-sdlg-attach-section]');
    if (!att) return;
    var names = att.querySelectorAll('[data-sdlg-attach-name]');
    var text = att.innerText || '';
    var empty = !names.length && /Tidak ada attachment|no attachment|kosong/i.test(text);
    if (empty) { att.setAttribute('hidden', ''); att.classList.add('sdlg-section-hidden'); }
    else { att.removeAttribute('hidden'); att.classList.remove('sdlg-section-hidden'); }
  }

  function promotePortalLink() {}

  function hideMidPortalLinks(page) {
    page.querySelectorAll('a').forEach(function (a) {
      if (!/Buka Dealer Portal|Buka Portal|Buka SDLG Portal/i.test(a.textContent || '')) return;
      if (a.closest('#sdlg-portal-sticky-bar')) return;
      a.style.display = 'none';
    });
    page.querySelectorAll('#sdlg-copy-all, [data-sdlg-copy-all]').forEach(function (btn) {
      if (btn.closest('#sdlg-portal-sticky-bar')) return;
      btn.style.display = 'none';
    });
  }

  function styleFieldCopyButtons(page) {
    page.querySelectorAll('[data-sdlg-copy]').forEach(function (btn) {
      if (btn.hasAttribute('data-sdlg-copy-all') || btn.closest('.sdlg-section-head-actions') || btn.closest('#sdlg-portal-sticky-bar')) return;
      btn.classList.add('sdlg-copy-hover');
      var wrap = btn.closest('div');
      if (wrap) wrap.classList.add('sdlg-field-wrap');
    });
  }

  function upgradeNoteBanner(page) {
    var nodes = page.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.querySelector('div')) continue;
      var t = el.textContent || '';
      if (!/Catatan/i.test(t) || !/copy\/paste|Dealer Portal SDLG/i.test(t)) continue;
      if (el.classList.contains('sdlg-portal-note-banner')) return;
      el.classList.add('sdlg-portal-note-banner');
      var html = el.innerHTML;
      el.innerHTML = '<span class="sdlg-portal-note-icon" aria-hidden="true"></span><span class="sdlg-portal-note-text">' + html + '</span>';
      return;
    }
  }

  function ensureReportNameFull(page) {
    page.querySelectorAll('.card, [class*="card"]').forEach(function (card) {
      if (!/Report Naming|Nama Report/i.test(card.innerText || '')) return;
      card.classList.add('sdlg-section-report');
    });
  }

  function clickCopyAll() {
    var btn = document.querySelector('[data-sdlg-copy-all]');
    if (btn) { btn.style.display = ''; btn.click(); btn.style.display = 'none'; }
  }

  function ensureStickyBar() {
    if (!isInputHelperSurface()) { removeStickyIfLeft(); return; }
    var existing = document.getElementById('sdlg-portal-sticky-bar');
    if (existing) {
      existing.querySelectorAll('button, a').forEach(function (el) {
        if (el.textContent === 'Copy All') el.textContent = 'Copy Home Fields';
        if (el.textContent === 'Copy Parts') el.textContent = 'Copy Replacement';
        if (el.textContent === 'Buka Portal') el.textContent = 'Buka SDLG Portal';
      });
      return;
    }
    var bar = document.createElement('div');
    bar.id = 'sdlg-portal-sticky-bar';
    bar.className = 'sdlg-portal-sticky-bar';
    function mk(label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    }
    bar.appendChild(mk('Copy Home Fields', 'primary-btn', clickCopyAll));
    bar.appendChild(mk('Copy Replacement', 'secondary-btn', function () {
      var rows = document.querySelectorAll('[data-sdlg-part]');
      var lines = [['Failure Part', 'Replace Part', 'Description', 'Qty', 'Unit Price', 'Amount'].join('\t')];
      rows.forEach(function (el) { lines.push(el.getAttribute('data-sdlg-part') || el.getAttribute('data-value') || ''); });
      navigator.clipboard.writeText(lines.join('\n')).catch(function () {});
    }));
    bar.appendChild(mk('Copy IoV', 'secondary-btn', function () {
      var iov = document.querySelector('[data-sdlg-section-role="iov"]');
      var btn = iov && iov.querySelector('.sdlg-section-head-actions .secondary-btn:last-child');
      if (btn) btn.click();
    }));
    var open = document.createElement('a');
    open.href = portalUrl();
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.className = 'primary-btn';
    open.textContent = 'Buka SDLG Portal';
    bar.appendChild(open);
    document.body.appendChild(bar);
    document.documentElement.classList.add('sdlg-has-portal-sticky');
  }

  function removeStickyIfLeft() {
    if (isInputHelperSurface()) return;
    var bar = document.getElementById('sdlg-portal-sticky-bar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    document.documentElement.classList.remove('sdlg-has-portal-sticky');
  }

  function enhance() {
    ensureCss();
    if (!isInputHelperSurface()) { removeStickyIfLeft(); return; }
    var page = findPage();
    if (!page) { removeStickyIfLeft(); return; }
    try {
      page.classList.add('sdlg-input-helper-page');
      markSections(page);
      collapseIov(page);
      hideEmptyAttachments(page);
      promotePortalLink();
      hideMidPortalLinks(page);
      styleFieldCopyButtons(page);
      upgradeNoteBanner(page);
      ensureReportNameFull(page);
      ensureStickyBar();
    } catch (err) {
      console.warn('[SDLG portal-ux v2.3]', err);
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(enhance, 350); }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPortalUXv2 = { version: '2.3.0', enhance: enhance };
})(window);
