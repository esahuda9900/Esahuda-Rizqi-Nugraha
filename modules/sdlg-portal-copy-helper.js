/**
 * SDLG Portal Copy Helper v1.0.0
 * Match Dynamics 365 Dealer Portal field order + copy formats.
 * Does not change warranty business logic; enhances SDLG Input Helper UX only.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_PORTAL_COPY_HELPER_V1__) return;
  root.__SDLG_PORTAL_COPY_HELPER_V1__ = true;

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
    if (type === 'text') {
      return String(value).trim().replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n');
    }
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
    if (!document.querySelector('style[data-sdlg-portal-toast]')) {
      var st = document.createElement('style');
      st.setAttribute('data-sdlg-portal-toast', '1');
      st.textContent = '.sdlg-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100000;max-width:min(520px,92vw);padding:10px 14px;border-radius:8px;background:#0f172a;color:#fff;font:500 13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(15,23,42,.2)}.sdlg-toast-warn{background:#854d0e}';
      (document.head || document.documentElement).appendChild(st);
    }
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
    var nodes = document.querySelectorAll('[data-sdlg-field]');
    if (!nodes.length) return null;
    var el = nodes[0];
    for (var i = 0; i < 12 && el; i++) {
      if (el.querySelector && el.querySelector('[data-sdlg-copy-all]')) return el;
      el = el.parentElement;
    }
    var all = document.querySelector('[data-sdlg-copy-all]');
    return all ? all.closest('.card') || all.parentElement : null;
  }

  function readFieldMap(root) {
    var map = {};
    root.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
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
      var val = el ? String(el.value || '').trim() : '';
      if (!el || !val) { problems.push(label + ' kosong'); return; }
      var t = typeForLabel(label);
      if (t === 'date' && !/^\d{2}\/\d{2}\/\d{4}$/.test(val) && !/^\d{4}-\d{2}-\d{2}/.test(val)) problems.push(label + ' tanggal invalid');
      if (t === 'number') {
        var n = Number(String(val).replace(',', '.').replace(/\s*(hr|hrs|hours|km)\s*$/i, ''));
        if (!Number.isFinite(n)) problems.push(label + ' angka invalid');
      }
    });
    return problems;
  }

  function makeFieldRow(key, label, value, required) {
    var wrap = document.createElement('div');
    wrap.className = 'sdlg-portal-field';
    wrap.setAttribute('data-sdlg-portal-extra', key);
    var head = document.createElement('div');
    head.className = 'sdlg-portal-field-head';
    var lab = document.createElement('label');
    lab.className = 'sdlg-portal-field-label';
    lab.textContent = label + (required ? ' *' : '');
    head.appendChild(lab);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-btn';
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
    control.id = 'sdlg_extra_' + key;
    control.className = 'sdlg-portal-field-control';
    control.setAttribute('data-sdlg-field', '1');
    control.setAttribute('data-label', label);
    wrap.appendChild(control);
    btn.addEventListener('click', async function () {
      if (REQUIRED.indexOf(label) >= 0 && !String(control.value || '').trim()) toast('Peringatan: ' + label + ' kosong — tetap di-copy.', 'warn');
      var ok = await writeClipboard(formatForSDLG(control.value, typeForLabel(label)));
      var old = btn.textContent; btn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(function () { if (btn.isConnected) btn.textContent = old; }, 1200);
    });
    return wrap;
  }

  function makeSection(title, subtitle) {
    var card = document.createElement('div');
    card.className = 'card card-pad sdlg-portal-section';
    var eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Dealer Portal';
    var h = document.createElement('div');
    h.className = 'page-title';
    h.textContent = title;
    card.appendChild(eyebrow);
    card.appendChild(h);
    if (subtitle) {
      var sub = document.createElement('div');
      sub.className = 'page-sub';
      sub.textContent = subtitle;
      card.appendChild(sub);
    }
    return card;
  }

  function ensureExtraFields(root) {
    if (!root || root.getAttribute('data-sdlg-portal-enhanced') === '1') return;
    var map = readFieldMap(root);
    if (!map['Serial number'] && !map['Service Type']) return;

    if (!map['Date of repair report']) {
      var failEl = map['Failure Date'];
      var row = makeFieldRow('repairReportDate', 'Date of repair report', '', true);
      if (failEl && failEl.parentElement) {
        var failWrap = failEl.parentElement;
        if (failWrap.parentElement) failWrap.parentElement.insertBefore(row, failWrap.nextSibling);
        else root.appendChild(row);
      } else root.appendChild(row);
    }

    if (!map['Logistics Backfill Document']) {
      var mile = map['Service Mileage (Km)'] || map['Service Mileage'];
      var logRow = makeFieldRow('logisticsBackfill', 'Logistics Backfill Document', 'No', false);
      if (mile && mile.parentElement && mile.parentElement.parentElement) {
        mile.parentElement.parentElement.insertBefore(logRow, mile.parentElement.nextSibling);
      } else root.appendChild(logRow);
    }

    var page = root.parentElement || root;
    if (!page.querySelector('[data-sdlg-iov-section]')) {
      var iovCard = makeSection('IoV Information', 'Timestamp fields — kosong jika tidak ada di claim.');
      iovCard.setAttribute('data-sdlg-iov-section', '1');
      var labels = ['IoV Address','Service Node','Service Dispatch Time','Scheduled Service Time','Service Interruption Time','Service Rejection Time','Service Response Time','Service Departure Time','Return Time','Service Cancellation Time','Rescheduled Time','Service Arrival Time','Service Completion Time','Submission Time'];
      labels.forEach(function (lab, idx) {
        iovCard.appendChild(makeFieldRow('iov' + idx, lab, '', false));
      });
      var copyIov = document.createElement('button');
      copyIov.type = 'button';
      copyIov.className = 'secondary-btn';
      copyIov.textContent = 'Copy IoV Information';
      copyIov.addEventListener('click', async function () {
        var lines = [];
        iovCard.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
          lines.push((el.getAttribute('data-label') || '') + ': ' + formatForSDLG(el.value, typeForLabel(el.getAttribute('data-label'))));
        });
        await writeClipboard(lines.join('\n'));
        toast('IoV Information di-copy.');
      });
      iovCard.appendChild(copyIov);
      page.appendChild(iovCard);
    }

    if (!page.querySelector('[data-sdlg-ticket-section]')) {
      var ticketCard = makeSection('Service Support Ticket', 'Nomor ticket support bila ada.');
      ticketCard.setAttribute('data-sdlg-ticket-section', '1');
      ticketCard.appendChild(makeFieldRow('supportTicket', 'Service Support Ticket', '', false));
      page.appendChild(ticketCard);
    }

    if (!page.querySelector('[data-sdlg-attach-section]')) {
      var attCard = makeSection('Attachments', 'Daftar file dari claim (nama untuk copy ke portal).');
      attCard.setAttribute('data-sdlg-attach-section', '1');
      var list = document.createElement('div');
      list.className = 'sdlg-portal-attach-list';
      list.textContent = 'Tidak ada attachment metadata di claim ini.';
      attCard.appendChild(list);
      var copyAtt = document.createElement('button');
      copyAtt.type = 'button';
      copyAtt.className = 'secondary-btn';
      copyAtt.textContent = 'Copy File Names';
      copyAtt.addEventListener('click', async function () {
        var names = Array.from(attCard.querySelectorAll('[data-sdlg-attach-name]')).map(function (el) { return el.getAttribute('data-sdlg-attach-name') || ''; }).filter(Boolean);
        await writeClipboard(names.join('\n'));
        toast(names.length ? 'Nama file di-copy.' : 'Tidak ada nama file.');
      });
      attCard.appendChild(copyAtt);
      page.appendChild(attCard);
    }

    root.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
      var label = el.getAttribute('data-label') || '';
      var t = typeForLabel(label);
      if (t === 'number' || t === 'date') {
        var next = formatForSDLG(el.value, t);
        if (next && next !== el.value) el.value = next;
      }
    });

    root.setAttribute('data-sdlg-portal-enhanced', '1');
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
      e.preventDefault();
      e.stopPropagation();
      var label = el.getAttribute('data-label') || '';
      if (REQUIRED.indexOf(label) >= 0 && !String(el.value || '').trim()) toast('Peringatan: ' + label + ' kosong — tetap di-copy.', 'warn');
      var ok = await writeClipboard(formatForSDLG(el.value, typeForLabel(label)));
      var old = btn.textContent; btn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(function () { if (btn.isConnected) btn.textContent = old; }, 1200);
    }, true);

    var allBtn = root.querySelector('[data-sdlg-copy-all]');
    if (allBtn) {
      allBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        var problems = validateFields(root);
        if (problems.length) toast('Peringatan field: ' + problems.slice(0, 6).join('; ') + (problems.length > 6 ? '…' : '') + ' — copy tetap dilanjutkan.', 'warn');
        var order = ['Service Type','Service Method','Serial number','Hour meter','Whole Machine Warranty','Failure Date','Date of repair report','Feedback Person','Feedback Contact Information','Complaint','Fault Details','Machine Location','Repair Labor (Hrs)','Repair Labor','Service Mileage (Km)','Service Mileage','Logistics Backfill Document'];
        var map = readFieldMap(root);
        var lines = [];
        var seen = {};
        order.forEach(function (label) {
          var el = map[label];
          if (!el || seen[label]) return;
          seen[label] = true;
          lines.push(label + ': ' + formatForSDLG(el.value, typeForLabel(label)));
        });
        Object.keys(map).forEach(function (label) {
          if (seen[label]) return;
          if (/Labour Amount|Mileage Amount|Other Amount|Total Amount/i.test(label)) return;
          lines.push(label + ': ' + formatForSDLG(map[label].value, typeForLabel(label)));
        });
        var partRows = Array.from(root.querySelectorAll('[data-sdlg-part]'));
        if (partRows.length) {
          lines.push('');
          lines.push('Replacement Record Details');
          lines.push(['Failure Part','Replace Part','Description','Qty','Unit Price','Amount'].join('\t'));
          partRows.forEach(function (el) { lines.push(el.getAttribute('data-sdlg-part') || el.getAttribute('data-value') || ''); });
        }
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
    try { ensureExtraFields(root); patchCopyHandlers(root); }
    catch (err) { console.warn('[SDLG portal-copy]', err); }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(enhance, 400); }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGPortalCopyHelper = { version: '1.0.0', formatForSDLG: formatForSDLG, validateFields: validateFields, enhance: enhance };
})(window);
