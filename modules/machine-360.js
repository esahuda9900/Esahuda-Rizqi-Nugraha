/**
 * SDLG Unit 360 — additive feature only.
 * Does NOT modify Claims / Dashboard / Master Data behaviour.
 * Entry: nav button "Unit 360" + window.SDLGMachine360.open(serial)
 * Data: rpc get_machine_360(p_serial)
 */
(function () {
  'use strict';

  var STYLE_ID = 'sdlg-machine-360-css';
  var ROOT_ID = 'sdlg-machine-360-root';
  var NAV_ID = 'sdlg-machine-360-nav';
  var state = {
    open: false,
    tab: 'ringkas',
    serial: '',
    loading: false,
    error: '',
    data: null,
    suggestions: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getSb() {
    var c = window.sdlgSupabase || window.supabaseClient || (window.SDLG && window.SDLG.supabase);
    if (c && c.auth) return c;
    if (window.supabase && window.supabase.from) return window.supabase;
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function injectCss() {
    if ($(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + ROOT_ID + '{position:fixed;inset:0;z-index:100000;background:#f1f5f9;display:none;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;}',
      '#' + ROOT_ID + '.is-open{display:flex;}',
      '#' + ROOT_ID + ' *{box-sizing:border-box;}',
      '.m360-top{flex:0 0 auto;background:#fff;border-bottom:1px solid #e2e8f0;padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;}',
      '.m360-title{font-weight:700;font-size:16px;margin-right:8px;}',
      '.m360-search{flex:1 1 220px;min-width:160px;display:flex;gap:8px;position:relative;}',
      '.m360-search input{flex:1;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;}',
      '.m360-search button,.m360-btn{padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font:inherit;font-weight:600;}',
      '.m360-btn-primary{background:#2563eb;color:#fff;border-color:#2563eb;}',
      '.m360-btn-close{margin-left:auto;}',
      '.m360-suggest{position:absolute;left:0;right:48px;top:100%;margin-top:4px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;max-height:240px;overflow:auto;z-index:2;box-shadow:0 8px 24px rgba(15,23,42,.12);}',
      '.m360-suggest button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;background:transparent;cursor:pointer;font:inherit;border-bottom:1px solid #f1f5f9;}',
      '.m360-suggest button:hover{background:#f8fafc;}',
      '.m360-body{flex:1 1 auto;overflow:auto;padding:16px;max-width:1200px;margin:0 auto;width:100%;}',
      '.m360-msg{padding:12px 14px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;color:#64748b;}',
      '.m360-err{background:#fef2f2;border-color:#fecaca;color:#b91c1c;}',
      '.m360-header{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:14px;}',
      '.m360-serial{font-size:20px;font-weight:800;letter-spacing:0.02em;}',
      '.m360-meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:8px;font-size:13px;color:#475569;}',
      '.m360-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}',
      '.m360-chip{background:#f1f5f9;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;color:#334155;}',
      '.m360-chip strong{color:#0f172a;}',
      '.m360-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}',
      '.m360-tab{padding:8px 14px;border-radius:999px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font:inherit;font-size:13px;font-weight:600;color:#475569;}',
      '.m360-tab.is-active{background:#2563eb;border-color:#2563eb;color:#fff;}',
      '.m360-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;overflow:auto;}',
      '.m360-table{width:100%;border-collapse:collapse;font-size:13px;}',
      '.m360-table th,.m360-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:top;}',
      '.m360-table th{font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;}',
      '.m360-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#e2e8f0;}',
      '.m360-pill.ok{background:#dcfce7;color:#166534;}',
      '.m360-pill.warn{background:#ffedd5;color:#9a3412;}',
      '.m360-pill.bad{background:#fee2e2;color:#991b1b;}',
      '.m360-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;}',
      '.m360-kv{background:#f8fafc;border-radius:10px;padding:10px 12px;}',
      '.m360-kv .k{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;}',
      '.m360-kv .v{font-weight:700;margin-top:4px;word-break:break-word;}',
      '#' + NAV_ID + '{white-space:nowrap;}',
      '@media (max-width:640px){.m360-title{width:100%;}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureRoot() {
    var root = $(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('data-sdlg-machine-360', '1');
    root.innerHTML = [
      '<div class="m360-top">',
      '  <div class="m360-title">Unit 360</div>',
      '  <div class="m360-search">',
      '    <input id="m360-q" type="search" placeholder="Cari serial unit…" autocomplete="off" />',
      '    <button type="button" class="m360-btn m360-btn-primary" id="m360-go">Cari</button>',
      '    <div id="m360-suggest" class="m360-suggest" style="display:none"></div>',
      '  </div>',
      '  <button type="button" class="m360-btn m360-btn-close" id="m360-close">Tutup · kembali ke app</button>',
      '</div>',
      '<div class="m360-body" id="m360-body">',
      '  <div class="m360-msg">Ketik serial unit untuk melihat seluruh rantai: identitas, claim, WO AX, settlement.</div>',
      '</div>'
    ].join('');
    document.body.appendChild(root);

    $('m360-close').addEventListener('click', close);
    $('m360-go').addEventListener('click', function () {
      var q = ($('m360-q') && $('m360-q').value || '').trim();
      if (q) loadSerial(q);
    });
    $('m360-q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var q = (e.target.value || '').trim();
        if (q) loadSerial(q);
      }
    });
    var suggestTimer = null;
    $('m360-q').addEventListener('input', function (e) {
      var q = (e.target.value || '').trim();
      clearTimeout(suggestTimer);
      if (q.length < 3) {
        hideSuggest();
        return;
      }
      suggestTimer = setTimeout(function () { suggest(q); }, 280);
    });
    return root;
  }

  function hideSuggest() {
    var el = $('m360-suggest');
    if (el) {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  async function suggest(q) {
    var sb = getSb();
    if (!sb) return;
    try {
      var res = await sb
        .from('v_machine_360_summary')
        .select('serial_no,model_code,customer_name,claims_active')
        .ilike('serial_no', '%' + q + '%')
        .order('claims_active', { ascending: false })
        .limit(12);
      if (res.error) throw res.error;
      var rows = res.data || [];
      var el = $('m360-suggest');
      if (!el) return;
      if (!rows.length) {
        hideSuggest();
        return;
      }
      el.style.display = 'block';
      el.innerHTML = rows
        .map(function (r) {
          return (
            '<button type="button" data-serial="' +
            esc(r.serial_no) +
            '">' +
            '<strong>' +
            esc(r.serial_no) +
            '</strong> · ' +
            esc(r.model_code || '—') +
            ' · ' +
            esc(r.customer_name || '—') +
            ' · ' +
            (r.claims_active || 0) +
            ' claim</button>'
          );
        })
        .join('');
      Array.prototype.forEach.call(el.querySelectorAll('button'), function (btn) {
        btn.addEventListener('click', function () {
          var ser = btn.getAttribute('data-serial');
          hideSuggest();
          if ($('m360-q')) $('m360-q').value = ser;
          loadSerial(ser);
        });
      });
    } catch (_) {
      hideSuggest();
    }
  }

  function open(serial) {
    injectCss();
    var root = ensureRoot();
    state.open = true;
    root.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (serial) {
      if ($('m360-q')) $('m360-q').value = serial;
      loadSerial(serial);
    } else {
      render();
    }
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
    state.serial = serial;
    state.loading = true;
    state.error = '';
    state.data = null;
    state.tab = 'ringkas';
    render();
    hideSuggest();

    var sb = getSb();
    if (!sb) {
      state.loading = false;
      state.error = 'Supabase client belum siap. Login dulu, lalu buka Unit 360 lagi.';
      render();
      return;
    }

    try {
      var res = await sb.rpc('get_machine_360', { p_serial: serial });
      if (res.error) throw res.error;
      state.data = res.data;
      if (!state.data || !state.data.summary) {
        // fallback: try summary view only
        var s2 = await sb.from('v_machine_360_summary').select('*').eq('serial_no', serial).maybeSingle();
        if (s2.data) {
          state.data = { serial_no: serial, summary: s2.data, claims: [], ax_work_orders: [], settlements: [] };
        } else {
          state.error = 'Serial tidak ditemukan di master unit: ' + serial;
        }
      }
    } catch (err) {
      state.error = (err && err.message) || String(err);
    }
    state.loading = false;
    render();
  }

  function setTab(tab) {
    state.tab = tab;
    render();
  }

  function chip(label, value) {
    return '<span class="m360-chip">' + esc(label) + ' <strong>' + esc(value) + '</strong></span>';
  }

  function kv(k, v) {
    return (
      '<div class="m360-kv"><div class="k">' +
      esc(k) +
      '</div><div class="v">' +
      esc(v == null || v === '' ? '—' : v) +
      '</div></div>'
    );
  }

  function pill(text, kind) {
    return '<span class="m360-pill ' + (kind || '') + '">' + esc(text) + '</span>';
  }

  function renderRingkas(sum) {
    if (!sum) return '<div class="m360-msg">Tidak ada ringkasan unit.</div>';
    return (
      '<div class="m360-card"><div class="m360-grid2">' +
      kv('Model', sum.model_code || sum.active_product_model) +
      kv('Model name', sum.model_name) +
      kv('Customer', sum.customer_name || sum.active_end_customer_name) +
      kv('Branch', (sum.branch_code || '') + (sum.branch_name ? ' · ' + sum.branch_name : '')) +
      kv('Dealer', sum.dealer_name || sum.active_dealer_name) +
      kv('Sale date', sum.sale_date) +
      kv('Operation start', sum.operation_start_date) +
      kv('HM', sum.current_hm) +
      kv('Last claim HM', sum.latest_known_claim_hm) +
      kv('Coverage', sum.master_coverage) +
      kv('Confidence', sum.master_unit_confidence) +
      kv('Area', sum.active_area) +
      kv('District', sum.active_district) +
      kv('Latest claim', sum.latest_claim_id) +
      kv('Latest status', sum.latest_claim_status) +
      '</div></div>'
    );
  }

  function renderClaims(claims) {
    claims = claims || [];
    if (!claims.length) return '<div class="m360-msg">Belum ada claim untuk unit ini.</div>';
    var rows = claims
      .map(function (c) {
        return (
          '<tr>' +
          '<td><strong>' +
          esc(c.claim_id) +
          '</strong></td>' +
          '<td>' +
          pill(c.claim_status || '—', c.claim_status === 'Rejected' ? 'bad' : c.claim_status === 'Paid' ? 'ok' : '') +
          '</td>' +
          '<td>' +
          esc(c.dealer_wo_so) +
          '</td>' +
          '<td>' +
          esc(c.dealer_claim_date) +
          '</td>' +
          '<td>' +
          esc(c.failure_date) +
          '</td>' +
          '<td>' +
          esc(c.causing_part_no || '—') +
          '</td>' +
          '<td>' +
          (c.ax_wo_matched ? pill('AX match', 'ok') : pill('No AX', 'warn')) +
          '</td>' +
          '<td>' +
          (c.has_settlement ? pill('Settled', 'ok') : pill('—', '')) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    return (
      '<div class="m360-card"><table class="m360-table"><thead><tr>' +
      '<th>Claim</th><th>Status</th><th>WO</th><th>Claim date</th><th>Failure</th><th>Part</th><th>AX</th><th>Pay</th>' +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table></div>'
    );
  }

  function renderAx(list) {
    list = list || [];
    if (!list.length) return '<div class="m360-msg">Tidak ada work order AX untuk serial ini.</div>';
    var rows = list
      .map(function (a) {
        return (
          '<tr>' +
          '<td><strong>' +
          esc(a.wo_no) +
          '</strong></td>' +
          '<td>' +
          esc(a.ax_status) +
          '</td>' +
          '<td>' +
          esc(a.wo_type) +
          '</td>' +
          '<td>' +
          esc(a.created_date) +
          '</td>' +
          '<td>' +
          esc(a.description) +
          '</td>' +
          '<td>' +
          (a.has_claim ? pill(a.linked_claim_id || 'Ada claim', 'ok') : pill('Tanpa claim', 'warn')) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    return (
      '<div class="m360-card"><table class="m360-table"><thead><tr>' +
      '<th>WO</th><th>Status</th><th>Type</th><th>Created</th><th>Description</th><th>Claim link</th>' +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table></div>'
    );
  }

  function renderSettlements(list) {
    list = list || [];
    if (!list.length) return '<div class="m360-msg">Belum ada settlement untuk unit ini.</div>';
    var rows = list
      .map(function (s) {
        return (
          '<tr>' +
          '<td><strong>' +
          esc(s.claim_id) +
          '</strong></td>' +
          '<td>' +
          esc(s.tsi) +
          '</td>' +
          '<td>' +
          esc(s.calculated_settlement_amount_cny) +
          '</td>' +
          '<td>' +
          esc(s.payment_amount) +
          '</td>' +
          '<td>' +
          esc(s.payment_date) +
          '</td>' +
          '<td>' +
          (s.paid_confirmed ? pill('Paid', 'ok') : pill('Pending', 'warn')) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    return (
      '<div class="m360-card"><table class="m360-table"><thead><tr>' +
      '<th>Claim</th><th>TSI</th><th>CNY calc</th><th>Payment</th><th>Pay date</th><th>Status</th>' +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table></div>'
    );
  }

  function render() {
    var body = $('m360-body');
    if (!body) return;

    if (state.loading) {
      body.innerHTML = '<div class="m360-msg">Memuat rantai unit <strong>' + esc(state.serial) + '</strong>…</div>';
      return;
    }
    if (state.error) {
      body.innerHTML = '<div class="m360-msg m360-err">' + esc(state.error) + '</div>';
      return;
    }
    if (!state.data || !state.data.summary) {
      body.innerHTML =
        '<div class="m360-msg">Ketik serial unit untuk melihat seluruh rantai: identitas, claim, WO AX, settlement.<br/><br/>Contoh: unit dengan banyak claim biasanya muncul di autocomplete setelah 3+ karakter.</div>';
      return;
    }

    var sum = state.data.summary;
    var tabs =
      '<div class="m360-tabs">' +
      ['ringkas|Ringkas', 'claims|Claims', 'ax|Work Order AX', 'settlement|Settlement']
        .map(function (pair) {
          var p = pair.split('|');
          return (
            '<button type="button" class="m360-tab' +
            (state.tab === p[0] ? ' is-active' : '') +
            '" data-tab="' +
            p[0] +
            '">' +
            p[1] +
            '</button>'
          );
        })
        .join('') +
      '</div>';

    var header =
      '<div class="m360-header">' +
      '<div class="m360-serial">' +
      esc(sum.serial_no || state.serial) +
      '</div>' +
      '<div class="m360-meta">' +
      '<span>' +
      esc(sum.model_code || '—') +
      '</span>' +
      '<span>' +
      esc(sum.customer_name || sum.active_end_customer_name || '—') +
      '</span>' +
      '<span>' +
      esc(sum.branch_name || sum.branch_code || '—') +
      '</span>' +
      '</div>' +
      '<div class="m360-chips">' +
      chip('Claim aktif', sum.claims_active) +
      chip('Paid', sum.claims_paid) +
      chip('Rejected', sum.claims_rejected) +
      chip('AX WO', sum.ax_wo_count) +
      chip('Settlement', sum.settlements_count) +
      '</div></div>';

    var panel = '';
    if (state.tab === 'claims') panel = renderClaims(state.data.claims);
    else if (state.tab === 'ax') panel = renderAx(state.data.ax_work_orders);
    else if (state.tab === 'settlement') panel = renderSettlements(state.data.settlements);
    else panel = renderRingkas(sum);

    body.innerHTML = header + tabs + panel;
    Array.prototype.forEach.call(body.querySelectorAll('.m360-tab'), function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-tab'));
      });
    });
  }

  function injectNav() {
    if ($(NAV_ID)) return;
    if (document.querySelector('.login-screen')) return;

    var host =
      document.querySelector('.nav-scroll') ||
      document.querySelector('.topbar-inner') ||
      document.querySelector('.nav-tools');
    if (!host) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = NAV_ID;
    btn.textContent = 'Unit 360';
    btn.title = 'Lihat semua data per 1 unit (claim, WO, settlement)';
    btn.className = 'm360-nav-btn';
    btn.style.cssText =
      'margin-left:6px;padding:8px 12px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open();
    });

    // Prefer after Master Data / Data Quality if found
    var anchors = host.querySelectorAll('button, a');
    var placed = false;
    for (var i = 0; i < anchors.length; i++) {
      var t = (anchors[i].textContent || '').trim();
      if (/Data Quality|Master Data/i.test(t)) {
        if (anchors[i].nextSibling) host.insertBefore(btn, anchors[i].nextSibling);
        else host.appendChild(btn);
        placed = true;
        break;
      }
    }
    if (!placed) host.appendChild(btn);
  }

  function boot() {
    injectCss();
    injectNav();
    // Re-inject nav after React remounts topbar
    var n = 0;
    var iv = setInterval(function () {
      injectNav();
      n += 1;
      if (n > 40) clearInterval(iv);
    }, 500);
    try {
      var mo = new MutationObserver(function () {
        if (!document.querySelector('.login-screen')) injectNav();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}

    // Deep link ?unit=SERIAL
    try {
      var params = new URLSearchParams(window.location.search || '');
      var u = params.get('unit');
      if (u) {
        setTimeout(function () {
          open(u);
        }, 800);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGMachine360 = {
    open: open,
    close: close,
    load: loadSerial,
    version: '1.0.0'
  };
})();
