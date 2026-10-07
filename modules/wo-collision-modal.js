/**
 * SDLG WO Collision Modal v1.1.0
 * Self-contained DOM modal (no React). Promise-based.
 */
(function (root) {
  'use strict';

  var STYLE_ID = 'sdlg-wo-modal-styles-v11';
  var HOST_ID = 'sdlg-wo-modal-host';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = [
      '#' + HOST_ID + '{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}',
      '#' + HOST_ID + ' .sdlg-wo-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}',
      '#' + HOST_ID + ' .sdlg-wo-card{position:relative;width:min(520px,100%);max-height:min(90vh,720px);overflow:auto;border-radius:20px;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);box-shadow:0 25px 50px -12px rgba(15,23,42,.35),0 0 0 1px rgba(148,163,184,.25);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;animation:sdlgWoIn .22s ease-out;}',
      '@keyframes sdlgWoIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}',
      '#' + HOST_ID + ' .sdlg-wo-accent{height:4px;background:linear-gradient(90deg,#f59e0b,#ef4444,#2563eb);}',
      '#' + HOST_ID + ' .sdlg-wo-head{padding:20px 24px 12px;border-bottom:1px solid #e2e8f0;}',
      '#' + HOST_ID + ' .sdlg-wo-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;}',
      '#' + HOST_ID + ' .sdlg-wo-badge.weak{background:#fff7ed;color:#c2410c;border:1px solid #fdba74;}',
      '#' + HOST_ID + ' .sdlg-wo-badge.strong{background:#ecfdf5;color:#047857;border:1px solid #6ee7b7;}',
      '#' + HOST_ID + ' .sdlg-wo-badge.update{background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5;}',
      '#' + HOST_ID + ' .sdlg-wo-title{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.25;}',
      '#' + HOST_ID + ' .sdlg-wo-sub{margin:8px 0 0;font-size:13.5px;line-height:1.5;color:#64748b;}',
      '#' + HOST_ID + ' .sdlg-wo-body{padding:16px 24px 8px;}',
      '#' + HOST_ID + ' .sdlg-wo-wo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;font-weight:700;background:#f1f5f9;color:#334155;padding:8px 12px;border-radius:10px;margin-bottom:14px;border:1px solid #e2e8f0;}',
      '#' + HOST_ID + ' .sdlg-wo-diff{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
      '#' + HOST_ID + ' .sdlg-wo-col{border-radius:14px;padding:12px 14px;border:1px solid #e2e8f0;background:#fff;}',
      '#' + HOST_ID + ' .sdlg-wo-col.old{background:#fff1f2;border-color:#fecaca;}',
      '#' + HOST_ID + ' .sdlg-wo-col.new{background:#f0fdf4;border-color:#bbf7d0;}',
      '#' + HOST_ID + ' .sdlg-wo-col h4{margin:0 0 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b;}',
      '#' + HOST_ID + ' .sdlg-wo-row{margin:0 0 8px;font-size:12.5px;line-height:1.4;}',
      '#' + HOST_ID + ' .sdlg-wo-row b{display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;}',
      '#' + HOST_ID + ' .sdlg-wo-note{margin:14px 0 0;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px dashed #cbd5e1;font-size:12.5px;line-height:1.55;color:#475569;}',
      '#' + HOST_ID + ' .sdlg-wo-foot{padding:16px 24px 22px;display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;border-top:1px solid #e2e8f0;background:rgba(248,250,252,.9);}',
      '#' + HOST_ID + ' .sdlg-wo-btn{appearance:none;border:none;cursor:pointer;font-size:13.5px;font-weight:700;padding:11px 16px;border-radius:12px;transition:transform .12s ease,box-shadow .12s ease,opacity .12s;}',
      '#' + HOST_ID + ' .sdlg-wo-btn:active{transform:scale(.98)}',
      '#' + HOST_ID + ' .sdlg-wo-btn.ghost{background:#fff;color:#475569;border:1px solid #e2e8f0;}',
      '#' + HOST_ID + ' .sdlg-wo-btn.ghost:hover{background:#f8fafc;}',
      '#' + HOST_ID + ' .sdlg-wo-btn.primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 8px 20px -6px rgba(37,99,235,.55);}',
      '#' + HOST_ID + ' .sdlg-wo-btn.primary:hover{filter:brightness(1.05)}',
      '#' + HOST_ID + ' .sdlg-wo-btn.danger{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;box-shadow:0 8px 20px -6px rgba(220,38,38,.45);}',
      '@media (max-width:520px){#' + HOST_ID + ' .sdlg-wo-diff{grid-template-columns:1fr}}',
      '@media (prefers-color-scheme:dark){',
      '#' + HOST_ID + ' .sdlg-wo-card{background:linear-gradient(180deg,#1e293b 0%,#0f172a 100%);color:#f1f5f9;box-shadow:0 25px 50px -12px rgba(0,0,0,.55),0 0 0 1px rgba(51,65,85,.8);}',
      '#' + HOST_ID + ' .sdlg-wo-head,#' + HOST_ID + ' .sdlg-wo-foot{border-color:#334155;background:rgba(15,23,42,.6);}',
      '#' + HOST_ID + ' .sdlg-wo-sub{color:#94a3b8;}',
      '#' + HOST_ID + ' .sdlg-wo-wo{background:#0f172a;color:#e2e8f0;border-color:#334155;}',
      '#' + HOST_ID + ' .sdlg-wo-col{background:#1e293b;border-color:#334155;}',
      '#' + HOST_ID + ' .sdlg-wo-col.old{background:#450a0a;border-color:#7f1d1d;}',
      '#' + HOST_ID + ' .sdlg-wo-col.new{background:#052e16;border-color:#166534;}',
      '#' + HOST_ID + ' .sdlg-wo-note{background:#0f172a;border-color:#475569;color:#cbd5e1;}',
      '#' + HOST_ID + ' .sdlg-wo-btn.ghost{background:#1e293b;color:#e2e8f0;border-color:#475569;}',
      '}'
    ].join('');
    document.head.appendChild(css);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function shortText(value, max) {
    var s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!s) return '—';
    return s.length > max ? s.slice(0, max) + '…' : s;
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
    var wo = opts.wo || '';

    var badgeClass = mode === 'update' ? 'update' : kind === 'strong' ? 'strong' : 'weak';
    var badgeText =
      mode === 'update'
        ? 'Update klaim lama'
        : kind === 'strong'
          ? 'WO sama · kerusakan mirip'
          : 'WO sama · kerusakan beda';

    var title =
      mode === 'update' ? 'Yakin timpa klaim lama?' : 'WO sudah dipakai klaim lain';

    var sub =
      mode === 'update'
        ? 'Data parse akan menimpa klaim yang sudah tersimpan. Periksa perbedaan di bawah.'
        : 'Nomor WO sama, tapi kerusakan/part berbeda. Kemungkinan cabang salah tempel WO.';

    var note =
      mode === 'update'
        ? 'Aksi ini mengubah klaim existing (termasuk yang berstatus audit). Tidak bisa di-undo dari dialog ini.'
        : 'Jika ini pekerjaan baru: simpan sebagai klaim baru. WO akan dikosongkan agar tidak dobel. Isi WO yang benar setelah cabang konfirmasi.';

    var primaryLabel = mode === 'update' ? 'Timpa klaim lama' : 'Simpan Baru (tanpa WO)';
    var primaryClass = mode === 'update' ? 'danger' : 'primary';

    var host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.innerHTML =
      '<div class="sdlg-wo-backdrop" data-act="cancel"></div>' +
      '<div class="sdlg-wo-card" role="document">' +
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
      '<div class="sdlg-wo-diff">' +
      '<div class="sdlg-wo-col old">' +
      '<h4>Klaim lama</h4>' +
      '<p class="sdlg-wo-row"><b>Fault</b>' +
      esc(shortText(matched.fault_description, 80)) +
      '</p>' +
      '<p class="sdlg-wo-row"><b>Part</b>' +
      esc(shortText(matched.causing_part_no, 40)) +
      '</p>' +
      '</div>' +
      '<div class="sdlg-wo-col new">' +
      '<h4>Parse sekarang</h4>' +
      '<p class="sdlg-wo-row"><b>Fault</b>' +
      esc(shortText(parsed.faultDescription || parsed.fault_description, 80)) +
      '</p>' +
      '<p class="sdlg-wo-row"><b>Part</b>' +
      esc(shortText(parsed.causingPartNo || parsed.causing_part_no, 40)) +
      '</p>' +
      '</div>' +
      '</div>' +
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
      '</div>' +
      '</div>';

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
    version: '1.1.0',
    show: show
  });
})(typeof window !== 'undefined' ? window : globalThis);
