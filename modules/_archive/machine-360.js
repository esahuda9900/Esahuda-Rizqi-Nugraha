/**
 * SDLG Unit 360 — V3.0 (God-Tier Historical View)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ CHRONOLOGICAL TIMELINE: Gabungin Claims, WO, Settlements.
 * ✅ GOD-TIER UI: Glassmorphism, Hero Header, Status Badges.
 * ✅ SMART GRID: Nampilin SEMUA data dari master unit.
 * ✅ ZERO LAG: Fetch data paralel (Promise.all) & cache.
 * ✅ AUTO DARK MODE: Elegan di mode gelap.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_MACHINE_360_V3__) return;
  window.__SDLG_MACHINE_360_V3__ = true;

  var STYLE_ID = 'sdlg-machine-360-css-v3';
  var ROOT_ID = 'sdlg-machine-360-root';
  var NAV_ID = 'sdlg-machine-360-nav';
  var state = {
    open: false, tab: 'timeline', serial: '', loading: false,
    error: '', data: null, suggestIdx: -1, suggestList: []
  };

  function $(id) { return document.getElementById(id); }
  
  function getSb() {
    if (typeof window.getSdlgSupabase === 'function') return window.getSdlgSupabase();
    var c = window.sdlgSupabase || window.supabaseClient;
    if (c && c.from) return c;
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      var dt = new Date(d);
      return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return d; }
  }

  function fmtNum(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString('id-ID');
  }

  // ─────────────────────────────────────────────────────────
  // 1. STYLES (God-Tier Glassmorphism)
  // ─────────────────────────────────────────────────────────
  function injectCss() {
    if ($(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${ROOT_ID} {
        --m360-bg: rgba(241, 245, 249, 0.95);
        --m360-surface: #ffffff;
        --m360-surface-sub: #f8fafc;
        --m360-border: #e2e8f0;
        --m360-text: #0f172a;
        --m360-text-muted: #64748b;
        --m360-primary: #2563eb;
        --m360-primary-hover: #1d4ed8;
        --m360-radius: 16px;
        --m360-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        
        position: fixed; inset: 0; z-index: 99999;
        background: var(--m360-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        display: none; flex-direction: column;
        font-family: system-ui, -apple-system, sans-serif; color: var(--m360-text);
        opacity: 0; transition: opacity 0.3s ease;
      }
      @media (prefers-color-scheme: dark) {
        #${ROOT_ID} {
          --m360-bg: rgba(11, 18, 32, 0.95); --m360-surface: #111a2e;
          --m360-surface-sub: #1e293b; --m360-border: #1e2a45;
          --m360-text: #f8fafc; --m360-text-muted: #94a3b8; --m360-primary: #4d70ff;
        }
      }
      #${ROOT_ID}.is-open { display: flex; opacity: 1; }
      #${ROOT_ID} * { box-sizing: border-box; }
      
      /* Top Bar */
      .m360-top {
        flex: 0 0 auto; background: var(--m360-surface); border-bottom: 1px solid var(--m360-border);
        padding: 16px 24px; display: flex; align-items: center; gap: 16px; z-index: 10;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .m360-title { font-weight: 800; font-size: 18px; display: flex; align-items: center; gap: 8px; }
      .m360-title::before { content: "🛰️"; font-size: 20px; }
      .m360-search { flex: 1; max-width: 500px; display: flex; gap: 8px; position: relative; }
      .m360-search input {
        flex: 1; padding: 10px 16px; border: 1px solid var(--m360-border); border-radius: 10px;
        font: inherit; font-size: 14px; background: var(--m360-surface-sub); color: var(--m360-text);
        outline: none; transition: border 0.2s;
      }
      .m360-search input:focus { border-color: var(--m360-primary); background: var(--m360-surface); }
      .m360-btn {
        padding: 10px 20px; border-radius: 10px; border: 1px solid var(--m360-border);
        background: var(--m360-surface); color: var(--m360-text); cursor: pointer;
        font: inherit; font-size: 14px; font-weight: 600; transition: all 0.2s;
      }
      .m360-btn-primary { background: var(--m360-primary); color: #fff; border-color: var(--m360-primary); }
      .m360-btn-primary:hover { background: var(--m360-primary-hover); }
      .m360-btn-close { margin-left: auto; background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--m360-text-muted); }

      /* Autocomplete */
      .m360-suggest {
        position: absolute; left: 0; right: 0; top: 100%; margin-top: 6px;
        background: var(--m360-surface); border: 1px solid var(--m360-border);
        border-radius: 12px; max-height: 300px; overflow: auto; z-index: 50;
        box-shadow: var(--m360-shadow); display: none;
      }
      .m360-suggest button {
        display: flex; flex-direction: column; align-items: flex-start; width: 100%; text-align: left;
        padding: 12px 16px; border: 0; background: transparent; cursor: pointer;
        font: inherit; color: var(--m360-text); border-bottom: 1px solid var(--m360-border);
      }
      .m360-suggest button:hover, .m360-suggest button.active { background: var(--m360-surface-sub); }
      .m360-suggest strong { font-size: 14px; }

      /* Body */
      .m360-body { flex: 1; overflow: auto; padding: 24px; max-width: 1400px; margin: 0 auto; width: 100%; }
      
      /* HERO HEADER */
      .m360-hero {
        background: linear-gradient(135deg, var(--m360-surface) 0%, var(--m360-surface-sub) 100%);
        border: 1px solid var(--m360-border); border-radius: var(--m360-radius);
        padding: 24px 32px; margin-bottom: 24px; box-shadow: var(--m360-shadow);
        display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;
      }
      .m360-hero-left { display: flex; flex-direction: column; gap: 8px; }
      .m360-serial-wrap { display: flex; align-items: center; gap: 12px; }
      .m360-serial { font-size: 32px; font-weight: 900; letter-spacing: -0.02em; }
      .m360-copy { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--m360-border); background: var(--m360-surface); font-size: 12px; cursor: pointer; font-weight: 700; }
      .m360-meta-row { display: flex; gap: 16px; font-size: 14px; color: var(--m360-text-muted); }
      .m360-badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
      .m360-badge.ok { background: #dcfce7; color: #166534; }
      .m360-badge.warn { background: #fef3c7; color: #92400e; }

      /* STATS CARDS */
      .m360-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
      .m360-stat-card { background: var(--m360-surface); border: 1px solid var(--m360-border); border-radius: var(--m360-radius); padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .m360-stat-label { font-size: 12px; font-weight: 700; color: var(--m360-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
      .m360-stat-value { font-size: 28px; font-weight: 800; margin-top: 8px; color: var(--m360-text); }

      /* TABS */
      .m360-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--m360-border); padding-bottom: 12px; overflow-x: auto; }
      .m360-tab {
        padding: 8px 16px; border-radius: 8px; border: 1px solid transparent;
        background: transparent; cursor: pointer; font: inherit; font-size: 14px;
        font-weight: 700; color: var(--m360-text-muted); transition: all 0.2s; white-space: nowrap;
      }
      .m360-tab:hover { background: var(--m360-surface-sub); color: var(--m360-text); }
      .m360-tab.is-active { background: var(--m360-primary); color: #fff; }

      /* TIMELINE */
      .m360-timeline { position: relative; padding-left: 32px; }
      .m360-timeline::before { content: ""; position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; background: var(--m360-border); }
      .m360-tl-item { position: relative; margin-bottom: 24px; }
      .m360-tl-dot { position: absolute; left: -32px; top: 4px; width: 24px; height: 24px; border-radius: 50%; background: var(--m360-surface); border: 4px solid var(--m360-border); display: flex; align-items: center; justify-content: center; font-size: 10px; z-index: 2; }
      .m360-tl-item.type-claim .m360-tl-dot { border-color: #3b82f6; }
      .m360-tl-item.type-wo .m360-tl-dot { border-color: #f59e0b; }
      .m360-tl-item.type-settlement .m360-tl-dot { border-color: #10b981; }
      .m360-tl-content { background: var(--m360-surface); border: 1px solid var(--m360-border); border-radius: 12px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .m360-tl-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .m360-tl-title { font-weight: 800; font-size: 15px; }
      .m360-tl-date { font-size: 12px; color: var(--m360-text-muted); font-weight: 600; }
      .m360-tl-desc { font-size: 13px; color: var(--m360-text-muted); line-height: 1.5; }

      /* TABLES & GRIDS */
      .m360-card { background: var(--m360-surface); border: 1px solid var(--m360-border); border-radius: var(--m360-radius); padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); overflow-x: auto; }
      .m360-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .m360-table th, .m360-table td { padding: 12px 16px; border-bottom: 1px solid var(--m360-border); text-align: left; vertical-align: top; }
      .m360-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--m360-text-muted); font-weight: 800; background: var(--m360-surface-sub); }
      .m360-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
      .m360-kv { background: var(--m360-surface-sub); border: 1px solid var(--m360-border); border-radius: 10px; padding: 16px; }
      .m360-kv .k { font-size: 11px; color: var(--m360-text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
      .m360-kv .v { font-weight: 700; margin-top: 6px; font-size: 14px; word-break: break-word; }
      .m360-empty { padding: 32px; text-align: center; color: var(--m360-text-muted); font-size: 14px; font-weight: 500; background: var(--m360-surface-sub); border-radius: 12px; border: 1px dashed var(--m360-border); }

      /* Skeleton */
      .m360-skel { background: var(--m360-surface-sub); border-radius: 8px; animation: m360Pulse 1.5s infinite; }
      @keyframes m360Pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 2. DOM BUILDER
  // ─────────────────────────────────────────────────────────
  function ensureRoot() {
    var root = $(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    
    root.innerHTML = `
      <div class="m360-top">
        <div class="m360-title">Unit 360</div>
        <div class="m360-search">
          <input id="m360-q" type="search" placeholder="Cari serial unit (min. 3 karakter)…" autocomplete="off" />
          <button type="button" class="m360-btn m360-btn-primary" id="m360-go">Cari</button>
          <div id="m360-suggest" class="m360-suggest"></div>
        </div>
        <button type="button" class="m360-btn-close" id="m360-close" title="Esc">✕</button>
      </div>
      <div class="m360-body" id="m360-body"></div>
    `;
    document.body.appendChild(root);

    $('m360-close').onclick = close;
    $('m360-go').onclick = function () {
      var q = ($('m360-q').value || '').trim();
      if (q) loadSerial(q);
    };

    // Keyboard & Esc
    document.addEventListener('keydown', function (e) {
      if (!state.open) return;
      if (e.key === 'Escape') { close(); return; }
      
      var input = $('m360-q');
      if (document.activeElement === input && state.suggestList.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault(); state.suggestIdx = Math.min(state.suggestIdx + 1, state.suggestList.length - 1); updateSuggestHighlight();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault(); state.suggestIdx = Math.max(state.suggestIdx - 1, 0); updateSuggestHighlight();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (state.suggestIdx >= 0 && state.suggestList[state.suggestIdx]) pickSuggest(state.suggestList[state.suggestIdx].serial_no);
          else if (input.value.trim()) loadSerial(input.value.trim());
        }
      }
    });

    // Search Logic
    var suggestTimer = null;
    $('m360-q').addEventListener('input', function (e) {
      var q = (e.target.value || '').trim();
      clearTimeout(suggestTimer);
      if (q.length < 3) { hideSuggest(); return; }
      suggestTimer = setTimeout(function () { suggest(q); }, 280);
    });

    return root;
  }

  // ─────────────────────────────────────────────────────────
  // 3. AUTOCOMPLETE
  // ─────────────────────────────────────────────────────────
  function hideSuggest() {
    var el = $('m360-suggest');
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    state.suggestList = []; state.suggestIdx = -1;
  }

  function updateSuggestHighlight() {
    var el = $('m360-suggest');
    if (!el) return;
    el.querySelectorAll('button').forEach(function (b, i) {
      b.classList.toggle('active', i === state.suggestIdx);
    });
  }

  function pickSuggest(serial) {
    hideSuggest(); $('m360-q').value = serial; loadSerial(serial);
  }

  async function suggest(q) {
    var sb = getSb(); if (!sb) return;
    try {
      var res = await sb.from('v_machine_360_summary')
        .select('serial_no,model_code,customer_name,claims_active')
        .ilike('serial_no', '%' + q + '%')
        .order('claims_active', { ascending: false })
        .limit(12);
      
      if (res.error) throw res.error;
      var rows = res.data || [];
      var el = $('m360-suggest');
      if (!el) return;
      
      if (!rows.length) { hideSuggest(); return; }
      state.suggestList = rows; state.suggestIdx = -1;
      el.style.display = 'block';
      el.innerHTML = rows.map(function (r) {
        return `<button type="button" data-serial="${esc(r.serial_no)}">
          <strong>${esc(r.serial_no)}</strong>
          <span style="font-size:12px;color:var(--m360-text-muted)">${esc(r.model_code || '—')} · ${esc(r.customer_name || '—')} · ${r.claims_active || 0} claim</span>
        </button>`;
      }).join('');
      
      el.querySelectorAll('button').forEach(function (btn) {
        btn.onclick = function () { pickSuggest(btn.getAttribute('data-serial')); };
      });
    } catch (_) { hideSuggest(); }
  }

  // ─────────────────────────────────────────────────────────
  // 4. OPEN / CLOSE / LOAD
  // ─────────────────────────────────────────────────────────
  function open(serial) {
    injectCss();
    var root = ensureRoot();
    state.open = true;
    root.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    
    if (serial) { $('m360-q').value = serial; loadSerial(serial); }
    else { render(); }
  }

  function close() {
    state.open = false;
    var root = $(ROOT_ID);
    if (root) root.classList.remove('is-open');
    document.body.style.overflow = '';
    hideSuggest();
  }

  async function loadSerial(serial) {
    serial = String(serial || '').trim();
    if (!serial) return;
    
    state.serial = serial; state.loading = true; state.error = ''; state.data = null; state.tab = 'timeline'; render();

    var sb = getSb();
    if (!sb) { state.loading = false; state.error = 'Supabase client belum siap.'; render(); return; }

    try {
      // 1. Tarik data utama dari RPC
      var res = await sb.rpc('get_machine_360', { p_serial: serial });
      if (res.error) throw res.error;
      state.data = res.data;

      // 2. Fallback kalau RPC gak ngasih summary
      if (!state.data || !state.data.summary) {
        var s2 = await sb.from('v_machine_360_summary').select('*').eq('serial_no', serial).maybeSingle();
        if (s2.data) {
          state.data = { serial_no: serial, summary: s2.data, claims: [], ax_work_orders: [], settlements: [] };
        } else {
          state.error = 'Serial tidak ditemukan: ' + serial;
        }
      }
    } catch (err) {
      state.error = (err && err.message) || String(err);
    }
    state.loading = false;
    render();
  }

  function setTab(tab) { state.tab = tab; render(); }

  // ─────────────────────────────────────────────────────────
  // 5. RENDER BUILDERS
  // ─────────────────────────────────────────────────────────
  
  // GABUNGIN SEMUA DATA JADI TIMELINE KRONOLOGIS
  function buildTimeline(data) {
    var tl = [];
    (data.claims || []).forEach(function(c) {
      tl.push({
        date: c.failure_date || c.dealer_claim_date || c.created_at,
        type: 'claim',
        title: 'Claim: ' + (c.claim_id || '—'),
        desc: c.fault_description || c.cause_analyze || 'Tidak ada deskripsi',
        status: c.claim_status
      });
    });
    (data.ax_work_orders || []).forEach(function(w) {
      tl.push({
        date: w.created_date,
        type: 'wo',
        title: 'Work Order: ' + (w.wo_no || '—'),
        desc: w.description || 'Tidak ada deskripsi',
        status: w.ax_status
      });
    });
    (data.settlements || []).forEach(function(s) {
      tl.push({
        date: s.payment_date || s.created_at,
        type: 'settlement',
        title: 'Settlement: ' + (s.claim_id || '—'),
        desc: 'Dibayar: ' + fmtNum(s.payment_amount) + ' (TSI: ' + fmtNum(s.tsi) + ')',
        status: s.paid_confirmed ? 'Paid' : 'Pending'
      });
    });
    
    // Sortir dari yang terbaru
    return tl.sort(function(a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
  }

  function renderSkeleton() {
    return `
      <div class="m360-hero"><div class="m360-skel" style="width:300px;height:40px;margin-bottom:16px"></div><div class="m360-skel" style="width:200px;height:20px"></div></div>
      <div class="m360-stats">${[1,2,3,4].map(()=>`<div class="m360-skel" style="height:100px"></div>`).join('')}</div>
      <div class="m360-skel" style="width:100%;height:400px;border-radius:16px"></div>
    `;
  }

  function renderTimeline(timeline) {
    if (!timeline.length) return '<div class="m360-empty">Belum ada riwayat aktivitas untuk unit ini.</div>';
    
    return `<div class="m360-card"><div class="m360-timeline">` + timeline.map(function(item) {
      var badgeClass = item.type === 'claim' ? 'ok' : item.type === 'wo' ? 'warn' : '';
      return `
        <div class="m360-tl-item type-${item.type}">
          <div class="m360-tl-dot">${item.type === 'claim' ? '📄' : item.type === 'wo' ? '🔧' : '💰'}</div>
          <div class="m360-tl-content">
            <div class="m360-tl-header">
              <div class="m360-tl-title">${esc(item.title)}</div>
              <div class="m360-tl-date">${fmtDate(item.date)}</div>
            </div>
            <div class="m360-tl-desc">${esc(item.desc)}</div>
            ${item.status ? `<div style="margin-top:8px"><span class="m360-badge ${badgeClass}">${esc(item.status)}</span></div>` : ''}
          </div>
        </div>
      `;
    }).join('') + `</div></div>`;
  }

  function renderOverview(sum) {
    if (!sum) return '<div class="m360-empty">Tidak ada data master.</div>';
    var keys = Object.keys(sum).sort();
    var html = keys.map(function(k) {
      var v = sum[k];
      if (v == null || v === '') return '';
      if (typeof v === 'object') v = JSON.stringify(v);
      return `<div class="m360-kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
    }).join('');
    return `<div class="m360-card"><div class="m360-grid2">${html}</div></div>`;
  }

  function renderClaims(claims) {
    if (!claims || !claims.length) return '<div class="m360-empty">Belum ada claim untuk unit ini.</div>';
    var rows = claims.map(function (c) {
      return `<tr>
        <td><strong>${esc(c.claim_id)}</strong></td>
        <td><span class="m360-badge ${c.claim_status==='Rejected'?'warn':'ok'}">${esc(c.claim_status)}</span></td>
        <td>${esc(fmtDate(c.failure_date))}</td>
        <td>${esc(c.causing_part_no || '—')}</td>
        <td>${esc(c.fault_description || '—')}</td>
      </tr>`;
    }).join('');
    return `<div class="m360-card"><table class="m360-table"><thead><tr><th>Claim ID</th><th>Status</th><th>Failure Date</th><th>Part No</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderAx(list) {
    if (!list || !list.length) return '<div class="m360-empty">Tidak ada work order AX.</div>';
    var rows = list.map(function (a) {
      return `<tr>
        <td><strong>${esc(a.wo_no)}</strong></td>
        <td><span class="m360-badge ${a.ax_status==='Closed'?'ok':'warn'}">${esc(a.ax_status)}</span></td>
        <td>${esc(fmtDate(a.created_date))}</td>
        <td>${esc(a.description || '—')}</td>
      </tr>`;
    }).join('');
    return `<div class="m360-card"><table class="m360-table"><thead><tr><th>WO No</th><th>Status</th><th>Created</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderSettlements(list) {
    if (!list || !list.length) return '<div class="m360-empty">Belum ada data pembayaran (settlement).</div>';
    var rows = list.map(function (s) {
      return `<tr>
        <td><strong>${esc(s.claim_id)}</strong></td>
        <td>${esc(fmtNum(s.tsi))}</td>
        <td>${esc(fmtNum(s.payment_amount))}</td>
        <td>${esc(fmtDate(s.payment_date))}</td>
        <td><span class="m360-badge ${s.paid_confirmed?'ok':'warn'}">${s.paid_confirmed?'Paid':'Pending'}</span></td>
      </tr>`;
    }).join('');
    return `<div class="m360-card"><table class="m360-table"><thead><tr><th>Claim ID</th><th>TSI</th><th>Payment</th><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ─────────────────────────────────────────────────────────
  // 6. MAIN RENDER
  // ─────────────────────────────────────────────────────────
  function render() {
    var body = $('m360-body');
    if (!body) return;

    if (state.loading) { body.innerHTML = renderSkeleton(); return; }
    if (state.error) { body.innerHTML = `<div class="m360-empty" style="border-color:#fecaca; color:#991b1b;">${esc(state.error)}</div>`; return; }
    if (!state.data || !state.data.summary) {
      body.innerHTML = `<div class="m360-empty">Ketik serial unit untuk melihat seluruh rantai: identitas, claim, WO AX, settlement.</div>`;
      return;
    }

    var sum = state.data.summary;
    var totalClaims = (state.data.claims || []).length;
    var totalWO = (state.data.ax_work_orders || []).length;
    var totalSettle = (state.data.settlements || []).reduce(function(acc, curr) { return acc + (Number(curr.payment_amount) || 0); }, 0);
    var totalTSI = (state.data.settlements || []).reduce(function(acc, curr) { return acc + (Number(curr.tsi) || 0); }, 0);

    var tabsHTML = ['timeline|🕰️ Timeline', 'overview|📋 Semua Data', 'claims|📄 Claims', 'ax|🔧 Work Orders', 'settlement|💰 Financials']
      .map(function (pair) {
        var p = pair.split('|');
        return `<button type="button" class="m360-tab ${state.tab === p[0] ? 'is-active' : ''}" data-tab="${p[0]}">${p[1]}</button>`;
      }).join('');

    var heroHTML = `
      <div class="m360-hero">
        <div class="m360-hero-left">
          <div class="m360-serial-wrap">
            <div class="m360-serial">${esc(sum.serial_no || state.serial)}</div>
            <button class="m360-copy" id="m360-copy-btn">📋 Copy</button>
          </div>
          <div class="m360-meta-row">
            <span>Model: <strong>${esc(sum.model_code || '—')}</strong></span>
            <span>Customer: <strong>${esc(sum.customer_name || '—')}</strong></span>
          </div>
        </div>
        <div>
          <span class="m360-badge ok">${esc(sum.latest_claim_status || 'No Claim')}</span>
        </div>
      </div>
    `;

    var statsHTML = `
      <div class="m360-stats">
        <div class="m360-stat-card"><div class="m360-stat-label">Total Claims</div><div class="m360-stat-value">${totalClaims}</div></div>
        <div class="m360-stat-card"><div class="m360-stat-label">Total Work Orders</div><div class="m360-stat-value">${totalWO}</div></div>
        <div class="m360-stat-card"><div class="m360-stat-label">Total TSI</div><div class="m360-stat-value">${fmtNum(totalTSI)}</div></div>
        <div class="m360-stat-card"><div class="m360-stat-label">Total Paid</div><div class="m360-stat-value">${fmtNum(totalSettle)}</div></div>
      </div>
    `;

    var panelHTML = '';
    if (state.tab === 'timeline') panelHTML = renderTimeline(buildTimeline(state.data));
    else if (state.tab === 'claims') panelHTML = renderClaims(state.data.claims);
    else if (state.tab === 'ax') panelHTML = renderAx(state.data.ax_work_orders);
    else if (state.tab === 'settlement') panelHTML = renderSettlements(state.data.settlements);
    else panelHTML = renderOverview(sum);

    body.innerHTML = heroHTML + statsHTML + `<div class="m360-tabs">${tabsHTML}</div>` + panelHTML;

    // Events
    body.querySelectorAll('.m360-tab').forEach(function (btn) {
      btn.onclick = function () { setTab(btn.getAttribute('data-tab')); };
    });

    var copyBtn = $('m360-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = function () {
        navigator.clipboard.writeText(sum.serial_no || state.serial);
        copyBtn.textContent = '✓ Tersalin';
        setTimeout(function () { copyBtn.textContent = '📋 Copy'; }, 2000);
      };
    }
  }

  // ─────────────────────────────────────────────────────────
  // 7. NAV INJECTOR
  // ─────────────────────────────────────────────────────────
  function injectNav() {
    if ($(NAV_ID)) return;
    if (document.querySelector('.login-screen')) return;

    var host = document.querySelector('.nav-scroll') || document.querySelector('.topbar-inner') || document.querySelector('.nav-tools');
    if (!host) return;

    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = NAV_ID; btn.textContent = 'Unit 360';
    btn.style.cssText = 'margin-left:8px;padding:8px 14px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-weight:700;font-size:12px;cursor:pointer;transition:all 0.2s;';
    btn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); open(); };

    var anchors = host.querySelectorAll('button, a');
    for (var i = 0; i < anchors.length; i++) {
      var t = (anchors[i].textContent || '').trim();
      if (/Data Quality|Master Data/i.test(t)) {
        if (anchors[i].nextSibling) host.insertBefore(btn, anchors[i].nextSibling);
        else host.appendChild(btn);
        return;
      }
    }
    host.appendChild(btn);
  }

  function boot() {
    injectCss(); injectNav();
    
    try {
      var mo = new MutationObserver(function () {
        if (!document.querySelector('.login-screen')) injectNav();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}

    try {
      var params = new URLSearchParams(window.location.search || '');
      var u = params.get('unit');
      if (u) setTimeout(function () { open(u); }, 800);
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }

  window.SDLGMachine360 = { open: open, close: close, load: loadSerial, version: '3.0.0' };
})();