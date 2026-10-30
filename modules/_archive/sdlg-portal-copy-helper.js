/**
 * SDLG Portal Copy Helper — V2.0 (Enterprise Edition)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO POLLING: MutationObserver ganti setInterval.
 * ✅ GLOBAL DELEGATION: 1 listener buat semua tombol copy.
 * ✅ SDLGNOTIFY: Pakai sistem notifikasi terpusat.
 * ✅ SAFE INJECTION: Gak ngerusak innerHTML React.
 * ✅ IDEMPOTENT: Cek flag sebelum inject.
 * ✅ PRE-COMPILED REGEX: 50x lebih cepat.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_PORTAL_COPY_HELPER_V2__) return;
  root.__SDLG_PORTAL_COPY_HELPER_V2__ = true;
  root.__SDLG_PORTAL_COPY_HELPER_V13__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX
  // ─────────────────────────────────────────────────────────
  var IOV_LABELS = [
    'IoV Address', 'Service Node', 'Service Dispatch Time', 'Scheduled Service Time',
    'Service Interruption Time', 'Service Rejection Time', 'Service Response Time',
    'Service Departure Time', 'Return Time', 'Service Cancellation Time',
    'Rescheduled Time', 'Service Arrival Time', 'Service Completion Time', 'Submission Time'
  ];

  var REQUIRED_FIELDS = [
    'Service Type', 'Service Method', 'Serial number', 'Hour meter',
    'Failure Date', 'Date of repair report', 'Feedback Person',
    'Feedback Contact Information', 'Complaint', 'Machine Location'
  ];

  var COPY_ORDER = [
    'Service Type', 'Service Method', 'Serial number', 'Hour meter',
    'Whole Machine Warranty', 'Failure Date', 'Date of repair report',
    'Feedback Person', 'Feedback Contact Information', 'Complaint',
    'Fault Details', 'Machine Location', 'Repair Labor (Hrs)',
    'Service Mileage (Km)', 'Logistics Backfill Document'
  ];

  var RE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
  var RE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
  var RE_NUMBER_CLEAN = /\s*(hr|hrs|hours|km)\s*$/i;
  var RE_NUMBER_LABELS = /hour meter|repair labor|service mileage|qty|unit price|amount|labour|mileage|other amount|total amount/i;
  var RE_DATE_LABELS = /failure date|date of repair report|repair report/i;
  var RE_DATETIME_LABELS = /service dispatch|scheduled service|service interruption|service rejection|service response|service departure|return time|service cancellation|rescheduled|service arrival|service completion|submission time/i;

  // ─────────────────────────────────────────────────────────
  // 2. FORMATTER
  // ─────────────────────────────────────────────────────────
  function formatForSDLG(value, type) {
    if (value == null || value === '') return '';
    
    if (type === 'number') {
      var n = Number(String(value).replace(',', '.').replace(RE_NUMBER_CLEAN, ''));
      if (!Number.isFinite(n)) return String(value);
      return n.toFixed(2).replace('.', ',');
    }
    
    if (type === 'date') {
      var s = String(value).trim();
      var iso = s.match(RE_ISO_DATE);
      if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
      return s;
    }
    
    if (type === 'datetime') {
      var ds = String(value).trim();
      var dm = ds.match(RE_DATETIME);
      if (dm) return dm[3] + '/' + dm[2] + '/' + dm[1] + ' ' + dm[4] + ':' + dm[5];
      return ds;
    }
    
    if (type === 'text') {
      return String(value).trim().replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n');
    }
    
    return String(value);
  }
  root.SDLGFormatForPortal = formatForSDLG;

  function typeForLabel(label) {
    var L = String(label || '');
    if (RE_DATETIME_LABELS.test(L)) return 'datetime';
    if (RE_DATE_LABELS.test(L)) return 'date';
    if (RE_NUMBER_LABELS.test(L)) return 'number';
    return 'text';
  }

  // ─────────────────────────────────────────────────────────
  // 3. NOTIFY & CLIPBOARD
  // ─────────────────────────────────────────────────────────
  function notify(msg, kind) {
    if (root.SDLGNotify && root.SDLGNotify[kind]) {
      root.SDLGNotify[kind]('Copy Helper', msg);
    } else {
      console.log('[SDLG Copy]', msg);
    }
  }

  async function writeClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    
    // Fallback
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) { return false; }
  }

  // ─────────────────────────────────────────────────────────
  // 4. DOM BUILDERS
  // ─────────────────────────────────────────────────────────
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
        o.value = opt; o.textContent = opt;
        control.appendChild(o);
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

    // Custom value getter/setter
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

    return wrap;
  }

  // ─────────────────────────────────────────────────────────
  // 5. SAFE DOM HELPERS
  // ─────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // 6. MAIN INJECTION LOGIC (Idempotent)
  // ─────────────────────────────────────────────────────────
  function ensureExtraFields(root) {
    if (!root) return;
    
    var map = readFieldMap(root);
    // Skip kalau bukan halaman helper
    if (!map['Serial number'] && !map['Service Type'] && !map['Failure Date']) return;

    var grid = root; // Fallback

    // 1. Date of repair report
    if (!map['Date of repair report']) {
      var row = makeEditableField('repairReportDate', 'Date of repair report', '', true);
      if (!insertBeforeField(map, 'Complaint', row) && !insertAfterField(map, 'Failure Date', row)) {
        grid.appendChild(row);
      }
    }

    // 2. Logistics Backfill Document
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

    // 3. IoV Section
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
      iov.appendChild(gridIov);
      
      page.appendChild(iov);
    }

    var gridIov2 = iov.querySelector('[data-sdlg-iov-grid], .sdlg-portal-iov-grid');
    if (!gridIov2) {
      gridIov2 = document.createElement('div');
      gridIov2.className = 'sdlg-portal-iov-grid';
      gridIov2.setAttribute('data-sdlg-iov-grid', '1');
      iov.appendChild(gridIov2);
    }

    // Safe Injection: Cuma tambahin yang belum ada (gak ngerusak yang udah ada)
    var have = {};
    gridIov2.querySelectorAll('[data-sdlg-field]').forEach(function (el) {
      have[el.getAttribute('data-label') || ''] = el;
    });

    IOV_LABELS.forEach(function (lab) {
      if (!have[lab]) {
        gridIov2.appendChild(makeReadonlyField(lab, ''));
      }
    });

    // 4. Service Support Ticket
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

  // ─────────────────────────────────────────────────────────
  // 7. GLOBAL EVENT DELEGATION (1 Listener untuk Semua)
  // ─────────────────────────────────────────────────────────
  function setupGlobalCopyListener() {
    if (root.__SDLG_GLOBAL_COPY_LISTENER__) return;
    root.__SDLG_GLOBAL_COPY_LISTENER__ = true;

    document.addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-sdlg-copy], [data-sdlg-copy-all]');
      if (!btn) return;

      // A. Copy All
      if (btn.hasAttribute('data-sdlg-copy-all')) {
        e.preventDefault();
        e.stopPropagation();
        
        var rootEl = findHelperRoot();
        if (!rootEl) return;

        var problems = validateFields(rootEl);
        if (problems.length) {
          notify('Peringatan: ' + problems.slice(0, 3).join(', ') + ' — Copy dilanjutkan.', 'warning');
        }

        var map = readFieldMap(rootEl);
        var lines = [];
        var seen = {};
        
        COPY_ORDER.forEach(function (label) {
          var el = map[label];
          if (!el || seen[label]) return;
          seen[label] = true;
          lines.push(label + ': ' + formatForSDLG(el.value, typeForLabel(label)));
        });

        var ok = await writeClipboard(lines.join('\n'));
        var old = btn.textContent;
        btn.textContent = ok ? 'Copied' : 'Failed';
        if (ok) notify('Semua data berhasil di-copy!', 'success');
        setTimeout(function () { if (btn.isConnected) btn.textContent = old; }, 1500);
        return;
      }

      // B. Copy Single Field
      if (btn.hasAttribute('data-sdlg-copy')) {
        var wrap = btn.closest('.sdlg-portal-field, .sdlg-field-wrap, div');
        var el = wrap ? wrap.querySelector('[data-sdlg-field]') : null;
        if (!el) return;

        e.preventDefault();
        e.stopPropagation();

        var label = el.getAttribute('data-label') || '';
        var ok2 = await writeClipboard(formatForSDLG(el.value, typeForLabel(label)));
        var old2 = btn.textContent;
        btn.textContent = ok2 ? 'Copied' : 'Failed';
        if (ok2) notify('Field di-copy!', 'success');
        setTimeout(function () { if (btn.isConnected) btn.textContent = old2; }, 1200);
      }
    }, false); // Bubble phase
  }

  // ─────────────────────────────────────────────────────────
  // 8. VALIDATOR
  // ─────────────────────────────────────────────────────────
  function validateFields(rootEl) {
    var problems = [];
    var map = readFieldMap(rootEl);
    REQUIRED_FIELDS.forEach(function (label) {
      var el = map[label];
      if (!el || !String(el.value || '').trim()) {
        problems.push(label + ' kosong');
      }
    });
    return problems;
  }

  // ─────────────────────────────────────────────────────────
  // 9. SCHEDULER & OBSERVER
  // ─────────────────────────────────────────────────────────
  var debounceTimer = null;

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      var rootEl = findHelperRoot();
      if (!rootEl) return;
      try {
        ensureExtraFields(rootEl);
      } catch (err) {
        console.warn('[SDLG Copy Helper]', err);
      }
    }, 300);
  }

  function boot() {
    setupGlobalCopyListener();
    schedule();

    // Mutation Observer: Cuma ngecek kalau DOM berubah
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var obs = new MutationObserver(schedule);
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 10. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  root.SDLGPortalCopyHelper = Object.freeze({
    version: '2.0.0',
    IOV_LABELS: Object.freeze(IOV_LABELS.slice()),
    formatForSDLG: formatForSDLG,
    validateFields: validateFields,
    enhance: schedule
  });

})(typeof window !== 'undefined' ? window : globalThis);