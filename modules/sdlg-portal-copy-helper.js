/**
 * SDLG Portal Copy Helper v1.3.0
 * - 14 IoV fields (read-only display + copy)
 * - Date of repair before Complaint
 * - Logistics half-width in Home grid
 * - Idempotent after React re-render
 */
(function (root) {
  'use strict';
  root.__SDLG_PORTAL_COPY_HELPER_V1__ = true;
  if (root.__SDLG_PORTAL_COPY_HELPER_V13__) return;
  root.__SDLG_PORTAL_COPY_HELPER_V13__ = true;

  var IOV_LABELS = [
    'IoV Address',
    'Service Node',
    'Service Dispatch Time',
    'Scheduled Service Time',
    'Service Interruption Time',
    'Service Rejection Time',
    'Service Response Time',
    'Service Departure Time',
    'Return Time',
    'Service Cancellation Time',
    'Rescheduled Time',
    'Service Arrival Time',
    'Service Completion Time',
    'Submission Time'
  ];

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
    if (type === 'datetime') {
      var ds = String(value).trim();
      var dm = ds.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (dm) return dm[3] + '/' + dm[2] + '/' + dm[1] + ' ' + dm[4] + ':' + dm[5];
      return ds;
    }
    if (type === 'text') return String(value).trim().replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n');
    return String(value);
  }
  root.SDLGFormatForPortal = formatForSDLG;

  var NUMBER_LABELS = /hour meter|repair labor|service mileage|qty|unit price|amount|labour|mileage|other amount|total amount/i;
  var DATE_LABELS = /failure date|date of repair report|repair report/i;
  var DATETIME_LABELS = /service dispatch|scheduled service|service interruption|service rejection|service response|service departure|return time|service cancellation|rescheduled|service arrival|service completion|submission time/i;

  function typeForLabel(label) {
    var L = String(label || '');
    if (DATETIME_LABELS.test(L)) return 'datetime';
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

  function findHomeGrid(root) {
    var serial = root.querySelector('[data-sdlg-field][data-label="Serial number"], [data-sdlg-field][data-label="Service Type"]');
    if (serial) {
      var p = serial.parentElement;
      for (var i = 0; i < 6 && p; i++) {
        try {
          var cs = window.getComputedStyle(p);
          if (cs && cs.display === 'grid') return p;
        } catch (_) {}
        p = p.parentElement;
      }
    }
    return root;
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

  function makeEditableField(key, label, value, required) {
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

  function makeReadonlyField(label, value) {
    var wrap = document.createElement('div');
    wrap.className = 'sdlg-portal-field sdlg-field-wrap sdlg-portal-field-ro';
    wrap.setAttribute('data-sdlg-portal-extra', 'iov');
    var head = document.createElement('div');
    head.className = 'sdlg-portal-field-head';
    var lab = document.createElement('div');
    lab.className = 'sdlg-portal-field-label';
    lab.textContent = label;
    head.appendChild(lab);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-btn sdlg-copy-hover';
    btn.setAttribute('data-sdlg-copy', '1');
    btn.textContent = 'Copy';
    head.appendChild(btn);
    wrap.appendChild(head);
    var val = document.createElement('div');
    val.className = 'sdlg-portal-ro-value' + (value ? '' : ' is-empty');
    val.setAttribute('data-sdlg-field', '1');
    val.setAttribute('data-label', label);
    val.setAttribute('data-value', value || '');
    Object.defineProperty(val, 'value', {
      get: function () { return this.getAttribute('data-value') || ''; },
      set: function (v) {
        this.setAttribute('data-value', v || '');
        this.textContent = v ? String(v) : '\u2014';
        this.classList.toggle('is-empty', !v);
      }
    });
    val.textContent = value ? String(value) : '\u2014';
    wrap.appendChild(val);
    btn.addEventListener('click', async function () {
      var ok = await writeClipboard(formatForSDLG(val.value, typeForLabel(label)));
      var old = btn.textContent; btn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(function () { if (btn.isConnected) btn.textContent = old; }, 1200);
    });
    return wrap;
  }

  function insertBeforeField(map, beforeLabel, row) {
    var ref = map[beforeLabel];
    if (!ref) return false;
    var wrap = ref.closest('.sdlg-portal-field') || ref.parentElement;
    if (wrap && wrap.parentElement) {
      wrap.parentElement.insertBefore(row, wrap);
      return true;
    }
    return false;
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
    var grid = findHomeGrid(root);

    if (!map['Date of repair report']) {
      var row = makeEditableField('repairReportDate', 'Date of repair report', '', true);
      if (!insertBeforeField(map, 'Complaint', row) && !insertAfterField(map, 'Failure Date', row)) {
        grid.appendChild(row);
      }
    }

    map = readFieldMap(root);
    if (!map['Logistics Backfill Document']) {
      var logRow = makeEditableField('logisticsBackfill', 'Logistics Backfill Document', 'No', false);
      logRow.classList.add('sdlg-logistics-half');
      if (!insertAfterField(map, 'Service Mileage (Km)', logRow) && !insertAfterField(map, 'Service Mileage', logRow)) {
        grid.appendChild(logRow);
      }
      if (!grid.querySelector('[data-sdlg-logistics-spacer]')) {
        var spacer = document.createElement('div');
        spacer.setAttribute('data-sdlg-logistics-spacer', '1');
        spacer.className = 'sdlg-logistics-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        if (logRow.parentElement) logRow.parentElement.insertBefore(spacer, logRow.nextSibling);
      }
    }

    var page = root.closest('.page') || root.parentElement || root;
    var iov = page.querySelector('[data-sdlg-iov-section]');
    if (!iov) {
      iov = document.createElement('div');
      iov.className = 'card card-pad sdlg-portal-section';
      iov.setAttribute('data-sdlg-iov-section', '1');
      iov.setAttribute('data-sdlg-section-role', 'iov');
      var eb = document.createElement('div'); eb.className = 'eyebrow'; eb.textContent = 'Dealer Portal';
      var ti = document.createElement('div'); ti.className = 'page-title'; ti.textContent = 'IoV Information';
      var su = document.createElement('div'); su.className = 'page-sub'; su.textContent = 'Timestamp fields \u2014 kosong jika tidak ada di claim.';
      iov.appendChild(eb); iov.appendChild(ti); iov.appendChild(su);
      var gridIov = document.createElement('div');
      gridIov.className = 'sdlg-portal-iov-grid';
      gridIov.setAttribute('data-sdlg-iov-grid', '1');
      IOV_LABELS.forEach(function (lab) {
        gridIov.appendChild(makeReadonlyField(lab, ''));
      });
      iov.appendChild(gridIov);
      page.appendChild(iov);
    } else {
      var gridIov2 = iov.querySelector('[data-sdlg-iov-grid], .sdlg-portal-iov-grid');
      if (!gridIov2) {
        gridIov2 = document.createElement('div');
        gridIov2.className = 'sdlg-portal-iov-grid';
        gridIov2.setAttribute('data-sdlg-iov-grid', '1');
        iov.appendChild(gridIov2);
      }
      var have = {};
      gridIov2.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
        have[el.getAttribute('data-label') || ''] = el;
      });
      var missing = IOV_LABELS.filter(function (l) { return !have[l]; });
      if (missing.length || Object.keys(have).length !== IOV_LABELS.length) {
        gridIov2.innerHTML = '';
        IOV_LABELS.forEach(function (lab) {
          var prev = have[lab];
          var v = prev ? (prev.value || prev.getAttribute('data-value') || '') : '';
          gridIov2.appendChild(makeReadonlyField(lab, v));
        });
      }
    }

    if (!page.querySelector('[data-sdlg-ticket-section]')) {
      var ticketCard = document.createElement('div');
      ticketCard.className = 'card card-pad sdlg-portal-section';
      ticketCard.setAttribute('data-sdlg-ticket-section', '1');
      var eb2 = document.createElement('div'); eb2.className = 'eyebrow'; eb2.textContent = 'Dealer Portal';
      var ti2 = document.createElement('div'); ti2.className = 'page-title'; ti2.textContent = 'Service Support Ticket';
      ticketCard.appendChild(eb2); ticketCard.appendChild(ti2);
      ticketCard.appendChild(makeEditableField('supportTicket', 'Service Support Ticket', '', false));
      page.appendChild(ticketCard);
    }
  }

  function patchCopyHandlers(root) {
    if (!root || root.getAttribute('data-sdlg-portal-copy-patched') === '1') return;
    root.addEventListener('click', async function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-sdlg-copy]') : null;
      if (!btn || !root.contains(btn)) return;
      var wrap = btn.closest('.sdlg-portal-field, .sdlg-field-wrap, div');
      var el = wrap ? wrap.querySelector('[data-sdlg-field]') : null;
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
        if (problems.length) toast('Peringatan: ' + problems.slice(0, 5).join('; ') + ' \u2014 copy dilanjutkan.', 'warn');
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

  root.SDLGPortalCopyHelper = {
    version: '1.3.0',
    IOV_LABELS: IOV_LABELS,
    formatForSDLG: formatForSDLG,
    validateFields: validateFields,
    enhance: enhance
  };
})(window);
