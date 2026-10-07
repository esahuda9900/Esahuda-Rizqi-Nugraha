/**
 * SDLG Input Helper — Dynamics 365 portal mirror v1.5.5
 * Page detect: require helper title; ignore global nav (Master Data etc. always in chrome).
 * Only remove panel when clearly on another module.
 * Column fix: SELECT uses real claims columns only; Service Type/Feedback Contact hardcoded.
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_MIRROR_155__) return;
  window.__SDLG_PORTAL_MIRROR_155__ = true;

  var PANEL_ID = 'sdlg-dynamics-portal-mirror';
  var CLAIM_RE = /\b(\d{4}-\d{4}-SDLG-PFR)\b/;
  var SELECT =
    'claim_id,model,customer,serial_no,repair_method,technical_personnel,fault_description,' +
    'cause_analyze,comment,hm_failure,hm_completion,failure_date,dealer_repair_date,completion_date,' +
    'mileage_km,failure_part_location,branch,dealer_claim_no,dealer_wo_so';

  var HOME_FIELDS = [
    { key: 'service_type', label: 'Service Type', required: true },
    { key: 'service_method', label: 'Service Method', required: true },
    { key: 'serial_no', label: 'Serial number', required: true },
    { key: 'hm_failure', label: 'Hour meter', required: true },
    { key: 'whole_machine', label: 'Whole Machine Warranty', required: false },
    { key: 'failure_date', label: 'Failure Date', required: true },
    { key: 'repair_report_date', label: 'Date of repair report', required: true, highlight: true },
    { key: 'feedback_person', label: 'Feedback Person', required: true },
    { key: 'feedback_contact', label: 'Feedback Contact Information', required: true },
    { key: 'complaint', label: 'Complaint', required: true },
    { key: 'fault_details', label: 'Fault Details', required: false, wide: true },
    { key: 'machine_location', label: 'Machine Location', required: true },
    { key: 'repair_labor', label: 'Repair Labor', required: false },
    { key: 'service_mileage', label: 'Service Mileage', required: false },
    { key: 'logistics_backfill', label: 'Logistics Backfill Document', required: false }
  ];

  function clean(v) {
    return v == null ? '' : String(v).trim();
  }
  function blank(v) {
    var s = clean(v);
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || /^kosong$/i.test(s) || /^unknown$/i.test(s);
  }
  function portalDate(v) {
    var s = clean(v);
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    return s;
  }
  function portalNum(v) {
    if (v == null || v === '') return '';
    var n = Number(String(v).replace(/,/g, '.').replace(/[^0-9.\-]/g, ''));
    if (!isFinite(n)) return clean(v);
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return n.toFixed(2).replace('.', ',');
  }
  function personName(v) {
    var name = clean(v).replace(/^technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
    if (!name || /^unknown$/i.test(name)) return '';
    return name;
  }
  function escapeHtml(v) {
    return clean(v).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[ch];
    });
  }

  function contentRoot() {
    return document.querySelector('.page') || document.querySelector('main') || document.body;
  }

  /**
   * Positive detection only.
   * Nav always contains "Master Data" / "Unit 360" — never use those as excludes on full page text.
   */
  function isInputHelperPage() {
    try {
      if (document.querySelector('[data-sdlg-input-helper="1"]')) return true;

      var root = contentRoot();
      if (!root) return false;
      var text = clean(root.innerText || '');

      // Must have helper title (unique to this screen)
      if (!/Warranty Claim Input Helper/i.test(text)) return false;

      // Must look like the helper detail (Dealer Portal section or pre-fill note)
      if (!/Dealer Portal/i.test(text) && !/Field sudah dipre-fill/i.test(text)) return false;

      // Explicit other-module bodies (unique copy, not nav labels)
      if (/\+\s*Tambah Customer/i.test(text) && /Reference data utama/i.test(text)) return false;
      if (/Machines\s*\/\s*Units/i.test(text) && /Tambah Customer/i.test(text)) return false;

      return true;
    } catch (e) {
      return false;
    }
  }

  function removePanel() {
    var el = document.getElementById(PANEL_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function claimIdFromHelper() {
    if (!isInputHelperPage()) return '';

    var root = contentRoot();
    var scope = root || document.body;

    var selects = scope.querySelectorAll('select');
    for (var i = 0; i < selects.length; i++) {
      var sel = selects[i];
      var val = clean(sel.value);
      var m = val.match(CLAIM_RE);
      if (m) return m[1];
      var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      if (opt) {
        m = clean(opt.textContent || opt.value).match(CLAIM_RE);
        if (m) return m[1];
      }
    }

    var marked = scope.querySelectorAll('[data-claim-id], [data-active-claim]');
    for (var j = 0; j < marked.length; j++) {
      var el = marked[j];
      var attr = clean(el.getAttribute('data-claim-id') || el.getAttribute('data-active-claim'));
      var am = attr.match(CLAIM_RE);
      if (am) return am[1];
    }

    var text = clean(scope.innerText || '');
    var idx = text.search(/Warranty Claim Input Helper/i);
    var after = idx >= 0 ? text.slice(idx, idx + 2000) : text.slice(0, 2000);
    var hm = after.match(CLAIM_RE);
    if (hm) return hm[1];

    var back = text.match(/\u2190\s*Kembali[\s\S]{0,200}?(\d{4}-\d{4}-SDLG-PFR)/i);
    if (back) return back[1];

    // CLAIM block
    var cur = text.match(/\bCLAIM\b[\s\S]{0,40}?(\d{4}-\d{4}-SDLG-PFR)/i);
    if (cur) return cur[1];

    // Claim line under helper: 0250-2026-SDLG-PFR · MODEL · CUSTOMER
    var line = after.match(/(\d{4}-\d{4}-SDLG-PFR)\s*·/);
    if (line) return line[1];

    return '';
  }

  function supabase() {
    var names = ['sdlgSupabase', 'supabaseClient', 'sb', 'db', 'SDLGSupabase', 'SDLG_DB'];
    for (var i = 0; i < names.length; i++) {
      var c = window[names[i]];
      if (c && typeof c.from === 'function') return c;
    }
    return null;
  }

  function warrantyLabelFromPage() {
    if (!isInputHelperPage()) return '';
    var root = contentRoot();
    var t = root ? clean(root.innerText) : '';
    if (/🟢\s*IN WARRANTY/i.test(t)) return 'In Warranty';
    if (/\bIN WARRANTY\b/i.test(t) && !/OUT OF WARRANTY/i.test(t.slice(0, 1200))) return 'In Warranty';
    if (/OUT OF WARRANTY/i.test(t)) return 'Out of Warranty';
    return 'In Warranty';
  }

  function mapClaimToValues(claim) {
    claim = claim || {};
    var person = personName(claim.technical_personnel);
    var fault = [clean(claim.cause_analyze), clean(claim.comment)].filter(Boolean).join('\n');
    var loc = clean(claim.failure_part_location) || clean(claim.branch);
    var wo = clean(claim.dealer_wo_so);
    if (wo && loc && loc.indexOf(wo) < 0) {
      loc = wo + ' ' + loc;
    }
    return {
      service_type: 'Repair',
      service_method: clean(claim.repair_method) || 'Onsite Repair',
      serial_no: clean(claim.serial_no),
      hm_failure: portalNum(claim.hm_failure),
      whole_machine: warrantyLabelFromPage() || 'In Warranty',
      failure_date: portalDate(claim.failure_date),
      repair_report_date: portalDate(claim.dealer_repair_date || claim.completion_date || ''),
      feedback_person: person,
      feedback_contact: 'xxx',
      complaint: clean(claim.fault_description),
      fault_details: fault,
      machine_location: loc,
      repair_labor: portalNum(claim.hm_completion),
      service_mileage: portalNum(claim.mileage_km),
      logistics_backfill: 'No'
    };
  }

  function copyText(text, btn) {
    var t = String(text == null ? '' : text);
    if (!t || blank(t)) {
      if (btn) {
        btn.textContent = 'Empty';
        btn.disabled = true;
      }
      return;
    }
    function done() {
      if (!btn) return;
      var prev = btn.getAttribute('data-label-orig') || 'Copy';
      btn.textContent = 'Copied';
      setTimeout(function () {
        btn.textContent = prev;
      }, 1100);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(done).catch(function () {
          if (fallbackCopy(t)) done();
        });
        return;
      }
    } catch (e) {}
    if (fallbackCopy(t)) done();
  }
  function fallbackCopy(t) {
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function findMountPoint() {
    var marked = document.querySelector('[data-sdlg-input-helper="1"]');
    if (marked) return { parent: marked, before: marked.firstChild };

    var page = document.querySelector('.page');
    if (!page) return null;

    // Prefer right after the sticky action bar ("N field siap")
    var actionBar = document.getElementById('sdlg-input-action-bar');
    if (actionBar && page.contains(actionBar)) {
      return { parent: actionBar.parentNode, before: actionBar.nextSibling };
    }

    // After helper title
    var nodes = page.querySelectorAll('h1,h2,h3,div,strong,p,span');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var t = clean(n.textContent);
      if (t.length < 60 && /Warranty Claim Input Helper/i.test(t)) {
        return { parent: n.parentNode, before: n.nextSibling };
      }
    }

    for (var j = 0; j < nodes.length; j++) {
      if (/Tampilan bantu untuk mengisi Dealer Portal/i.test(nodes[j].textContent)) {
        return { parent: nodes[j].parentNode, before: nodes[j].nextSibling };
      }
    }

    // Before native "Dealer Portal / Home" block if present
    for (var k = 0; k < nodes.length; k++) {
      var tx = clean(nodes[k].textContent);
      if (tx === 'Dealer Portal' || /^Dealer Portal\s*Home$/i.test(tx)) {
        return { parent: nodes[k].parentNode, before: nodes[k] };
      }
    }

    return { parent: page, before: page.firstChild };
  }

  function buildPanel(values, meta) {
    removePanel();

    var mount = findMountPoint();
    if (!mount || !mount.parent) return;

    var panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('data-sdlg-dynamics-mirror', '1');
    panel.setAttribute('data-claim-id', meta.claimId || '');
    panel.style.cssText =
      'margin:12px 0 16px;border:1px solid #c8d1dc;border-radius:4px;background:#fff;' +
      'font-family:"Segoe UI",SegoeUI,"Helvetica Neue",Arial,sans-serif;color:#323130;' +
      'box-shadow:0 1.6px 3.6px rgba(0,0,0,.08);overflow:hidden;position:relative;z-index:1';

    var bar = document.createElement('div');
    bar.style.cssText =
      'display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;' +
      'background:#fff;border-bottom:1px solid #edebe9';
    bar.innerHTML =
      '<div style="flex:1;min-width:160px">' +
      '<div style="font-size:11px;color:#605e5c;font-weight:600">Microsoft Dynamics 365 · Dealer Portal</div>' +
      '<div style="font-size:18px;font-weight:600;color:#323130;line-height:1.25">Warranty Claim Form</div>' +
      '<div style="font-size:12px;color:#605e5c;margin-top:2px">' +
      escapeHtml(meta.claimId || '') +
      (meta.model ? ' · ' + escapeHtml(meta.model) : '') +
      (meta.customer ? ' · ' + escapeHtml(meta.customer) : '') +
      '</div></div>';

    var copyAll = document.createElement('button');
    copyAll.type = 'button';
    copyAll.textContent = 'Copy all';
    copyAll.setAttribute('data-label-orig', 'Copy all');
    copyAll.style.cssText =
      'height:32px;padding:0 12px;font-size:13px;font-weight:600;cursor:pointer;' +
      'background:#0078d4;color:#fff;border:1px solid #0078d4;border-radius:2px';
    copyAll.addEventListener('click', function () {
      var lines = [];
      HOME_FIELDS.forEach(function (f) {
        var v = values[f.key] || '';
        if (!blank(v)) lines.push(f.label + '\n' + v);
      });
      copyText(lines.join('\n\n'), copyAll);
    });
    bar.appendChild(copyAll);
    panel.appendChild(bar);

    var tabs = document.createElement('div');
    tabs.style.cssText =
      'display:flex;gap:0;padding:0 12px;background:#fff;border-bottom:1px solid #edebe9';
    tabs.innerHTML =
      '<div style="padding:10px 12px;font-size:13px;font-weight:600;color:#0078d4;border-bottom:2px solid #0078d4">Home</div>' +
      '<div style="padding:10px 12px;font-size:13px;color:#605e5c">Approval Progress</div>' +
      '<div style="padding:10px 12px;font-size:13px;color:#605e5c">Related</div>';
    panel.appendChild(tabs);

    var hint = document.createElement('div');
    hint.style.cssText =
      'padding:8px 12px;font-size:12px;color:#605e5c;background:#f3f2f1;border-bottom:1px solid #edebe9';
    hint.textContent =
      'Copy each value into the matching field on the Dealer Portal. Labels match Dynamics 365.';
    panel.appendChild(hint);

    var grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px 16px;' +
      'padding:16px 12px 20px;background:#fff';

    HOME_FIELDS.forEach(function (f) {
      var val = values[f.key] || '';
      var cell = document.createElement('div');
      cell.style.cssText = 'min-width:0;display:flex;flex-direction:column;gap:4px';
      if (f.wide) cell.style.gridColumn = '1 / -1';
      if (f.highlight) {
        cell.style.padding = '8px';
        cell.style.margin = '-8px';
        cell.style.background = '#f0f6fc';
        cell.style.border = '1px solid #c7e0f4';
        cell.style.borderRadius = '2px';
      }

      var lab = document.createElement('label');
      lab.style.cssText = 'font-size:12px;font-weight:600;color:#323130';
      lab.textContent = f.label + (f.required ? ' *' : '');
      cell.appendChild(lab);

      var input = f.wide ? document.createElement('textarea') : document.createElement('input');
      if (f.wide) input.rows = 3;
      else input.type = 'text';
      input.readOnly = true;
      input.value = val;
      input.setAttribute('data-sdlg-field', '1');
      input.setAttribute('data-label', f.label);
      input.style.cssText =
        'width:100%;box-sizing:border-box;height:' +
        (f.wide ? 'auto' : '32px') +
        ';padding:4px 8px;border:1px solid #605e5c;border-radius:2px;font-size:14px;' +
        'font-family:inherit;color:#323130;background:#fff';
      if (blank(val)) {
        input.style.background = '#faf9f8';
        input.style.color = '#a19f9d';
        input.placeholder = '—';
      }
      cell.appendChild(input);

      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:2px';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-label-orig', 'Copy');
      btn.style.cssText =
        'height:28px;padding:0 10px;font-size:12px;font-weight:600;cursor:pointer;' +
        'border:1px solid #8a8886;border-radius:2px;background:#fff;color:#323130';
      if (blank(val)) {
        btn.textContent = 'Empty';
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'default';
      } else {
        btn.textContent = 'Copy';
        btn.addEventListener('click', function () {
          copyText(input.value, btn);
        });
      }
      actions.appendChild(btn);

      if (f.key === 'logistics_backfill') {
        var tip = document.createElement('span');
        tip.style.cssText = 'font-size:11px;color:#605e5c';
        tip.textContent = 'Portal: No / Yes';
        actions.appendChild(tip);
      }
      if (f.highlight) {
        var tip2 = document.createElement('span');
        tip2.style.cssText = 'font-size:11px;color:#0078d4;font-weight:600';
        tip2.textContent = 'Dynamics label';
        actions.appendChild(tip2);
      }

      cell.appendChild(actions);
      grid.appendChild(cell);
    });

    panel.appendChild(grid);

    try {
      mount.parent.insertBefore(panel, mount.before || null);
    } catch (e) {
      mount.parent.appendChild(panel);
    }
  }

  var lastKey = '';
  var inflight = false;

  async function enrich() {
    if (!isInputHelperPage()) {
      removePanel();
      lastKey = '';
      return;
    }

    var id = claimIdFromHelper();
    if (!id) {
      removePanel();
      lastKey = '';
      return;
    }

    var claim = null;
    var sb = supabase();
    if (sb && !inflight) {
      inflight = true;
      try {
        var res = await sb.from('claims').select(SELECT).eq('claim_id', id).maybeSingle();
        if (!res.error && res.data) claim = res.data;
      } catch (e) {
        console.warn('[SDLG PortalMirror] claim fetch', e);
      }
      inflight = false;
    }

    var values = mapClaimToValues(claim || {});
    if (blank(values.service_type)) values.service_type = 'Repair';
    if (blank(values.service_method)) values.service_method = 'Onsite Repair';
    if (blank(values.feedback_contact)) values.feedback_contact = 'xxx';
    if (blank(values.logistics_backfill)) values.logistics_backfill = 'No';

    var meta = {
      claimId: id,
      model: claim ? clean(claim.model) : '',
      customer: claim ? clean(claim.customer) : ''
    };

    var sig =
      id +
      '|' +
      values.serial_no +
      '|' +
      values.failure_date +
      '|' +
      values.repair_report_date +
      '|' +
      values.complaint +
      '|' +
      values.feedback_person +
      '|' +
      values.service_method;

    if (sig === lastKey && document.getElementById(PANEL_ID)) return;
    lastKey = sig;
    buildPanel(values, meta);
  }

  function boot() {
    function tick() {
      try {
        enrich();
      } catch (e) {
        console.warn('[SDLG PortalMirror]', e);
      }
    }
    tick();
    setTimeout(tick, 500);
    setTimeout(tick, 1200);
    setTimeout(tick, 2500);
    setInterval(tick, 3000);

    document.addEventListener(
      'click',
      function () {
        lastKey = '';
        setTimeout(tick, 250);
        setTimeout(tick, 700);
      },
      true
    );
    document.addEventListener(
      'change',
      function () {
      lastKey = '';
        setTimeout(tick, 300);
      },
      true
    );

    if (typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        clearTimeout(window.__sdlgMirrorDebounce);
        window.__sdlgMirrorDebounce = setTimeout(tick, 400);
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGPortalMirror = {
    version: '1.5.5',
    refresh: enrich,
    claimId: claimIdFromHelper,
    isHelper: isInputHelperPage,
    remove: removePanel
  };
  window.SDLGRepairDateInject = { version: '1.5.5', refresh: enrich };
  window.SDLGInputHelperEnrich = { version: '1.5.5', refresh: enrich };
})();
