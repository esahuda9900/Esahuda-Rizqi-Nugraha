/**
 * SDLG WO Collision Modal v1.2.0
 * Self-contained DOM modal with multi-field diff table (no React).
 */
(function (root) {
  'use strict';

  var STYLE_ID = 'sdlg-wo-modal-styles-v12';
  var HOST_ID = 'sdlg-wo-modal-host';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = [
      '#' + HOST_ID + '{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}',
      '#' + HOST_ID + ' .sdlg-wo-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}',
      '#' + HOST_ID + ' .sdlg-wo-card{position:relative;width:min(640px,100%);max-height:min(92vh,820px);overflow:auto;border-radius:20px;background:linear-gradient(180deg,#fff 0%,#f8fafc 100%);box-shadow:0 25px 50px -12px rgba(15,23,42,.35),0 0 0 1px rgba(148,163,184,.25);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;animation:sdlgWoIn .22s ease-out;}',
      '@keyframes sdlgWoIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}',
      '#' + HOST_ID + ' .sdlg-wo-accent{height:4px;background:linear-gradient(90deg,#f59e0b,#ef4444,#2563eb);}',
      '#' + HOST_ID + ' .sdlg-wo-head{padding:18px 22px 12px;border-bottom:1px solid #e2e8f0;}',
      '#' + HOST_ID + ' .sdlg-wo-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;}',
      '#' + HOST_ID + ' .sdlg-wo-badge.weak{background:#fff7ed;color:#c2410c;border:1px solid #fdba74;}',
      '#' + HOST_ID + ' .sdlg-wo-badge.strong{background:#ecfdf5;color:#047857;border:1px solid #6ee7b7;}',
      '#' + HOST_ID + ' .sdlg-wo-badge.update{background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5;}',
      '#' + HOST_ID + ' .sdlg-wo-title{margin:0;font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.25;}',
      '#' + HOST_ID + ' .sdlg-wo-sub{margin:8px 0 0;font-size:13px;line-height:1.5;color:#64748b;}',
      '#' + HOST_ID + ' .sdlg-wo-body{padding:14px 22px 8px;}',
      '#' + HOST_ID + ' .sdlg-wo-wo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:700;background:#f1f5f9;color:#334155;padding:8px 12px;border-radius:10px;margin-bottom:12px;}',
      '#' + HOST_ID + ' .sdlg-wo-table{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 12px;}',
      '#' + HOST_ID + ' .sdlg-wo-table th{text-align:left;padding:8px 10px;background:#f8fafc;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;position:sticky;top:0;}',
      '#' + HOST_ID + ' .sdlg-wo-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top;word-break:break-word;}',
      '#' + HOST_ID + ' .sdlg-wo-table tr.changed td{background:#fff7ed;}',
      '#' + HOST_ID + ' .sdlg-wo-table tr.same td{background:#fff;}',
      '#' + HOST_ID + ' .sdlg-wo-table .tag{display:inline-block;font-size:10px;font-weight:800;padding:2px 6px;border-radius:999px;}',
      '#' + HOST_ID + ' .sdlg-wo-table .tag.chg{background:#ffedd5;color:#c2410c;}',
      '#' + HOST_ID + ' .sdlg-wo-table .tag.ok{background:#ecfdf5;color:#047857;}',
      '#' + HOST_ID + ' .sdlg-wo-note{font-size:12px;line-height:1.45;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:4px;}',
      '#' + HOST_ID + ' .sdlg-wo-foot{padding:12px 22px 18px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;background:rgba(248,250,252,.9);}',
      '#' + HOST_ID + ' .sdlg-wo-btn{border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;}',
      '#' + HOST_ID + ' .sdlg-wo-btn.ghost{background:#fff;color:#475569;border:1px solid #e2e8f0;}',
      '#' + HOST_ID + ' .sdlg-wo-btn.primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;}',
      '#' + HOST_ID + ' .sdlg-wo-btn.danger{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;}',
      '#' + HOST_ID + ' .sdlg-wo-summary{font-size:12px;font-weight:700;color:#0f172a;margin:0 0 10px;}'
    ].join('');
    document.head.appendChild(css);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function norm(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    return String(v).replace(/\s+/g, ' ').trim();
  }

  function shortText(value, max) {
    var s = norm(value);
    if (!s) return '—';
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function pick(obj, keys) {
    if (!obj) return '';
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && String(obj[keys[i]]).trim() !== '') return obj[keys[i]];
    }
    return '';
  }

  function buildDiffRows(matched, parsed) {
    var fields = [
      { label: 'Serial No', old: pick(matched, ['serial_no', 'serialNo']), neu: pick(parsed, ['serialNo', 'serial_no']) },
      { label: 'Model', old: pick(matched, ['model']), neu: pick(parsed, ['model']) },
      { label: 'Customer', old: pick(matched, ['customer']), neu: pick(parsed, ['customer']) },
      { label: 'Dealer WO/SO', old: pick(matched, ['dealer_wo_so', 'dealerWoSo']), neu: pick(parsed, ['dealerWoSo', 'dealer_wo_so']) },
      { label: 'Failure Date', old: pick(matched, ['failure_date', 'failureDate']), neu: pick(parsed, ['failureDate', 'failure_date']) },
      { label: 'Dealer Repair Date', old: pick(matched, ['dealer_repair_date', 'dealerRepairDate']), neu: pick(parsed, ['dealerRepairDate', 'dealer_repair_date']) },
      { label: 'HM Failure', old: pick(matched, ['hm_failure', 'hmFailure']), neu: pick(parsed, ['hmFailure', 'hm_failure']) },
      { label: 'Causing Part', old: pick(matched, ['causing_part_no', 'causingPartNo']), neu: pick(parsed, ['causingPartNo', 'causing_part_no']) },
      { label: 'Fault', old: pick(matched, ['fault_description', 'faultDescription']), neu: pick(parsed, ['faultDescription', 'fault_description']) },
      { label: 'Cause', old: pick(matched, ['cause_analyze', 'causeAnalyze']), neu: pick(parsed, ['causeAnalyze', 'cause_analyze']) },
      { label: 'Total Amount', old: pick(matched, ['total_amount', 'totalAmount']), neu: pick(parsed, ['totalAmount', 'total_amount']) },
      { label: 'Labour Amount', old: pick(matched, ['labour_amount', 'labourAmount']), neu: pick(parsed, ['labourAmount', 'labour_amount']) }
    ];

    // Parts qty summary
    var oldParts = matched.parts;
    var newParts = parsed.parts;
    try {
      if (typeof oldParts === 'string') oldParts = JSON.parse(oldParts);
    } catch (_) {}
    var oldQty = Array.isArray(oldParts)
      ? oldParts.reduce(function (a, p) { return a + (Number(p.qty) || 0); }, 0)
      : '';
    var newQty = Array.isArray(newParts)
      ? newParts.reduce(function (a, p) { return a + (Number(p.qty) || Number(p.quantity) || 0); }, 0)
      : '';
    fields.push({ label: 'Parts Qty (sum)', old: oldQty, neu: newQty });

    return fields.map(function (f) {
      var o = norm(f.old);
      var n = norm(f.neu);
      var changed = o !== n;
      // if both empty, treat as same
      if (!o && !n) changed = false;
      return { label: f.label, old: o || '—', neu: n || '—', changed: changed };
    });
  }

  function closeHost() {
    var host = document.getElementById(HOST_ID);
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }

  function show(opts) {
    opts = opts || {};
    ensureStyles();
    closeHost();

    var mode = opts.mode === 'update' ? 'update' : 'new';
    var kind = opts.kind || 'weak';
    var matched = opts.matchedClaim || {};
    var parsed = opts.parsed || {};
    var wo = opts.wo || pick(parsed, ['dealerWoSo', 'dealer_wo_so']) || pick(matched, ['dealer_wo_so']) || '';

    var badgeClass = mode === 'update' ? 'update' : kind === 'strong' ? 'strong' : 'weak';
    var badgeText =
      mode === 'update'
        ? 'Update klaim lama'
        : kind === 'strong'
          ? 'WO sama · kerusakan mirip'
          : 'WO sama · kerusakan beda';

    var title =
      mode === 'update'
        ? 'Konfirmasi Update Klaim'
        : 'Duplikat / WO sudah dipakai';

    var sub =
      mode === 'update'
        ? 'Tinjau perubahan di bawah. Update akan menimpa data klaim lama.'
        : 'WO ini sudah terkait klaim lain. Pilih dengan sadar sebelum lanjut.';

    var note =
      mode === 'update'
        ? 'Tindakan ini menimpa data klaim yang sudah ada. Pastikan field yang berubah memang disengaja.'
        : 'Simpan Baru membuat klaim terpisah dengan WO yang sama (multi-claim). Utamakan Update jika ini revisi klaim yang sama.';

    var primaryLabel = mode === 'update' ? 'Ya, Update Klaim' : 'Ya, Simpan sebagai Baru';
    var primaryClass = mode === 'update' ? 'danger' : 'primary';

    var rows = buildDiffRows(matched, parsed);
    var changedCount = rows.filter(function (r) { return r.changed; }).length;

    var tableHtml =
      '<div class="sdlg-wo-summary">' +
      (changedCount
        ? changedCount + ' field berubah (disorot oranye)'
        : 'Tidak ada perbedaan field utama — data mirip') +
      '</div>' +
      '<table class="sdlg-wo-table"><thead><tr>' +
      '<th style="width:22%">Field</th><th style="width:34%">Data lama</th><th style="width:34%">Parse baru</th><th style="width:10%">Status</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      tableHtml +=
        '<tr class="' +
        (r.changed ? 'changed' : 'same') +
        '">' +
        '<td><b>' +
        esc(r.label) +
        '</b></td>' +
        '<td>' +
        esc(shortText(r.old, 120)) +
        '</td>' +
        '<td>' +
        esc(shortText(r.neu, 120)) +
        '</td>' +
        '<td>' +
        (r.changed
          ? '<span class="tag chg">UBAH</span>'
          : '<span class="tag ok">SAMA</span>') +
        '</td></tr>';
    });
    tableHtml += '</tbody></table>';

    var host = document.createElement('div');
    host.id = HOST_ID;
    host.innerHTML =
      '<div class="sdlg-wo-backdrop" data-act="cancel"></div>' +
      '<div class="sdlg-wo-card" role="dialog" aria-modal="true">' +
      '<div class="sdlg-wo-accent"></div>' +
      '<div class="sdlg-wo-head">' +
      '<div class="sdlg-wo-badge ' +
      badgeClass +
      '">' +
      esc(badgeText) +
      '</div>' +
      '<h2 class="sdlg-wo-title">' +
      esc(title) +
      '</h2>' +
      '<p class="sdlg-wo-sub">' +
      esc(sub) +
      '</p>' +
      '</div>' +
      '<div class="sdlg-wo-body">' +
      '<div class="sdlg-wo-wo">WO ' +
      esc(wo) +
      ' · Klaim ' +
      esc(matched.claim_id || '—') +
      (matched.claim_status ? ' · ' + esc(matched.claim_status) : '') +
      '</div>' +
      tableHtml +
      '<div class="sdlg-wo-note">' +
      esc(note) +
      '</div>' +
      '</div>' +
      '<div class="sdlg-wo-foot">' +
      '<button type="button" class="sdlg-wo-btn ghost" data-act="cancel">Batal</button>' +
      '<button type="button" class="sdlg-wo-btn ' +
      primaryClass +
      '" data-act="ok">' +
      esc(primaryLabel) +
      '</button>' +
      '</div></div>';

    document.body.appendChild(host);

    return new Promise(function (resolve) {
      function finish(ok) {
        closeHost();
        document.removeEventListener('keydown', onKey);
        resolve(!!ok);
      }
      function onKey(e) {
        if (e.key === 'Escape') finish(false);
      }
      document.addEventListener('keydown', onKey);
      host.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var act = t.getAttribute('data-act');
        if (act === 'ok') finish(true);
        if (act === 'cancel') finish(false);
      });
      var cancelBtn = host.querySelector('[data-act="cancel"]');
      if (cancelBtn && mode === 'update') cancelBtn.focus();
      else {
        var okBtn = host.querySelector('[data-act="ok"]');
        if (okBtn) okBtn.focus();
      }
    });
  }

  root.SDLGWoCollisionModal = Object.freeze({
    version: '1.2.0',
    show: show
  });
})(typeof window !== 'undefined' ? window : globalThis);
