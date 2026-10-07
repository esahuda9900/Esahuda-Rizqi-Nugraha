/**
 * SDLG Warranty — Executive Analytics Dashboard
 * Read-only presentation helpers. No claim writes or policy mutations.
 */
(function (root) {
  'use strict';

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  function applyStyles() {
    if (typeof document === 'undefined' || document.getElementById('SDLG_BOSS_ANALYTICS_STABLE_STYLE')) return;
    var style = document.createElement('style');
    style.id = 'SDLG_BOSS_ANALYTICS_STABLE_STYLE';
    style.textContent = [
      '.wx-analytics-shell{margin-top:16px}',
      '.wx-insight{padding:15px 16px;background:#fff;border:1px solid #e4e9f0;border-radius:14px;margin-bottom:10px}',
      '.wx-insight-badge{font-size:9px;font-weight:900;letter-spacing:.1em;color:#3563e9}',
      '.wx-insight-title{font-size:14px;font-weight:800;color:#1d2940;margin-top:4px}',
      '.wx-insight-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}',
      '.wx-insight-item{padding:9px 10px;border:1px solid #e9edf3;border-radius:9px;background:#f8fafc;font-size:11px;color:#4d5a6e}',
      '.wx-metric-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}',
      '.wx-metric{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:12px 13px}',
      '.wx-metric-label{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#7b8797;font-weight:800}',
      '.wx-metric-value{font-size:24px;font-weight:900;color:#18243a;margin-top:6px}',
      '.wx-metric-sub{font-size:9px;color:#7f8b9c;margin-top:4px}',
      '.wx-breakdown-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px;align-items:start}',
      '.wx-secondary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}',
      '.wx-panel{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 14px;min-width:0;align-self:start;height:max-content}',
      '.wx-panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
      '.wx-panel-title{font-size:12px;font-weight:800;color:#1d2940}',
      '.wx-table{width:100%;border-collapse:collapse}.wx-table td{padding:7px 8px;border-bottom:1px solid #eef2f6;font-size:11px;color:#4c5970}.wx-table tr:last-child td{border-bottom:0}.wx-table td:last-child{text-align:right;color:#25344a}',
      '.wx-process-list{display:grid;gap:11px}.wx-process-top{display:flex;justify-content:space-between;font-size:11px;color:#566276}.wx-process-top b{color:#1e2b42}.wx-process-track{height:7px;border-radius:999px;background:#eef2f6;margin-top:5px;overflow:hidden}.wx-process-fill{height:100%;background:#3167e8;border-radius:999px}',
      '.wx-filter{display:grid;grid-template-columns:auto 170px 170px 1fr;align-items:center;gap:9px;width:100%;box-sizing:border-box;margin:4px 0 12px;padding:10px 11px;background:#fff;border:1px solid #e2e7ee;border-radius:11px}',
      '.wx-filter-label{font-size:10px;font-weight:800;color:#3c4a60}.wx-filter select{height:36px;border:1px solid #d7dee8;border-radius:8px;background:#fafcff;padding:0 9px;font-size:11px;font-weight:700;color:#26354b}.wx-filter-count{justify-self:end;font-size:10px;color:#7a8698;font-weight:700}',
      '@media(max-width:1100px){.wx-metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.wx-breakdown-grid{grid-template-columns:1fr 1fr}.wx-insight-grid{grid-template-columns:1fr 1fr}}',
      '@media(max-width:760px){.wx-metric-grid,.wx-breakdown-grid,.wx-secondary-grid,.wx-insight-grid{grid-template-columns:1fr 1fr}.wx-filter{grid-template-columns:1fr 1fr}.wx-filter-label,.wx-filter-count{grid-column:1/-1;justify-self:start}}',
      '@media(max-width:520px){.wx-metric-grid,.wx-breakdown-grid,.wx-secondary-grid,.wx-insight-grid,.wx-filter{grid-template-columns:1fr}.wx-filter-label,.wx-filter-count{grid-column:auto}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  applyStyles();
  root.SDLGBossAnalytics = Object.freeze({
    version: '4.1.0',
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
