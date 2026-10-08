/**
 * SDLG Portal Copy Helper v1.2.0
 * Field inject IDEMPOTENT; Date of repair report pairs before Complaint.
 */
(function (root) {
  'use strict';
  root.__SDLG_PORTAL_COPY_HELPER_V1__ = true;
  if (root.__SDLG_PORTAL_COPY_HELPER_V12__) return;
  root.__SDLG_PORTAL_COPY_HELPER_V12__ = true;

  function formatForSDLG(value, type) {
    if (value == null || value === '') return '';
    if (type === 'number') {
      var n = Number(String(value).replace(',', '.').replace(/\s*(hr|hrs|hours|km)\s*$/i, ''));
      if (!Number.isFinite(n)) return String(value);
      return n.toFixed(2).replace('.', ',');
    }
    if (type === 'date') {
      var s = String(value).trim();
      var isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) return isoMatch[3] + '/' + isoMatch[2] + '/' + isoMatch[1];
      return s;
    }
    if (type === 'text') return String(value).trim().replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n');
    return String(value);
  }
  root.SDLGFormatForPortal = formatForSDLG;

  var NUMBER_LABELS = /hour meter|repair labor|service mileage|qty|unit price|amount|labour|mileage|other amount|total amount/i;
  var DATE_LABELS = /failure date|date of repair report|repair report/i;
  function typeForLabel(label) {
    var L = String(label || '');
    if (DATE_LABELS.test(L)) return 'date';
    if (NUMBER_LABELS.test(L)) return 'number';
    return 'text';
  }

  function toast(msg, kind) {
    var existing = document.querySelector('.sdlg-toast');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var el = document.createElement('div');
    el.className = 'sdlg-toast' + (kind === 'warn' ? ' sdlg-toast-warn' : '');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4200);
  }

  async function writeClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); return true;
      } catch (e2) { return false; }
    }
  }

  function findHelperRoot() {
    var all = document.querySelector('[data-sdlg-copy-all]');
    if (!all) return null;
    var el = all;
    for (var i = 0; i < 14 && el; i++) {
      if (el.querySelectorAll && el.querySelectorAll('[data-sdlg-field]').length >= 3) return el;
      el = el.parentElement;
    }
    return all.parentElement;
  }

  function readFieldMap(scope) {
    var map = {};
    (scope || document).querySelectorAll('[data-sdlg-field]').forEach(function (el) {
      map[el.getAttribute('data-label') || ''] = el;
    });
    return map;
  }

  var REQUIRED = ['Service Type','Service Method','Serial number','Hour meter','Failure Date','Date of repair report','Feedback Person','Feedback Contact Information','Complaint','Machine Location'];

  function validateFields(root) {
    var problems = [];
    var map = readFieldMap(root);
    REQUIRED.forEach(function (label) {
      var el = map[label];
      if (!el || !String(el.value || '').trim()) problems.push(label + ' kosong');
    });
    return problems;
  }

  function makeFieldRow(key, label, value, required) {
    var wrap = document.createElement('div');
    wrap.className = 'sdlg-portal-field sdlg-field-wrap';
    wrap.setAttribute('data-sdlg-portal-extra', key);
    var head = document.createElement('div');
    head.className = 'sdlg-portal-field-head';
    var lab = document.createElement('label');
    lab.className = 'sdlg-portal-field-label';
    lab.textContent = label + (required ? ' *' : '');
    head.appendChild(lab);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-btn sdlg-copy-hover';
    btn.setAttribute('data-sdlg-copy', '1');
    btn.textContent = 'Copy';
    head.appendChild(btn);
    wrap.appendChild(head);
    var control;
    if (key === 'logisticsBackfill') {
      control = document.createElement('select');
      ['No', 'Yes'].forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt; o.textContent = opt; control.appendChild(o);
      });
      control.value = value === 'Yes' ? 'Yes' : 'No';
    } else {
      control = document.createElement('input');
      control.type = 'text';
      control.value = value || '';
    }
    control.className = 'sdlg-portal-field-control';
    control.setAttribute('data-sdlg-field', '1');
    control.setAttribute('data-label', label);
    wrap.appendChild(control);
    btn.addEventListener('click', async function () {
      var ok = await writeClipboard(formatForSDLG(control.value, typeForLabel(label)));
      var old = btn.textContent; btn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(function () { if (btn.isConnected) btn.textContent = old; }, 1200);
    });
    return wrap;
  }

  function insertAfterField(map, afterLabel, row) {
    var ref = map[afterLabel];
    if (!ref) return false;
    var wrap = ref.closest('.sdlg-portal-field') || ref.parentElement;
    if (wrap && wrap.parentElement) {
      wrap.parentElement.insertBefore(row, wrap.nextSibling);
      return true;
    }
    return false;
  }

  function ensureExtraFields(root) {
    if (!root) return;
    var map = readFieldMap(root);
    if (!map['Serial number'] && !map['Service Type'] && !map['Failure Date']) return;

    if (!map['Date of repair report']) {
      var row = makeFieldRow('repairReportDate', 'Date of repair report', '', true);
      var complaint = map['Complaint'];
      if (complaint) {
        var cWrap = complaint.closest('.sdlg-portal-field') || complaint.parentElement;
        if (cWrap && cWrap.parentElement) cWrap.parentElement.insertBefore(row, cWrap);
        else if (!insertAfterField(map, 'Failure Date', row)) root.appendChild(row);
      } else if (!insertAfterField(map, 'Failure Date', row)) {
        root.appendChild(row);
      }
    }

    map = readFieldMap(root);
    if (!map['Logistics Backfill Document']) {
      var logRow = makeFieldRow('logisticsBackfill', 'Logistics Backfill Document', 'No', false);
      if (!insertAfterField(map, 'Service Mileage (Km)', logRow) && !insertAfterField(map, 'Service Mileage', logRow)) {
        root.appendChild(logRow);
      }
    }

    var page = root.closest('.page') || root.parentElement || root;
    if (!page.querySelector('[data-sdlg-iov-section]')) {
      var iovCard = document.createElement('div');
      iovCard.className = 'card card-pad sdlg-portal-section';
      iovCard.setAttribute('data-sdlg-iov-section', '1');
      iovCard.setAttribute('data-sdlg-section-role', 'iov');
      var eb = document.createElement('div'); eb.className = 'eyebrow'; eb.textContent = 'Dealer Portal';
      var ti = document.createElement('div'); ti.className = 'page-title'; ti.textContent = 'IoV Information';
      iovCard.appendChild(eb); iovCard.appendChild(ti);
      var grid = document.createElement('div');
      grid.className = 'sdlg-portal-iov-grid';
      ['IoV Address','Service Node','Service Dispatch Time','Service Response Time','Service Departure Time','Service Arrival Time','Service Completion Time','Submission Time'].forEach(function (lab, idx) {
        grid.appendChild(makeFieldRow('iov' + idx, lab, '', false));
      });
      iovCard.appendChild(grid);
      page.appendChild(iovCard);
    }

    if (!page.querySelector('[data-sdlg-ticket-section]')) {
      var ticketCard = document.createElement('div');
      ticketCard.className = 'card card-pad sdlg-portal-section';
      ticketCard.setAttribute('data-sdlg-ticket-section', '1');
      var eb2 = document.createElement('div'); eb2.className = 'eyebrow'; eb2.textContent = 'Dealer Portal';
      var ti2 = document.createElement('div'); ti2.className = 'page-title'; ti2.textContent = 'Service Support Ticket';
      ticketCard.appendChild(eb2); ticketCard.appendChild(ti2);
      ticketCard.appendChild(makeFieldRow('supportTicket', 'Service Support Ticket', '', false));
      page.appendChild(ticketCard);
    }
  }

  function patchCopyHandlers(root) {
    if (!root || root.getAttribute('data-sdlg-portal-copy-patched') === '1') return;
    root.addEventListener('click', async function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-sdlg-copy]') : null;
      if (!btn || !root.contains(btn)) return;
      var targetSel = btn.getAttribute('data-target');
      var el = targetSel ? root.querySelector(targetSel) : null;
      if (!el) {
        var wrap = btn.closest('div');
        el = wrap ? wrap.querySelector('[data-sdlg-field]') : null;
      }
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      var ok = await writeClipboard(formatForSDLG(el.value, typeForLabel(el.getAttribute('data-label'))));
      var old = btn.textContent; btn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(function () { if (btn.isConnected) btn.textContent = old; }, 1200);
    }, true);

    var allBtn = root.querySelector('[data-sdlg-copy-all]');
    if (allBtn && !allBtn.getAttribute('data-sdlg-all-wired')) {
      allBtn.setAttribute('data-sdlg-all-wired', '1');
      allBtn.addEventListener('click', async function (e) {
        e.preventDefault(); e.stopPropagation();
        var problems = validateFields(root);
        if (problems.length) toast('Peringatan: ' + problems.slice(0, 5).join('; ') + ' — copy dilanjutkan.', 'warn');
        var order = ['Service Type','Service Method','Serial number','Hour meter','Whole Machine Warranty','Failure Date','Date of repair report','Feedback Person','Feedback Contact Information','Complaint','Fault Details','Machine Location','Repair Labor (Hrs)','Service Mileage (Km)','Logistics Backfill Document'];
        var map = readFieldMap(root);
        var lines = [];
        var seen = {};
        order.forEach(function (label) {
          var el = map[label];
          if (!el || seen[label]) return;
          seen[label] = true;
          lines.push(label + ': ' + formatForSDLG(el.value, typeForLabel(label)));
        });
        await writeClipboard(lines.join('\n'));
        var old = allBtn.textContent; allBtn.textContent = 'Copied';
        setTimeout(function () { if (allBtn.isConnected) allBtn.textContent = old; }, 1200);
      }, true);
    }
    root.setAttribute('data-sdlg-portal-copy-patched', '1');
  }

  function enhance() {
    var root = findHelperRoot();
    if (!root) return;
    try {
      ensureExtraFields(root);
      if (root.getAttribute('data-sdlg-portal-copy-patched') !== '1') patchCopyHandlers(root);
    } catch (err) { console.warn('[SDLG portal-copy]', err); }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(enhance, 250); }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPortalCopyHelper = { version: '1.2.0', formatForSDLG: formatForSDLG, validateFields: validateFields, enhance: enhance };
})(window);
