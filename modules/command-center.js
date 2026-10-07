(function () {
  'use strict';

  var ROOT_ID = 'sdlg-command-center-v2';
  var STYLE_ID = 'sdlg-command-center-style-v4';
  var MAX_WAIT_MS = 15000;

  function getClient() {
    if (typeof window === 'undefined') return null;
    var candidate = window.sdlgSupabase || window.supabaseClient || window.__sdlgSupabase || null;
    if (candidate && typeof candidate.from === 'function') return candidate;
    try {
      if (typeof sdlgSupabase !== 'undefined' && sdlgSupabase && typeof sdlgSupabase.from === 'function') return sdlgSupabase;
    } catch (_) {}
    return null;
  }

  function waitForSession() {
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      (function tick() {
        var client = getClient();
        if (client) return resolve(client);
        if (Date.now() - started > MAX_WAIT_MS) return reject(new Error('Supabase client tidak siap untuk Command Center.'));
        setTimeout(tick, 120);
      })();
    });
  }

  function ensureStyle() {
    var prev = document.getElementById('sdlg-command-center-style-v3');
    if (prev) prev.remove();
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + ROOT_ID + '{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;margin:0 0 24px!important;color:#152033}',
      '#' + ROOT_ID + ' *{box-sizing:border-box}',
      '#' + ROOT_ID + ' .cc-shell{width:100%;min-width:0}',
      '#' + ROOT_ID + ' .cc-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}',
      '#' + ROOT_ID + ' .cc-title{font-size:18px;font-weight:800;line-height:1.25;color:#152033}',
      '#' + ROOT_ID + ' .cc-sub{margin-top:4px;font-size:12px;line-height:1.45;color:#667085}',
      '#' + ROOT_ID + ' .cc-actions{display:flex;gap:8px;flex-wrap:wrap}',
      '#' + ROOT_ID + ' button{font:inherit;min-height:38px;border:1px solid #d8e0eb;background:#fff;color:#2b3850;border-radius:10px;padding:9px 12px;cursor:pointer;font-weight:700}',
      '#' + ROOT_ID + ' .cc-primary{background:#3563e9;color:#fff;border-color:#3563e9}',
      '#' + ROOT_ID + ' .cc-grid4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '#' + ROOT_ID + ' .cc-card{min-width:0;background:#fff;border:1px solid #e5eaf1;border-radius:14px;box-shadow:0 3px 14px rgba(15,23,42,.04)}',
      '#' + ROOT_ID + ' .cc-kpi{padding:14px;min-height:96px}',
      '#' + ROOT_ID + ' .cc-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7b8799;font-weight:800}',
      '#' + ROOT_ID + ' .cc-value{margin-top:8px;font-size:24px;line-height:1.1;font-weight:800;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '#' + ROOT_ID + ' .cc-meta{margin-top:6px;font-size:11px;color:#6b7788;line-height:1.4}',
      '#' + ROOT_ID + ' .cc-exceptions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}',
      '#' + ROOT_ID + ' .cc-exception{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;min-width:0}',
      '#' + ROOT_ID + ' .cc-ex-main{min-width:0;flex:1}',
      '#' + ROOT_ID + ' .cc-ex-title{font-size:13px;font-weight:800}',
      '#' + ROOT_ID + ' .cc-ex-copy{margin-top:2px;font-size:11px;line-height:1.4;color:#718096}',
      '#' + ROOT_ID + ' .cc-ex-num{font-size:18px;font-weight:800;white-space:nowrap}',
      '#' + ROOT_ID + ' .cc-panels{display:grid;grid-template-columns:1fr;gap:12px;margin-top:12px}',
      '#' + ROOT_ID + ' .cc-panel{min-width:0;overflow:visible}',
      '#' + ROOT_ID + ' .cc-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #edf1f5}',
      '#' + ROOT_ID + ' .cc-panel-title{font-size:13px;font-weight:800}',
      '#' + ROOT_ID + ' .cc-panel-meta{font-size:11px;color:#7a8798}',
      '#' + ROOT_ID + ' .cc-table-wrap{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '#' + ROOT_ID + ' table{width:100%;min-width:0;border-collapse:collapse;font-size:11px}',
      '#' + ROOT_ID + ' th{padding:8px 6px;text-align:left;background:#f8fafc;color:#718096;font-size:10px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #edf1f5;white-space:normal}',
      '#' + ROOT_ID + ' td{padding:8px 6px;border-bottom:1px solid #f1f4f7;vertical-align:top;white-space:normal;word-break:break-word}',
      '#' + ROOT_ID + ' .cc-empty{padding:18px;text-align:center;color:#8390a2;font-size:12px}',
      '#' + ROOT_ID + ' .cc-loading{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '#' + ROOT_ID + ' .cc-skeleton{height:96px;border-radius:14px;background:linear-gradient(90deg,#eef2f7 25%,#f8fafc 50%,#eef2f7 75%);background-size:200% 100%;animation:sdlgCcPulse 1.2s ease-in-out infinite}',
      '@keyframes sdlgCcPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}',
      '@media(min-width:761px){',
      '  #' + ROOT_ID + ' .cc-grid4{grid-template-columns:repeat(4,minmax(0,1fr))}',
      '  #' + ROOT_ID + ' .cc-exceptions{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '  #' + ROOT_ID + ' .cc-panels{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}',
      '  #' + ROOT_ID + ' .cc-loading{grid-template-columns:repeat(4,minmax(0,1fr))}',
      '  #' + ROOT_ID + ' .cc-value{font-size:28px}',
      '}'
    ].join('\n');
    (document.body || document.head).appendChild(s);
  }

  function fmt(n) {
    var x = Number(n);
    if (!isFinite(x)) return '—';
    return x.toLocaleString('id-ID');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  async function fetchData() {
    var sb = await waitForSession();
    var results = await Promise.all([
      sb.from('warranty_control_summary_v').select('*').maybeSingle(),
      sb.from('wo_followup_queue_v').select('*').eq('include_in_branch_followup', true).order('aging_days', { ascending: false }).limit(1000),
      sb.from('wo_outstanding_by_branch_v').select('*').order('branch_followup_count', { ascending: false })
    ]);
    var summary = results[0], queue = results[1], branches = results[2];
    if (summary.error) throw summary.error;
    if (queue.error) throw queue.error;
    if (branches.error) throw branches.error;
    if (!summary.data) throw new Error('Control summary tidak mengembalikan data.');
    return { summary: summary.data, queue: queue.data || [], branches: branches.data || [] };
  }

  function kpi(label, value, meta) {
    return '<div class="cc-card cc-kpi"><div class="cc-label">' + esc(label) + '</div><div class="cc-value">' + esc(value) + '</div><div class="cc-meta">' + esc(meta || '') + '</div></div>';
  }

  function renderLoading(root) {
    root.innerHTML = '<div class="cc-shell"><div class="cc-head"><div><div class="cc-title">Operational Control Center</div><div class="cc-sub">Mengambil data…</div></div></div><div class="cc-loading"><div class="cc-skeleton"></div><div class="cc-skeleton"></div><div class="cc-skeleton"></div><div class="cc-skeleton"></div></div></div>';
  }

  function renderError(root, err) {
    root.innerHTML = '<div class="cc-shell"><div class="cc-card" style="padding:16px"><div class="cc-title">Gagal memuat Control Center</div><div class="cc-sub">' +
      esc((err && err.message) || err || 'Unknown error') +
      '</div><div style="margin-top:12px"><button type="button" class="cc-primary" id="cc-retry">Coba lagi</button></div></div></div>';
    var btn = root.querySelector('#cc-retry');
    if (btn) btn.onclick = function () { mount(true); };
  }

  function render(root, data) {
    var s = data.summary || {};
    var queue = data.queue || [];
    var branches = data.branches || [];

    var queueRows = queue.slice(0, 40).map(function (r) {
      return '<tr><td>' + esc(r.branch_name || r.branch || '—') + '</td><td>' + esc(r.wo_number || r.work_order || '—') + '</td><td>' + esc(r.serial_no || r.serial || '—') + '</td><td>' + esc(r.status || '—') + '</td><td>' + esc(r.aging_days != null ? r.aging_days + ' d' : '—') + '</td></tr>';
    }).join('');

    var branchRows = branches.slice(0, 30).map(function (r) {
      return '<tr><td>' + esc(r.branch_name || r.branch || '—') + '</td><td>' + esc(fmt(r.branch_followup_count || r.followup_count || 0)) + '</td><td>' + esc(fmt(r.outstanding_amount || r.amount || 0)) + '</td></tr>';
    }).join('');

    root.innerHTML =
      '<div class="cc-shell">' +
        '<div class="cc-head"><div><div class="cc-title">Operational Control Center</div><div class="cc-sub">Ringkasan kontrol warranty WO, claim aging, follow-up cabang, dan settlement.</div></div>' +
        '<div class="cc-actions"><button type="button" class="cc-primary" id="cc-refresh">Refresh</button></div></div>' +
        '<div class="cc-grid4">' +
          kpi('WO Follow-up', fmt(s.wo_followup_count || s.followup_total || queue.length), 'Antrian cabang aktif') +
          kpi('Outstanding Branch', fmt(branches.length), 'Cabang dengan backlog') +
          kpi('Aging > 30d', fmt(s.aging_over_30 || s.aging_30 || 0), 'Perlu eskalasi') +
          kpi('Settlement pending', fmt(s.settlement_pending || s.pending_settlement || 0), 'Menunggu closing') +
        '</div>' +
        '<div class="cc-exceptions">' +
          '<div class="cc-card cc-exception"><div class="cc-ex-main"><div class="cc-ex-title">Missing WO link</div><div class="cc-ex-copy">Claim tanpa relasi WO yang valid</div></div><div class="cc-ex-num">' + fmt(s.missing_wo || 0) + '</div></div>' +
          '<div class="cc-card cc-exception"><div class="cc-ex-main"><div class="cc-ex-title">Status mismatch</div><div class="cc-ex-copy">Status AX vs app tidak selaras</div></div><div class="cc-ex-num">' + fmt(s.status_mismatch || 0) + '</div></div>' +
          '<div class="cc-card cc-exception"><div class="cc-ex-main"><div class="cc-ex-title">Payment hold</div><div class="cc-ex-copy">Tertahan di payment batch</div></div><div class="cc-ex-num">' + fmt(s.payment_hold || 0) + '</div></div>' +
        '</div>' +
        '<div class="cc-panels">' +
          '<div class="cc-card cc-panel"><div class="cc-panel-head"><div class="cc-panel-title">Follow-up queue</div><div class="cc-panel-meta">' + queue.length + ' item</div></div><div class="cc-table-wrap"><table><thead><tr><th>Branch</th><th>WO</th><th>Serial</th><th>Status</th><th>Aging</th></tr></thead><tbody>' +
            (queueRows || '<tr><td colspan="5" class="cc-empty">Tidak ada antrian follow-up.</td></tr>') +
          '</tbody></table></div></div>' +
          '<div class="cc-card cc-panel"><div class="cc-panel-head"><div class="cc-panel-title">Outstanding by branch</div><div class="cc-panel-meta">Top cabang</div></div><div class="cc-table-wrap"><table><thead><tr><th>Branch</th><th>Follow-up</th><th>Amount</th></tr></thead><tbody>' +
            (branchRows || '<tr><td colspan="3" class="cc-empty">Tidak ada data cabang.</td></tr>') +
          '</tbody></table></div></div>' +
        '</div>' +
      '</div>';

    var refresh = root.querySelector('#cc-refresh');
    if (refresh) refresh.onclick = function () { mount(true); };
  }

  async function mount() {
    ensureStyle();
    var root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      var page = document.querySelector('.page') || document.querySelector('#root') || document.body;
      if (page.firstChild) page.insertBefore(root, page.firstChild);
      else page.appendChild(root);
    }
    renderLoading(root);
    try {
      var data = await fetchData();
      render(root, data);
    } catch (err) {
      renderError(root, err);
    }
  }

  function boot() {
    ensureStyle();
    window.SDLGCommandCenter = { mount: mount, refresh: function () { return mount(); } };
    if (document.getElementById(ROOT_ID) || document.querySelector('[data-sdlg-command-center]')) {
      mount();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
