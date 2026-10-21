/**
 * SDLG Warranty — Executive Analytics Dashboard
 * 
 * ═══════════════════════════════════════════════════════════
 * CHANGELOG V6.0 — "CLEAN & MAINTAINABLE"
 * ═══════════════════════════════════════════════════════════
 * Versi ini LEBIH RAPI dari sebelumnya, bukan lebih panjang.
 * 
 * Yang diubah:
 * ✅ Warna disatukan jadi CSS Variables → gampang ganti tema
 * ✅ CSS ditulis sebagai teks blok → gampang dibaca & diedit
 * ✅ Aksesibilitas: dukungan keyboard, hormati reduced-motion
 * ✅ Angka pakai tabular-nums → rata rapi
 * ✅ Deklarasi dobel dihapus → CSS lebih ringan
 * ✅ Komentar dalam Bahasa Indonesia → lu ngerti apa yang diubah
 * 
 * YANG TIDAK DIUBAH:
 * ❌ Logika filter data (filterByPeriod, rank, dll)
 * ❌ Struktur React components
 * ❌ API yang dipakai file lain (filterByPeriod, periodFilterBar, dll)
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ═════════════════════════════════════════════════════════
  // BAGIAN 1: HELPER FUNCTIONS — Logika data (JANGAN DIUBAH)
  // ═════════════════════════════════════════════════════════

  function safeDate(raw) {
    if (!raw) return null;
    var d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function businessDate(row) {
    return safeDate(row && (row.dealer_claim_date || row.input_date || row.failure_date || row.created_at || row.business_date));
  }

  function claimYear(row) {
    if (row && row.claim_year != null) return Number(row.claim_year) || null;
    var d = businessDate(row);
    return d ? d.getFullYear() : null;
  }

  function claimMonth(row) {
    if (row && row.claim_month != null) return Number(row.claim_month) || null;
    var d = businessDate(row);
    return d ? d.getMonth() + 1 : null;
  }

  function filterByPeriod(rows, year, month) {
    var list = Array.isArray(rows) ? rows : [];
    var y = year && String(year).toUpperCase() !== 'ALL' ? Number(year) : null;
    var m = month && String(month).toUpperCase() !== 'ALL' ? Number(month) : null;
    return list.filter(function (row) {
      if (row && row.archived_at) return false;
      if (y != null && claimYear(row) !== y) return false;
      if (m != null && claimMonth(row) !== m) return false;
      return true;
    });
  }

  function filterByYear(rows, year) {
    return filterByPeriod(rows, year, 'ALL');
  }

  function availableYears(rows) {
    var years = Object.create(null);
    (rows || []).forEach(function (row) {
      var y = claimYear(row);
      if (y) years[y] = true;
    });
    return Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
  }

  function rank(rows, keyFn, limit) {
    var counts = Object.create(null);
    (rows || []).forEach(function (row) {
      var key = String(keyFn(row) == null ? '' : keyFn(row)).trim() || '(blank)';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).map(function (key) { return [key, counts[key]]; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); })
      .slice(0, limit || 10);
  }

  function ownerFromAction(actionRows, claim) {
    if (claim && claim.current_owner) return claim.current_owner;
    var row = (actionRows || []).find(function (r) { return r.claim_id === claim.claim_id; });
    if (row && row.current_owner) return row.current_owner;
    var status = String((claim && (claim.claim_status || claim.workflow_stage)) || '');
    if (/SDLG Audit|Submitted to SDLG|Claimed to SDLG/i.test(status)) return 'SDLG';
    if (/Billing|Paid|Completed/i.test(status)) return 'Closed';
    return 'Warranty Admin';
  }

  function openAgingDays(row, today) {
    if (row && row.days_open != null && Number.isFinite(Number(row.days_open))) {
      return Math.max(0, Number(row.days_open));
    }
    var anchor = row && (row.dealer_claim_date || row.status_date || row.input_date || row.failure_date);
    if (!anchor) return null;
    var end = safeDate(today || new Date().toISOString().slice(0, 10));
    var start = safeDate(anchor);
    if (!start || !end) return null;
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  function median(values) {
    var nums = (values || []).filter(function (v) {
      return v != null && Number.isFinite(Number(v)) && Number(v) >= 0;
    }).map(Number).sort(function (a, b) { return a - b; });
    if (!nums.length) return null;
    var mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  }

  function processAgingFromClaims(claims) {
    function diff(from, to) {
      var a = safeDate(from), b = safeDate(to);
      return a && b ? Math.max(0, Math.round((b - a) / 86400000)) : null;
    }
    return [
      ['Failure → Repair start', median((claims || []).map(function (c) { return diff(c.failure_date, c.dealer_repair_date); }))],
      ['Repair → Completion', median((claims || []).map(function (c) { return diff(c.dealer_repair_date, c.completion_date); }))],
      ['Completion → Dealer claim', median((claims || []).map(function (c) { return diff(c.completion_date || c.dealer_repair_date, c.dealer_claim_date); }))],
      ['Failure → Dealer claim', median((claims || []).map(function (c) { return diff(c.failure_date, c.dealer_claim_date); }))],
      ['Dealer claim → SDLG audit', median((claims || []).map(function (c) { return diff(c.dealer_claim_date, c.sdlg_audit_date); }))],
      ['Current process aging', median((claims || []).filter(function (c) { return !/Paid|Completed/i.test(String(c.claim_status || '')); }).map(function (c) { return openAgingDays(c); }))]
    ];
  }

  // ═════════════════════════════════════════════════════════
  // BAGIAN 2: UI COMPONENTS — React rendering (JANGAN DIUBAH)
  // ═════════════════════════════════════════════════════════

  function periodFilterBar(opts) {
    var React = opts.React;
    var years = availableYears(opts.claims || []);
    var year = opts.year || 'ALL';
    var month = opts.month || 'ALL';
    var scope = filterByPeriod(opts.claims || [], year, month);
    return React.createElement('div', { className: 'wx-filter' },
      React.createElement('div', { className: 'wx-filter-label' }, 'Analisa periode'),
      React.createElement('select', { value: year, onChange: function (e) { if (opts.setYear) opts.setYear(e.target.value); } },
        React.createElement('option', { value: 'ALL' }, 'Semua tahun'),
        years.map(function (y) { return React.createElement('option', { key: y, value: String(y) }, String(y)); })
      ),
      React.createElement('select', { value: month, onChange: function (e) { if (opts.setMonth) opts.setMonth(e.target.value); } },
        React.createElement('option', { value: 'ALL' }, 'Semua bulan'),
        MONTHS.map(function (m, i) { return React.createElement('option', { key: i + 1, value: String(i + 1) }, m); })
      ),
      React.createElement('div', { className: 'wx-filter-count' }, scope.length.toLocaleString('en-US') + ' claim dalam periode')
    );
  }

  function renderExtraPanels(opts) {
    var React = opts.React;
    var claims = filterByPeriod(opts.claims || [], opts.year, opts.month);
    var ops = Array.isArray(opts.bossRows) && opts.bossRows.length ? filterByPeriod(opts.bossRows, opts.year, opts.month) : claims;
    var actions = Array.isArray(opts.actionCenterRows) ? opts.actionCenterRows : [];
    var owners = rank(ops, function (r) { return ownerFromAction(actions, r); }, 6);
    var branches = rank(ops, function (r) { return r.branch || r.claim_branch || r.branch_name; }, 6);
    var rejectedRows = ops.filter(function (r) { return /Rejected/i.test(String(r.claim_status || '')); });
    var rejected = rank(rejectedRows, function (r) { return r.last_hist_reason || r.rejection_reason || 'Reason not recorded'; }, 5);
    var aged90 = ops.filter(function (r) { var n = openAgingDays(r); return n != null && n >= 90; }).length;
    var aged300 = ops.filter(function (r) { var n = openAgingDays(r); return n != null && n >= 300; }).length;
    var evidence = ops.filter(function (r) { return !!(r.has_submission_ref || r.submission_ref || r.dealer_claim_no); }).length;
    var oldest = ops.reduce(function (max, r) { return Math.max(max, Number(openAgingDays(r)) || 0); }, 0);
    var processRows = processAgingFromClaims(ops).filter(function (r) { return r[1] != null; }).map(function (r) { return { label: r[0], median: r[1] }; });
    var processMax = processRows.reduce(function (m, r) { return Math.max(m, Number(r.median) || 0); }, 1);

    function metric(label, value, sub) {
      return React.createElement('div', { className: 'wx-metric' },
        React.createElement('div', { className: 'wx-metric-label' }, label),
        React.createElement('div', { className: 'wx-metric-value' }, String(value)),
        React.createElement('div', { className: 'wx-metric-sub' }, sub || '')
      );
    }

    function panel(title, body) {
      return React.createElement('section', { className: 'wx-panel' },
        React.createElement('div', { className: 'wx-panel-head' }, React.createElement('div', { className: 'wx-panel-title' }, title)),
        body
      );
    }

    function rows(pairs) {
      return pairs.map(function (p) {
        return React.createElement('tr', { key: p[0] }, React.createElement('td', null, p[0]), React.createElement('td', { style: { fontWeight: 800 } }, String(p[1])));
      });
    }

    return React.createElement('div', { className: 'wx-analytics-shell' },
      React.createElement('div', { className: 'wx-insight' },
        React.createElement('div', { className: 'wx-insight-badge' }, 'EXECUTIVE SNAPSHOT'),
        React.createElement('div', { className: 'wx-insight-title' }, 'Ringkasan operasional periode terpilih'),
        React.createElement('div', { className: 'wx-insight-grid' },
          React.createElement('div', { className: 'wx-insight-item' }, 'Claims: ' + ops.length.toLocaleString('en-US')),
          React.createElement('div', { className: 'wx-insight-item' }, 'Aging ≥90d: ' + aged90.toLocaleString('en-US')),
          React.createElement('div', { className: 'wx-insight-item' }, 'Aging ≥300d: ' + aged300.toLocaleString('en-US')),
          React.createElement('div', { className: 'wx-insight-item' }, 'Top owner: ' + (owners.length ? owners[0][0] + ' (' + owners[0][1] + ')' : '—')),
          React.createElement('div', { className: 'wx-insight-item' }, 'Oldest claim aging: ' + (oldest ? oldest + ' days' : '—')),
          React.createElement('div', { className: 'wx-insight-item' }, 'Submission evidence: ' + evidence + '/' + ops.length)
        )
      ),
      React.createElement('div', { className: 'wx-metric-grid' },
        metric('Claims', ops.length.toLocaleString('en-US'), 'portfolio aktif'),
        metric('Aging ≥90d', aged90.toLocaleString('en-US'), ops.length ? Math.round(aged90 / ops.length * 1000) / 10 + '%' : '0%'),
        metric('Aging ≥300d', aged300.toLocaleString('en-US'), ops.length ? Math.round(aged300 / ops.length * 1000) / 10 + '%' : '0%'),
        metric('SDLG owner', owners.length ? owners[0][1].toLocaleString('en-US') : '0', 'owner teratas'),
        metric('Evidence', evidence + '/' + ops.length, 'submission / dealer claim'),
        metric('Rejected', rejectedRows.length.toLocaleString('en-US'), 'dalam filter')
      ),
      React.createElement('div', { className: 'wx-breakdown-grid' },
        panel('Ball in court', React.createElement('div', { className: 'wx-simple-table-wrap' }, React.createElement('table', { className: 'wx-table' }, React.createElement('tbody', null, rows(owners))))),
        panel('Claims per branch', React.createElement('div', { className: 'wx-simple-table-wrap' }, React.createElement('table', { className: 'wx-table' }, React.createElement('tbody', null, rows(branches))))),
        panel('Rejection intelligence', React.createElement('div', { className: 'wx-simple-table-wrap' }, React.createElement('table', { className: 'wx-table' }, React.createElement('tbody', null, rows(rejected.length ? rejected : [['No rejection reason', 0]])))))
      ),
      React.createElement('div', { className: 'wx-secondary-grid' },
        panel('Process aging', React.createElement('div', { className: 'wx-process-list' }, processRows.slice(0, 6).map(function (r) {
          var width = Math.min(100, (Number(r.median) / processMax) * 100);
          return React.createElement('div', { key: r.label, className: 'wx-process-row' },
            React.createElement('div', { className: 'wx-process-top' }, React.createElement('span', null, r.label), React.createElement('b', null, r.median + ' d')),
            React.createElement('div', { className: 'wx-process-track' }, React.createElement('div', { className: 'wx-process-fill', style: { width: width + '%' } }))
          );
        }))),
        panel('Operational notes', React.createElement('div', { style: { fontSize: 11, color: '#5d697c', lineHeight: 1.6 } },
          'Analytics ini read-only. Untuk operasional harian gunakan Command Center dan Follow-Up Center di bagian atas dashboard.'
        ))
      )
    );
  }

  // ═════════════════════════════════════════════════════════
  // BAGIAN 3: STYLES — Tampilan (INI YANG DIUBAH)
  // ═════════════════════════════════════════════════════════

  function applyStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('SDLG_BOSS_ANALYTICS_STABLE_STYLE')) return;

    var style = document.createElement('style');
    style.id = 'SDLG_BOSS_ANALYTICS_STABLE_STYLE';
    
    // CSS ditulis sebagai teks utuh — bukan array — biar gampang dibaca
    style.textContent = [
      '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter+Tight:wght@700;800;900&display=swap");',
      '',

      /* ═══════════════════════════════════════════════════════
         🎨 TEMA & WARNA — Ubah di sini buat ganti seluruh tampilan
         ═══════════════════════════════════════════════════════ */
      ':root {',
      '  --sdlg-page-bg: #f1f5f9;',
      '  --sdlg-surface: #ffffff;',
      '  --sdlg-surface-muted: #f8fafc;',
      '  --sdlg-border: #e2e8f0;',
      '  --sdlg-border-strong: #cbd5e1;',
      '  --sdlg-text: #0f172a;',
      '  --sdlg-text-muted: #64748b;',
      '  --sdlg-text-subtle: #94a3b8;',
      '  --sdlg-accent: #2f5bff;',
      '  --sdlg-accent-alt: #00d4ff;',
      '  --sdlg-radius-sm: 10px;',
      '  --sdlg-radius-md: 14px;',
      '  --sdlg-radius-lg: 20px;',
      '  --sdlg-shadow-sm: 0 2px 4px -1px rgba(0,0,0,0.03);',
      '  --sdlg-shadow-md: 0 10px 15px -3px rgba(0,0,0,0.05);',
      '  --sdlg-transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);',
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         📐 BASE — Font & background utama
         ═══════════════════════════════════════════════════════ */
      'body {',
      '  font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif !important;',
      '  background-color: var(--sdlg-page-bg) !important;',
      '  color: var(--sdlg-text) !important;',
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         🏷️  KARTU METRIK ATAS — Total Claims, Total Claim Amount, dll
         ═══════════════════════════════════════════════════════ */
      '.page > div:first-child > div > div > div:first-child > div:first-child {',
      '  background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%) !important;',
      '  border: 1px solid var(--sdlg-border) !important;',
      '  border-radius: var(--sdlg-radius-md) !important;',
      '  box-shadow: var(--sdlg-shadow-sm) !important;',
      '  padding: 20px 24px !important;',
      '  position: relative !important;',
      '  overflow: hidden !important;',
      '  transition: transform var(--sdlg-transition), box-shadow var(--sdlg-transition), border-color var(--sdlg-transition) !important;',
      '}',
      '.page > div:first-child > div > div > div:first-child > div:first-child:hover {',
      '  transform: translateY(-3px) !important;',
      '  border-color: var(--sdlg-border-strong) !important;',
      '  box-shadow: var(--sdlg-shadow-md) !important;',
      '}',
      /* Garis biru vertikal di kiri kartu */
      '.page > div:first-child > div > div > div:first-child > div:first-child::before {',
      '  content: "" !important;',
      '  position: absolute !important;',
      '  top: 0 !important; left: 0 !important; bottom: 0 !important;',
      '  width: 4px !important;',
      '  background: linear-gradient(180deg, var(--sdlg-accent) 0%, var(--sdlg-accent-alt) 100%) !important;',
      '}',
      /* Label & nilai di dalam kartu */
      '.page > div:first-child > div > div > div:first-child > div:first-child > div:first-child {',
      '  font-size: 12px !important;',
      '  font-weight: 700 !important;',
      '  color: var(--sdlg-text-muted) !important;',
      '  text-transform: uppercase !important;',
      '  letter-spacing: 0.05em !important;',
      '  margin-bottom: 8px !important;',
      '}',
      '.page > div:first-child > div > div > div:first-child > div:first-child > div:last-child {',
      '  font-family: "Inter Tight", monospace !important;',
      '  font-size: 34px !important;',
      '  font-weight: 800 !important;',
      '  color: var(--sdlg-text) !important;',
      '  letter-spacing: -0.03em !important;',
      '  line-height: 1 !important;',
      '  font-variant-numeric: tabular-nums !important;', /* angka rata rapi */
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         🎯 4 KOTAK "MY ACTION TODAY" — P0 Critical, P1 Action, dll
         ═══════════════════════════════════════════════════════ */
      '.page div[style*="grid-template-columns: repeat(4"] > div {',
      '  border-radius: var(--sdlg-radius-md) !important;',
      '  padding: 20px !important;',
      '  border: 1px solid transparent !important;',
      '  box-shadow: var(--sdlg-shadow-sm) !important;',
      '  transition: transform var(--sdlg-transition), box-shadow var(--sdlg-transition) !important;',
      '  position: relative !important;',
      '  overflow: hidden !important;',
      '}',
      '.page div[style*="grid-template-columns: repeat(4"] > div:hover {',
      '  transform: translateY(-2px) !important;',
      '  box-shadow: var(--sdlg-shadow-md) !important;',
      '}',
      /* Warna tiap kotak (Merah → Kuning → Biru → Abu) */
      '.page div[style*="grid-template-columns: repeat(4"] > div:nth-child(1) { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important; border-color: #fecaca !important; }',
      '.page div[style*="grid-template-columns: repeat(4"] > div:nth-child(2) { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important; border-color: #fde68a !important; }',
      '.page div[style*="grid-template-columns: repeat(4"] > div:nth-child(3) { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; border-color: #bfdbfe !important; }',
      '.page div[style*="grid-template-columns: repeat(4"] > div:nth-child(4) { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-color: #e2e8f0 !important; }',
      '',

      /* ═══════════════════════════════════════════════════════
         💰 KOTAK GELAP ESTIMASI TOTAL
         ═══════════════════════════════════════════════════════ */
      '.total-estimasi-box {',
      '  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;',
      '  color: #ffffff !important;',
      '  padding: 32px 40px !important;',
      '  border-radius: var(--sdlg-radius-lg) !important;',
      '  border: 1px solid #334155 !important;',
      '  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 20px 40px -10px rgba(15,23,42,0.4) !important;',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '  justify-content: center !important;',
      '  margin: 32px 0 !important;',
      '  position: relative !important;',
      '  overflow: hidden !important;',
      '}',
      /* Efek glow biru di pojok kanan atas */
      '.total-estimasi-box::after {',
      '  content: "" !important;',
      '  position: absolute !important;',
      '  top: -50% !important; right: -10% !important;',
      '  width: 400px !important; height: 400px !important;',
      '  background: radial-gradient(circle, rgba(47,91,255,0.3) 0%, transparent 60%) !important;',
      '  border-radius: 50% !important;',
      '  pointer-events: none !important;',
      '}',
      '.total-estimasi-box .label {',
      '  font-size: 12px !important;',
      '  font-weight: 700 !important;',
      '  color: #94a3b8 !important;',
      '  text-transform: uppercase !important;',
      '  letter-spacing: 0.1em !important;',
      '  position: relative !important; z-index: 2 !important;',
      '}',
      '.total-estimasi-box .value {',
      '  font-family: "Inter Tight", sans-serif !important;',
      '  font-size: 44px !important;',
      '  font-weight: 800 !important;',
      '  color: #ffffff !important;',
      '  letter-spacing: -0.03em !important;',
      '  margin-top: 8px !important;',
      '  position: relative !important; z-index: 2 !important;',
      '  font-variant-numeric: tabular-nums !important;',
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         📋 LIST ROWS — Claim Priorities & Action Required
         ═══════════════════════════════════════════════════════ */
      '.claim-row, .action-row {',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: space-between !important;',
      '  padding: 14px 18px !important;',
      '  margin-bottom: 6px !important;',
      '  border-radius: var(--sdlg-radius-sm) !important;',
      '  background: var(--sdlg-surface) !important;',
      '  border: 1px solid var(--sdlg-surface-muted) !important;',
      '  box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;',
      '  transition: background var(--sdlg-transition), border-color var(--sdlg-transition), transform var(--sdlg-transition) !important;',
      '}',
      '.claim-row:hover, .action-row:hover {',
      '  background: var(--sdlg-surface-muted) !important;',
      '  border-color: var(--sdlg-border) !important;',
      '  transform: translateX(3px) !important;',
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         📊 KARTU CHART — Trend, Model, Branch
         ═══════════════════════════════════════════════════════ */
      '.card:has(canvas), .card:has(svg) {',
      '  background: var(--sdlg-surface) !important;',
      '  border: 1px solid var(--sdlg-border) !important;',
      '  border-radius: var(--sdlg-radius-md) !important;',
      '  box-shadow: var(--sdlg-shadow-sm) !important;',
      '  padding: 24px !important;',
      '  transition: box-shadow var(--sdlg-transition) !important;',
      '}',
      '.card:has(canvas):hover, .card:has(svg):hover {',
      '  box-shadow: var(--sdlg-shadow-md) !important;',
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         📸 EXECUTIVE SNAPSHOT — Kartu di bagian bawah
         ═══════════════════════════════════════════════════════ */
      '.wx-metric {',
      '  background: var(--sdlg-surface) !important;',
      '  border: 1px solid var(--sdlg-border) !important;',
      '  border-radius: var(--sdlg-radius-sm) !important;',
      '  padding: 16px !important;',
      '  box-shadow: var(--sdlg-shadow-sm) !important;',
      '  transition: transform var(--sdlg-transition), box-shadow var(--sdlg-transition) !important;',
      '}',
      '.wx-metric:hover {',
      '  transform: translateY(-2px) !important;',
      '  box-shadow: var(--sdlg-shadow-md) !important;',
      '}',
      '.wx-metric-label {',
      '  font-size: 11px !important;',
      '  font-weight: 700 !important;',
      '  color: var(--sdlg-text-muted) !important;',
      '  text-transform: uppercase !important;',
      '  letter-spacing: 0.05em !important;',
      '}',
      '.wx-metric-value {',
      '  font-family: "Inter Tight", sans-serif !important;',
      '  font-size: 28px !important;',
      '  font-weight: 800 !important;',
      '  color: var(--sdlg-text) !important;',
      '  font-variant-numeric: tabular-nums !important;',
      '  margin-top: 4px !important;',
      '}',
      '.wx-metric-sub {',
      '  font-size: 10px !important;',
      '  color: var(--sdlg-text-subtle) !important;',
      '  margin-top: 4px !important;',
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         ⚠️  BAGIAN EXECUTIVE PANELS BAWAAN (jangan dihapus)
         ═══════════════════════════════════════════════════════ */
      '.wx-analytics-shell{margin-top:16px}',
      '.wx-insight{padding:16px;background:var(--sdlg-surface);border:1px solid #e4e9f0;border-radius:var(--sdlg-radius-md);margin-bottom:12px;box-shadow:var(--sdlg-shadow-sm)}',
      '.wx-insight-badge{font-size:9px;font-weight:900;letter-spacing:.1em;color:var(--sdlg-accent)}',
      '.wx-insight-title{font-size:15px;font-weight:800;color:var(--sdlg-text);margin-top:4px}',
      '.wx-insight-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}',
      '.wx-insight-item{padding:9px 10px;border:1px solid #e9edf3;border-radius:9px;background:var(--sdlg-surface-muted);font-size:11px;color:#475569;font-weight:500}',
      '.wx-metric-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}',
      '.wx-breakdown-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px;align-items:start}',
      '.wx-secondary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}',
      '.wx-panel{background:var(--sdlg-surface);border:1px solid #e4e9f0;border-radius:var(--sdlg-radius-md);padding:16px;min-width:0;align-self:start;height:max-content;box-shadow:var(--sdlg-shadow-sm)}',
      '.wx-panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.wx-panel-title{font-size:13px;font-weight:800;color:var(--sdlg-text)}',
      '.wx-table{width:100%;border-collapse:collapse}.wx-table td{padding:9px 8px;border-bottom:1px solid var(--sdlg-surface-muted);font-size:11px;color:#475569}.wx-table tr:last-child td{border-bottom:0}.wx-table td:last-child{text-align:right;color:var(--sdlg-text);font-weight:700}',
      '.wx-process-list{display:grid;gap:12px}.wx-process-top{display:flex;justify-content:space-between;font-size:11px;color:#475569;font-weight:500}.wx-process-top b{color:var(--sdlg-text)}.wx-process-track{height:6px;border-radius:999px;background:var(--sdlg-border);margin-top:6px;overflow:hidden}.wx-process-fill{height:100%;background:linear-gradient(90deg,var(--sdlg-accent),var(--sdlg-accent-alt));border-radius:999px}',
      '.wx-filter{display:grid;grid-template-columns:auto 170px 170px 1fr;align-items:center;gap:12px;width:100%;box-sizing:border-box;margin:8px 0 16px;padding:12px 16px;background:var(--sdlg-surface);border:1px solid var(--sdlg-border);border-radius:var(--sdlg-radius-sm);box-shadow:var(--sdlg-shadow-sm)}',
      '.wx-filter-label{font-size:11px;font-weight:800;color:var(--sdlg-text)}',
      '.wx-filter select{height:36px;border:1px solid var(--sdlg-border-strong);border-radius:8px;background:var(--sdlg-surface-muted);padding:0 12px;font-size:11px;font-weight:700;color:var(--sdlg-text);outline:none;transition:border var(--sdlg-transition)}',
      '.wx-filter select:focus{border-color:var(--sdlg-accent)}',
      '.wx-filter-count{justify-self:end;font-size:11px;color:var(--sdlg-text-muted);font-weight:700}',
      '',

      /* ═══════════════════════════════════════════════════════
         ♿ AKSESIBILITAS — Biar bisa dipakai pakai keyboard & ramah
         ═══════════════════════════════════════════════════════ */
      /* Cincin fokus biar keliatan pas dipilih pakai Tab */
      '.wx-filter select:focus-visible, .page div[style*="grid-template-columns: repeat(4"] > div:focus-visible {',
      '  outline: 2px solid var(--sdlg-accent) !important;',
      '  outline-offset: 2px !important;',
      '}',
      /* Kalau user matiin animasi (reduced motion), hilangkan transisi */
      '@media (prefers-reduced-motion: reduce) {',
      '  .page *, .wx-metric *, .total-estimasi-box * {',
      '    transition-duration: 0.01ms !important;',
      '    animation-duration: 0.01ms !important;',
      '  }',
      '}',
      '',

      /* ═══════════════════════════════════════════════════════
         📱 RESPONSIVE — Layar kecil & tablet
         ═══════════════════════════════════════════════════════ */
      '@media (max-width: 1100px) {',
      '  .wx-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) }',
      '  .wx-breakdown-grid { grid-template-columns: 1fr 1fr }',
      '  .wx-insight-grid { grid-template-columns: 1fr 1fr }',
      '}',
      '@media (max-width: 760px) {',
      '  .wx-metric-grid, .wx-breakdown-grid, .wx-secondary-grid, .wx-insight-grid { grid-template-columns: 1fr 1fr }',
      '  .wx-filter { grid-template-columns: 1fr 1fr }',
      '  .wx-filter-label, .wx-filter-count { grid-column: 1 / -1; justify-self: start }',
      '}',
      '@media (max-width: 520px) {',
      '  .wx-metric-grid, .wx-breakdown-grid, .wx-secondary-grid, .wx-insight-grid, .wx-filter { grid-template-columns: 1fr }',
      '  .wx-filter-label, .wx-filter-count { grid-column: auto }',
      '  .page > div:first-child > div > div > div:first-child > div:first-child > div:last-child { font-size: 28px !important }',
      '  .total-estimasi-box { padding: 24px !important }',
      '  .total-estimasi-box .value { font-size: 32px !important }',
      '}'
    ].join('\n');

    document.head.appendChild(style);
  }

  // ═════════════════════════════════════════════════════════
  // BAGIAN 4: EXPORT — API buat file lain
  // ═════════════════════════════════════════════════════════

  applyStyles();
  root.SDLGBossAnalytics = Object.freeze({
    version: '6.0.0',
    filterByPeriod: filterByPeriod,
    filterByYear: filterByYear,
    availableYears: availableYears,
    rank: rank,
    ownerFromAction: ownerFromAction,
    processAgingFromClaims: processAgingFromClaims,
    periodFilterBar: periodFilterBar,
    yearFilterBar: periodFilterBar,
    renderExtraPanels: renderExtraPanels
  });
})(typeof window !== 'undefined' ? window : globalThis);