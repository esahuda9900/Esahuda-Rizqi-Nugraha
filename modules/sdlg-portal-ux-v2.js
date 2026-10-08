/**
 * SDLG Portal UX v2 — hierarchy only (sticky bar, collapse IoV, hide empty, top portal, copy-on-hover).
 * Depends on sdlg-portal-copy-helper for format/copy when present.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_PORTAL_UX_V2__) return;
  root.__SDLG_PORTAL_UX_V2__ = true;

  function ensureCss() {
    if (document.querySelector('link[data-sdlg-portal-helper-css]')) return;
    var hrefs = ['./styles/sdlg-portal-helper-v2.css?v=20261008-v2'];
    try {
      if (/github\.io/i.test(location.host)) {
        hrefs.push((location.pathname.split('/').slice(0, 2).join('/') || '') + '/styles/sdlg-portal-helper-v2.css?v=20261008-v2');
      }
    } catch (_) {}
    hrefs.forEach(function (href, i) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-sdlg-portal-helper-css', String(i));
      (document.head || document.documentElement).appendChild(link);
    });
  }

  function portalUrl() {
    return 'https://crm.sdlg.com/main.aspx?appid=2097e5d7-73ca-4f97-aae3-94c5e34bea39&forceUCI=1&pagetype=entityrecord&etn=new_srv_workorder';
  }

  function findPage() {
    var all = document.querySelector('[data-sdlg-copy-all]');
    if (!all) return null;
    var el = all;
    for (var i = 0; i < 14 && el; i++) {
      if (el.classList && el.classList.contains('page')) return el;
      el = el.parentElement;
    }
    return all.closest('.page') || all.parentElement;
  }

  function markSections(page) {
    page.querySelectorAll('.card, [class*="card"], div[style*="border-radius:14px"]').forEach(function (card) {
      if (card.getAttribute('data-sdlg-section-role')) return;
      var text = (card.innerText || '').slice(0, 500);
      if (card.querySelector('[data-sdlg-copy-all]') || (/Dealer Portal/i.test(text) && /Home/i.test(text) && /Copy All/i.test(text))) {
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
      } else {
        rest.push(child);
      }
    });

    var body = document.createElement('div');
    body.className = 'sdlg-collapse-body';
    body.hidden = true;
    rest.forEach(function (c) { body.appendChild(c); });

    var fields = body.querySelectorAll('[data-sdlg-field], .sdlg-portal-field');
    if (fields.length > 4 && !body.querySelector('.sdlg-portal-iov-grid')) {
      var fieldParent = document.createElement('div');
      fieldParent.className = 'sdlg-portal-iov-grid';
      Array.prototype.forEach.call(fields, function (f) {
        var wrap = f.closest('.sdlg-portal-field') || f.parentElement || f;
        if (wrap && wrap.parentNode === body) fieldParent.appendChild(wrap);
      });
      if (fieldParent.children.length) body.insertBefore(fieldParent, body.firstChild);
    }

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
        var label = el.getAttribute('data-label') || '';
        var val = el.value || '';
        var fmt = (root.SDLGFormatForPortal || function (v) { return v; })(val, /Time|Date/i.test(label) ? 'datetime' : 'text');
        lines.push(label + ': ' + fmt);
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
      iov.classList.toggle('is-open', open);
    });
  }

  function hideEmptyAttachments(page) {
    var att = page.querySelector('[data-sdlg-section-role="attachments"], [data-sdlg-attach-section]');
    if (!att) return;
    var names = att.querySelectorAll('[data-sdlg-attach-name]');
    var text = att.innerText || '';
    var empty = !names.length && /Tidak ada attachment|no attachment|kosong/i.test(text);
    if (empty) {
      att.setAttribute('hidden', '');
      att.classList.add('sdlg-section-hidden');
    } else {
      att.removeAttribute('hidden');
      att.classList.remove('sdlg-section-hidden');
    }
  }

  function promotePortalLink(page) {
    if (page.querySelector('[data-sdlg-portal-top]')) return;
    var bottom = null;
    page.querySelectorAll('a').forEach(function (a) {
      if (/Buka Dealer Portal|Dealer Portal/i.test(a.textContent || '')) bottom = a;
    });
    var bar = document.createElement('div');
    bar.className = 'sdlg-portal-top-actions';
    bar.setAttribute('data-sdlg-portal-top', '1');
    var openBtn = document.createElement('a');
    openBtn.href = (bottom && bottom.getAttribute('href')) || portalUrl();
    openBtn.target = '_blank';
    openBtn.rel = 'noreferrer';
    openBtn.className = 'primary-btn';
    openBtn.textContent = 'Buka Dealer Portal';
    bar.appendChild(openBtn);
    var title = page.querySelector('.page-title');
    if (title && title.parentElement) title.parentElement.insertAdjacentElement('afterend', bar);
    else page.insertBefore(bar, page.firstChild);
  }

  function styleFieldCopyButtons(page) {
    page.querySelectorAll('[data-sdlg-copy]').forEach(function (btn) {
      if (btn.hasAttribute('data-sdlg-copy-all') || btn.closest('.sdlg-section-head-actions') || btn.closest('#sdlg-portal-sticky-bar')) return;
      btn.classList.add('sdlg-copy-hover');
      var wrap = btn.closest('div');
      if (wrap) wrap.classList.add('sdlg-field-wrap');
    });
    page.querySelectorAll('[data-sdlg-field]').forEach(function (field) {
      var wrap = field.parentElement;
      if (wrap) wrap.classList.add('sdlg-field-wrap');
    });
  }

  function clickCopyAll() {
    var btn = document.querySelector('[data-sdlg-copy-all]');
    if (btn) btn.click();
  }

  function ensureStickyBar(page) {
    if (document.getElementById('sdlg-portal-sticky-bar')) return;
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

    bar.appendChild(mk('Copy All', 'primary-btn', clickCopyAll));
    bar.appendChild(mk('Copy Parts', 'secondary-btn', function () {
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
    open.textContent = 'Buka Portal';
    bar.appendChild(open);

    document.body.appendChild(bar);
    document.documentElement.classList.add('sdlg-has-portal-sticky');
  }

  function removeStickyIfLeft() {
    if (document.querySelector('[data-sdlg-copy-all]')) return;
    var bar = document.getElementById('sdlg-portal-sticky-bar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    document.documentElement.classList.remove('sdlg-has-portal-sticky');
  }

  function enhance() {
    ensureCss();
    var page = findPage();
    if (!page) {
      removeStickyIfLeft();
      return;
    }
    try {
      page.classList.add('sdlg-input-helper-page');
      markSections(page);
      collapseIov(page);
      hideEmptyAttachments(page);
      promotePortalLink(page);
      styleFieldCopyButtons(page);
      ensureStickyBar(page);
    } catch (err) {
      console.warn('[SDLG portal-ux v2]', err);
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(enhance, 350);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPortalUXv2 = { version: '2.0.0', enhance: enhance };
})(window);
