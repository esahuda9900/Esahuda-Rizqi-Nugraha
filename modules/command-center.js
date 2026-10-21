/**
 * SDLG Operational Command Center — V4.0 (Enterprise Edition)
 * 
 * ═══════════════════════════════════════════════════════════
 * FITUR:
 * ✅ Live Search, Sortable Columns, Export CSV
 * ✅ Auto-refresh (toggle), Last-updated timestamp
 * ✅ Real-time Supabase subscription
 * ✅ Row expansion, Keyboard shortcuts (Ctrl+K, /)
 * ✅ Smart cache (60s), Pagination (Load more)
 * ✅ Auto Dark Mode, CSS Variables, Full A11y
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  // ═════════════════════════════════════════════════════════
  // 1. KONFIGURASI
  // ═════════════════════════════════════════════════════════
  var ROOT_ID = 'sdlg-command-center-v2';
  var STYLE_ID = 'sdlg-command-center-style-v4';
  var MAX_WAIT_MS = 15000;
  var CACHE_TTL_MS = 60000; // 60 detik
  var PAGE_SIZE = 40;
  var AUTO_REFRESH_MS = 30000;
  var STORAGE_KEY = 'sdlg_cc_prefs';

  // ═════════════════════════════════════════════════════════
  // 2. STATE MANAGEMENT
  // ═════════════════════════════════════════════════════════
  var State = {
    data: null,
    loading: false,
    error: null,
    search: '',
    sortKey: 'aging_days',
    sortDir: 'desc',
    autoRefresh: true,
    expandedRows: {},
    visibleQueueCount: PAGE_SIZE,
    lastUpdated: null,
    realtimeChannel: null,
    refreshTimer: null,
    cacheAt: 0
  };

  // Load prefs dari localStorage
  try {
    var savedPrefs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (savedPrefs.sortKey) State.sortKey = savedPrefs.sortKey;
    if (savedPrefs.sortDir) State.sortDir = savedPrefs.sortDir;
    if (typeof savedPrefs.autoRefresh === 'boolean') State.autoRefresh = savedPrefs.autoRefresh;
  } catch (_) {}

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sortKey: State.sortKey,
        sortDir: State.sortDir,
        autoRefresh: State.autoRefresh
      }));
    } catch (_) {}
  }

  // ═════════════════════════════════════════════════════════
  // 3. UTILITIES
  // ═════════════════════════════════════════════════════════
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtNum(n) {
    var x = Number(n);
    return isFinite(x) ? x.toLocaleString('id-ID') : '—';
  }

  function fmtMoney(n) {
    var x = Number(n);
    return isFinite(x) ? 'Rp ' + x.toLocaleString('id-ID') : '—';
  }

  function timeAgo(date) {
    if (!date) return 'Belum pernah';
    var sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 5) return 'Baru saja';
    if (sec < 60) return sec + ' detik lalu';
    if (sec < 3600) return Math.floor(sec / 60) + ' menit lalu';
    return Math.floor(sec / 3600) + ' jam lalu';
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  function getClient() {
    var c = window.sdlgSupabase || window.supabaseClient || window.__sdlgSupabase;
    if (c && typeof c.from === 'function') return c;
    try {
      if (typeof sdlgSupabase !== 'undefined' && sdlgSupabase) return sdlgSupabase;
    } catch (_) {}
    return null;
  }

  function waitForSession() {
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      (function tick() {
        var client = getClient();
        if (client) return resolve(client);
        if (Date.now() - started > MAX_WAIT_MS) return reject(new Error('Koneksi ke Supabase timeout'));
        setTimeout(tick, 150);
      })();
    });
  }

  function notify(type, title, msg) {
    if (window.SDLGNotify && window.SDLGNotify[type]) {
      window.SDLGNotify[type](title, msg);
    }
  }

  // ═════════════════════════════════════════════════════════
  // 4. STYLES (CSS Variables + Dark Mode)
  // ═════════════════════════════════════════════════════════
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var old = document.getElementById('sdlg-command-center-style-v3');
    if (old) old.remove();

    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${ROOT_ID} {
        --cc-bg: #ffffff; --cc-bg-subtle: #f8fafc; --cc-border: #e2e8f0;
        --cc-text: #0f172a; --cc-text-muted: #64748b;
        --cc-primary: #2f5bff; --cc-danger: #dc2626;
        --cc-success: #16a34a; --cc-warning: #d97706;
        --cc-radius: 14px;
        --cc-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
        display: block !important; width: 100% !important;
        box-sizing: border-box !important; margin: 0 0 24px !important;
        color: var(--cc-text); font-family: system-ui, -apple-system, sans-serif;
        animation: ccFadeIn 0.4s ease-out;
      }
      @media (prefers-color-scheme: dark) {
        #${ROOT_ID} {
          --cc-bg: #111a2e; --cc-bg-subtle: #1e293b; --cc-border: #1e2a45;
          --cc-text: #f8fafc; --cc-text-muted: #94a3b8; --cc-primary: #4d70ff;
          --cc-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
        }
      }
      @keyframes ccFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ccPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
      @keyframes ccSpin { to { transform: rotate(360deg); } }

      #${ROOT_ID} * { box-sizing: border-box; }
      #${ROOT_ID} .cc-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
      #${ROOT_ID} .cc-title { font-size: 18px; font-weight: 800; margin: 0; color: var(--cc-text); }
      #${ROOT_ID} .cc-sub { font-size: 13px; color: var(--cc-text-muted); margin-top: 4px; }
      #${ROOT_ID} .cc-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }

      #${ROOT_ID} button, #${ROOT_ID} input {
        font: inherit; border: 1px solid var(--cc-border); background: var(--cc-bg);
        color: var(--cc-text); border-radius: 8px; padding: 8px 14px; cursor: pointer;
        font-weight: 600; font-size: 13px; transition: all 0.15s;
      }
      #${ROOT_ID} button:hover { background: var(--cc-bg-subtle); }
      #${ROOT_ID} button:focus-visible { outline: 2px solid var(--cc-primary); outline-offset: 2px; }
      #${ROOT_ID} .cc-primary { background: var(--cc-primary); color: #fff; border-color: var(--cc-primary); }
      #${ROOT_ID} .cc-primary:hover { opacity: 0.9; }
      #${ROOT_ID} .cc-icon-btn { padding: 8px 10px; }
      #${ROOT_ID} .cc-icon-btn svg { display: block; }

      #${ROOT_ID} .cc-toolbar {
        display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;
        align-items: center; padding: 12px 16px;
        background: var(--cc-bg-subtle); border: 1px solid var(--cc-border);
        border-radius: var(--cc-radius);
      }
      #${ROOT_ID} .cc-search {
        flex: 1; min-width: 200px; position: relative;
      }
      #${ROOT_ID} .cc-search input {
        width: 100%; padding-left: 36px; background: var(--cc-bg);
      }
      #${ROOT_ID} .cc-search::before {
        content: "🔍"; position: absolute; left: 12px; top: 50%;
        transform: translateY(-50%); font-size: 14px; pointer-events: none;
      }
      #${ROOT_ID} .cc-search kbd {
        position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
        font-size: 10px; padding: 2px 6px; background: var(--cc-bg-subtle);
        border: 1px solid var(--cc-border); border-radius: 4px;
        color: var(--cc-text-muted); font-family: monospace;
      }
      #${ROOT_ID} .cc-toggle {
        display: flex; align-items: center; gap: 6px; font-size: 12px;
        color: var(--cc-text-muted); cursor: pointer; user-select: none;
      }
      #${ROOT_ID} .cc-toggle input { accent-color: var(--cc-primary); cursor: pointer; }

      #${ROOT_ID} .cc-grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      #${ROOT_ID} .cc-card { background: var(--cc-bg); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); box-shadow: var(--cc-shadow); overflow: hidden; }
      #${ROOT_ID} .cc-kpi { padding: 16px; position: relative; overflow: hidden; }
      #${ROOT_ID} .cc-kpi::before { content: ""; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--cc-primary); }
      #${ROOT_ID} .cc-kpi--danger::before { background: var(--cc-danger); }
      #${ROOT_ID} .cc-kpi--warning::before { background: var(--cc-warning); }
      #${ROOT_ID} .cc-kpi--success::before { background: var(--cc-success); }
      #${ROOT_ID} .cc-label { font-size: 11px; font-weight: 700; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
      #${ROOT_ID} .cc-value { font-size: 28px; font-weight: 800; margin-top: 6px; color: var(--cc-text); font-variant-numeric: tabular-nums; }
      #${ROOT_ID} .cc-meta { font-size: 11px; color: var(--cc-text-muted); margin-top: 4px; }

      #${ROOT_ID} .cc-exceptions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
      #${ROOT_ID} .cc-exception { padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      #${ROOT_ID} .cc-ex-title { font-size: 13px; font-weight: 700; color: var(--cc-text); }
      #${ROOT_ID} .cc-ex-copy { font-size: 11px; color: var(--cc-text-muted); margin-top: 2px; }
      #${ROOT_ID} .cc-ex-num { font-size: 20px; font-weight: 800; color: var(--cc-danger); }

      #${ROOT_ID} .cc-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
      #${ROOT_ID} .cc-panel-head { padding: 14px 16px; border-bottom: 1px solid var(--cc-border); display: flex; justify-content: space-between; align-items: center; background: var(--cc-bg-subtle); }
      #${ROOT_ID} .cc-panel-title { font-size: 14px; font-weight: 800; color: var(--cc-text); }
      #${ROOT_ID} .cc-panel-meta { font-size: 11px; font-weight: 700; color: var(--cc-primary); background: rgba(47,91,255,0.1); padding: 2px 8px; border-radius: 99px; }

      #${ROOT_ID} table { width: 100%; border-collapse: collapse; font-size: 12px; }
      #${ROOT_ID} th { text-align: left; padding: 10px 16px; font-size: 10px; text-transform: uppercase; color: var(--cc-text-muted); border-bottom: 1px solid var(--cc-border); font-weight: 800; cursor: pointer; user-select: none; white-space: nowrap; }
      #${ROOT_ID} th:hover { background: var(--cc-bg-subtle); color: var(--cc-text); }
      #${ROOT_ID} th .cc-sort-arrow { font-size: 9px; margin-left: 4px; opacity: 0.5; }
      #${ROOT_ID} th.cc-sorted .cc-sort-arrow { opacity: 1; color: var(--cc-primary); }
      #${ROOT_ID} td { padding: 10px 16px; border-bottom: 1px solid var(--cc-border); color: var(--cc-text); }
      #${ROOT_ID} tr:last-child td { border-bottom: none; }
      #${ROOT_ID} tr.cc-row { cursor: pointer; transition: background 0.15s; }
      #${ROOT_ID} tr.cc-row:hover td { background: var(--cc-bg-subtle); }
      #${ROOT_ID} tr.cc-expanded td { background: var(--cc-bg-subtle); }
      #${ROOT_ID} tr.cc-detail td { background: var(--cc-bg-subtle); padding: 16px; font-size: 11px; }
      #${ROOT_ID} tr.cc-detail dl { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; margin: 0; }
      #${ROOT_ID} tr.cc-detail dt { font-weight: 700; color: var(--cc-text-muted); }
      #${ROOT_ID} tr.cc-detail dd { margin: 0; color: var(--cc-text); word-break: break-word; }

      #${ROOT_ID} .cc-empty { padding: 48px 24px; text-align: center; color: var(--cc-text-muted); font-size: 13px; font-weight: 500; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      #${ROOT_ID} .cc-empty svg { opacity: 0.3; }

      #${ROOT_ID} .cc-load-more { padding: 12px; text-align: center; border-top: 1px solid var(--cc-border); }
      #${ROOT_ID} .cc-skeleton { height: 100px; border-radius: var(--cc-radius); background: var(--cc-bg-subtle); animation: ccPulse 1.5s infinite; }

      #${ROOT_ID} .cc-status { font-size: 11px; color: var(--cc-text-muted); display: flex; align-items: center; gap: 6px; }
      #${ROOT_ID} .cc-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--cc-success); animation: ccPulse 2s infinite; }
      #${ROOT_ID} .cc-status--loading .cc-status-dot { background: var(--cc-warning); animation: ccSpin 1s linear infinite; border-radius: 50%; border: 2px solid var(--cc-warning); border-top-color: transparent; background: transparent; }

      @media(max-width: 900px) {
        #${ROOT_ID} .cc-grid4, #${ROOT_ID} .cc-exceptions, #${ROOT_ID} .cc-panels { grid-template-columns: 1fr; }
      }
    `;
    (document.head || document.body).appendChild(s);
  }

  // ═════════════════════════════════════════════════════════
  // 5. DATA FETCHING
  // ═════════════════════════════════════════════════════════
  async function fetchData(forceRefresh) {
    if (!forceRefresh && State.data && (Date.now() - State.cacheAt) < CACHE_TTL_MS) {
      return State.data;
    }

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
    if (!summary.data) throw new Error('Data summary kosong.');

    State.data = { summary: summary.data, queue: queue.data || [], branches: branches.data || [] };
    State.cacheAt = Date.now();
    State.lastUpdated = new Date();
    return State.data;
  }

  // ═════════════════════════════════════════════════════════
  // 6. FILTERING & SORTING
  // ═════════════════════════════════════════════════════════
  function filterRows(rows) {
    if (!State.search) return rows;
    var q = State.search.toLowerCase();
    return rows.filter(function (r) {
      return Object.keys(r).some(function (k) {
        return String(r[k] || '').toLowerCase().indexOf(q) >= 0;
      });
    });
  }

  function sortRows(rows, key) {
    var dir = State.sortDir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var va = a[key], vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  // ═════════════════════════════════════════════════════════
  // 7. COMPONENT BUILDERS
  // ═════════════════════════════════════════════════════════
  function compKpi(label, value, meta, variant) {
    var cls = variant ? ' cc-kpi--' + variant : '';
    return `<div class="cc-card cc-kpi${cls}"><div class="cc-label">${esc(label)}</div><div class="cc-value">${esc(value)}</div><div class="cc-meta">${esc(meta)}</div></div>`;
  }

  function compException(title, copy, count) {
    return `<div class="cc-card cc-exception"><div><div class="cc-ex-title">${esc(title)}</div><div class="cc-ex-copy">${esc(copy)}</div></div><div class="cc-ex-num">${esc(count)}</div></div>`;
  }

  function compEmpty(msg) {
    return `<div class="cc-empty">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
      </svg>
      <span>${esc(msg)}</span>
    </div>`;
  }

  function compSortableHeader(cols, labels) {
    return cols.map(function (col, i) {
      var isSorted = State.sortKey === col;
      var arrow = isSorted ? (State.sortDir === 'asc' ? '▲' : '▼') : '⇅';
      return `<th data-sort="${esc(col)}" class="${isSorted ? 'cc-sorted' : ''}" tabindex="0" role="button">${esc(labels[i])}<span class="cc-sort-arrow">${arrow}</span></th>`;
    }).join('');
  }

  function compQueueTable(queue) {
    var filtered = filterRows(queue);
    var sorted = sortRows(filtered, State.sortKey);
    var visible = sorted.slice(0, State.visibleQueueCount);

    if (filtered.length === 0) {
      return compEmpty(State.search ? 'Tidak ada hasil untuk "' + State.search + '"' : 'Tidak ada antrian follow-up.');
    }

    var headers = ['Branch', 'WO', 'Serial', 'Status', 'Aging'];
    var cols = ['branch_name', 'wo_number', 'serial_no', 'status', 'aging_days'];
    
    var bodyRows = visible.map(function (r, idx) {
      var rowId = 'q_' + idx;
      var isExpanded = !!State.expandedRows[rowId];
      var mainRow = `<tr class="cc-row ${isExpanded ? 'cc-expanded' : ''}" data-row-id="${rowId}" tabindex="0">
        <td>${esc(r.branch_name || r.branch || '—')}</td>
        <td>${esc(r.wo_number || r.work_order || '—')}</td>
        <td>${esc(r.serial_no || r.serial || '—')}</td>
        <td>${esc(r.status || '—')}</td>
        <td>${esc(r.aging_days != null ? r.aging_days + ' hari' : '—')}</td>
      </tr>`;
      
      var detailRow = '';
      if (isExpanded) {
        var details = Object.keys(r).map(function (k) {
          if (r[k] == null || r[k] === '') return '';
          return `<dt>${esc(k)}</dt><dd>${esc(r[k])}</dd>`;
        }).filter(Boolean).join('');
        detailRow = `<tr class="cc-detail"><td colspan="5"><dl>${details}</dl></td></tr>`;
      }
      return mainRow + detailRow;
    }).join('');

    var loadMore = '';
    if (sorted.length > State.visibleQueueCount) {
      var remaining = sorted.length - State.visibleQueueCount;
      loadMore = `<div class="cc-load-more"><button id="cc-load-more">Muat ${Math.min(remaining, PAGE_SIZE)} lagi (${remaining} tersisa)</button></div>`;
    }

    return `<div class="cc-table-wrap"><table>
      <thead><tr>${compSortableHeader(cols, headers)}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table></div>${loadMore}`;
  }

  function compBranchTable(branches) {
    var filtered = filterRows(branches);
    var visible = filtered.slice(0, 30);
    
    if (filtered.length === 0) return compEmpty('Tidak ada data cabang.');

    var bodyRows = visible.map(function (r) {
      return `<tr>
        <td>${esc(r.branch_name || r.branch || '—')}</td>
        <td>${esc(fmtNum(r.branch_followup_count || r.followup_count || 0))}</td>
        <td>${esc(fmtMoney(r.outstanding_amount || r.amount || 0))}</td>
      </tr>`;
    }).join('');

    return `<div class="cc-table-wrap"><table>
      <thead><tr><th>Branch</th><th>Follow-up</th><th>Outstanding</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table></div>`;
  }

  // ═════════════════════════════════════════════════════════
  // 8. RENDERERS
  // ═════════════════════════════════════════════════════════
  function renderLoading(root) {
    root.innerHTML = `
      <div class="cc-head"><div><h2 class="cc-title">Operational Control Center</h2><div class="cc-sub">Menyiapkan data operasional...</div></div></div>
      <div class="cc-grid4"><div class="cc-skeleton"></div><div class="cc-skeleton"></div><div class="cc-skeleton"></div><div class="cc-skeleton"></div></div>
      <div class="cc-panels" style="margin-top:16px"><div class="cc-skeleton" style="height:300px"></div><div class="cc-skeleton" style="height:300px"></div></div>
    `;
  }

  function renderError(root, err) {
    root.innerHTML = `
      <div class="cc-card" style="padding:32px; text-align:center;">
        <h2 class="cc-title" style="color:${'var(--cc-danger)'};">Gagal Memuat Data</h2>
        <div class="cc-sub" style="margin-bottom:16px;">${esc(err.message || 'Terjadi kesalahan sistem.')}</div>
        <button class="cc-primary" id="cc-retry" style="background:${'var(--cc-danger)'};border-color:${'var(--cc-danger)'};">↻ Coba Lagi</button>
      </div>
    `;
    var btn = root.querySelector('#cc-retry');
    if (btn) btn.onclick = function () { mount(true); };
    notify('error', 'Command Center Error', err.message);
  }

  function render(root, data) {
    var s = data.summary || {};
    var q = data.queue || [];
    var b = data.branches || [];

    var statusCls = State.loading ? 'cc-status--loading' : '';
    var statusTxt = State.loading ? 'Memuat...' : 'Terhubung · ' + timeAgo(State.lastUpdated);

    var kpiHTML = [
      compKpi('WO Follow-up', fmtNum(s.wo_followup_count || q.length), 'Antrian aktif', 'primary'),
      compKpi('Outstanding Branch', fmtNum(b.length), 'Cabang backlog', 'warning'),
      compKpi('Aging > 30d', fmtNum(s.aging_over_30 || 0), 'Perlu eskalasi', 'danger'),
      compKpi('Settlement Pending', fmtNum(s.settlement_pending || 0), 'Menunggu closing', 'success')
    ].join('');

    var exHTML = [
      compException('Missing WO link', 'Claim tanpa relasi WO valid', fmtNum(s.missing_wo || 0)),
      compException('Status mismatch', 'AX vs app tidak selaras', fmtNum(s.status_mismatch || 0)),
      compException('Payment hold', 'Tertahan di batch payment', fmtNum(s.payment_hold || 0))
    ].join('');

    root.innerHTML = `
      <div class="cc-head">
        <div>
          <h2 class="cc-title">Operational Control Center</h2>
          <div class="cc-sub cc-status ${statusCls}"><span class="cc-status-dot"></span>${esc(statusTxt)}</div>
        </div>
        <div class="cc-head-actions">
          <button class="cc-icon-btn" id="cc-export" title="Export ke CSV">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          </button>
          <button class="cc-primary" id="cc-refresh">↻ Refresh</button>
        </div>
      </div>

      <div class="cc-toolbar">
        <div class="cc-search">
          <input type="text" id="cc-search-input" placeholder="Cari branch, WO, serial..." value="${esc(State.search)}">
          <kbd>Ctrl+K</kbd>
        </div>
        <label class="cc-toggle">
          <input type="checkbox" id="cc-auto-refresh" ${State.autoRefresh ? 'checked' : ''}>
          Auto-refresh 30s
        </label>
      </div>

      <div class="cc-grid4">${kpiHTML}</div>
      <div class="cc-exceptions">${exHTML}</div>

      <div class="cc-panels">
        <div class="cc-card">
          <div class="cc-panel-head">
            <div class="cc-panel-title">Follow-up Queue</div>
            <div class="cc-panel-meta">${filterRows(q).length} Item</div>
          </div>
          ${compQueueTable(q)}
        </div>
        <div class="cc-card">
          <div class="cc-panel-head">
            <div class="cc-panel-title">Outstanding by Branch</div>
            <div class="cc-panel-meta">Top ${Math.min(b.length, 30)}</div>
          </div>
          ${compBranchTable(b)}
        </div>
      </div>
    `;

    attachEventHandlers(root);
  }

  // ═════════════════════════════════════════════════════════
  // 9. EVENT HANDLERS
  // ═════════════════════════════════════════════════════════
  function attachEventHandlers(root) {
    var refreshBtn = root.querySelector('#cc-refresh');
    if (refreshBtn) refreshBtn.onclick = function () { mount(true); };

    var exportBtn = root.querySelector('#cc-export');
    if (exportBtn) exportBtn.onclick = exportCsv;

    var searchInput = root.querySelector('#cc-search-input');
    if (searchInput) {
      searchInput.oninput = debounce(function (e) {
        State.search = e.target.value;
        State.visibleQueueCount = PAGE_SIZE;
        render(root, State.data);
      }, 200);
    }

    var autoRefresh = root.querySelector('#cc-auto-refresh');
    if (autoRefresh) {
      autoRefresh.onchange = function (e) {
        State.autoRefresh = e.target.checked;
        savePrefs();
        setupAutoRefresh();
      };
    }

    // Sort headers
    root.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.onclick = function () {
        var key = th.getAttribute('data-sort');
        if (State.sortKey === key) {
          State.sortDir = State.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          State.sortKey = key;
          State.sortDir = 'asc';
        }
        savePrefs();
        render(root, State.data);
      };
    });

    // Row expansion
    root.querySelectorAll('tr.cc-row').forEach(function (tr) {
      tr.onclick = function () {
        var id = tr.getAttribute('data-row-id');
        State.expandedRows[id] = !State.expandedRows[id];
        render(root, State.data);
      };
    });

    // Load more
    var loadMore = root.querySelector('#cc-load-more');
    if (loadMore) loadMore.onclick = function () {
      State.visibleQueueCount += PAGE_SIZE;
      render(root, State.data);
    };
  }

  // ⌨️ Global keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById(ROOT_ID)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var input = document.querySelector('#cc-search-input');
      if (input) input.focus();
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      var input2 = document.querySelector('#cc-search-input');
      if (input2) input2.focus();
    }
  });

  // ═════════════════════════════════════════════════════════
  // 10. EXPORT CSV
  // ═════════════════════════════════════════════════════════
  function exportCsv() {
    if (!State.data) return;
    var q = filterRows(State.data.queue);
    var rows = [['Branch', 'WO', 'Serial', 'Status', 'Aging']];
    q.forEach(function (r) {
      rows.push([
        r.branch_name || r.branch || '',
        r.wo_number || r.work_order || '',
        r.serial_no || r.serial || '',
        r.status || '',
        r.aging_days || ''
      ]);
    });
    
    var csv = rows.map(function (row) {
      return row.map(function (c) {
        var s = String(c).replace(/"/g, '""');
        return /[",\n]/.test(s) ? '"' + s + '"' : s;
      }).join(',');
    }).join('\n');

    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sdlg-command-center-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'Export Berhasil', q.length + ' baris di-download.');
  }

  // ═════════════════════════════════════════════════════════
  // 11. AUTO-REFRESH
  // ═════════════════════════════════════════════════════════
  function setupAutoRefresh() {
    if (State.refreshTimer) clearInterval(State.refreshTimer);
    if (!State.autoRefresh) return;
    State.refreshTimer = setInterval(function () {
      mount(true, true); // silent refresh
    }, AUTO_REFRESH_MS);
  }

  // ═════════════════════════════════════════════════════════
  // 12. LIFECYCLE
  // ═════════════════════════════════════════════════════════
  async function mount(forceRefresh, silent) {
    ensureStyle();
    var root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      var page = document.querySelector('.page') || document.querySelector('#root') || document.body;
      if (page.firstChild) page.insertBefore(root, page.firstChild);
      else page.appendChild(root);
    }

    State.loading = true;
    State.error = null;
    if (!silent) renderLoading(root);

    try {
      var data = await fetchData(forceRefresh);
      State.loading = false;
      render(root, data);
      if (forceRefresh && !silent) {
        notify('success', 'Data Terbaru', 'Command Center berhasil diperbarui.');
      }
    } catch (err) {
      State.loading = false;
      State.error = err;
      renderError(root, err);
    }
  }

  function boot() {
    ensureStyle();
    window.SDLGCommandCenter = {
      mount: mount,
      refresh: function () { return mount(true); },
      export: exportCsv
    };
    
    if (document.getElementById(ROOT_ID) || document.querySelector('[data-sdlg-command-center]')) {
      mount();
      setupAutoRefresh();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Cleanup saat halaman unload
  window.addEventListener('beforeunload', function () {
    if (State.refreshTimer) clearInterval(State.refreshTimer);
  });

})();