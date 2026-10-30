/**
 * boss-analytics-dashboard v1.0 — lightweight Overview helpers
 * - filterByPeriod: year/month scope (no heavy ranking loops)
 * - periodFilterBar: compact Year/Month controls
 * - renderExtraPanels: null (heavy panels still deferred)
 * Safe on login: no network, no timers, no DOM observers.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_BOSS_V1__) return;
  root.__SDLG_BOSS_V1__ = true;

  function isDebug() {
    try {
      if (/[?&]debug=1(?:&|$)/.test(String(root.location && root.location.search))) return true;
      if (root.localStorage && root.localStorage.getItem('sdlg-debug') === '1') return true;
    } catch (_) {}
    return false;
  }

  function claimDate(row) {
    if (!row || typeof row !== 'object') return null;
    var raw =
      row.failure_date ||
      row.dealer_claim_date ||
      row.claim_date ||
      row.created_at ||
      row.last_updated ||
      '';
    if (!raw) return null;
    var d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * @param {Array} rows
   * @param {string} year  'ALL' | '2026'
   * @param {string} month 'ALL' | '01'..'12'
   */
  function filterByPeriod(rows, year, month) {
    var list = Array.isArray(rows) ? rows : [];
    var y = String(year == null ? 'ALL' : year);
    var m = String(month == null ? 'ALL' : month);
    if (m.length === 1) m = '0' + m;

    return list.filter(function (row) {
      if (row && row.archived_at) return false;
      if (y === 'ALL' && m === 'ALL') return true;
      var d = claimDate(row);
      if (!d) return y === 'ALL' && m === 'ALL';
      if (y !== 'ALL' && String(d.getFullYear()) !== y) return false;
      if (m !== 'ALL') {
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        if (mm !== m) return false;
      }
      return true;
    });
  }

  function uniqueYears(claims) {
    var set = {};
    (claims || []).forEach(function (c) {
      if (c && c.archived_at) return;
      var d = claimDate(c);
      if (d) set[String(d.getFullYear())] = true;
    });
    return Object.keys(set).sort().reverse();
  }

  function periodFilterBar(opts) {
    opts = opts || {};
    var React = opts.React || root.React;
    if (!React || !React.createElement) return null;

    var year = opts.year != null ? String(opts.year) : 'ALL';
    var month = opts.month != null ? String(opts.month) : 'ALL';
    var setYear = typeof opts.setYear === 'function' ? opts.setYear : function () {};
    var setMonth = typeof opts.setMonth === 'function' ? opts.setMonth : function () {};
    var claims = opts.claims || [];
    var years = uniqueYears(claims);
    if (!years.length) {
      years = [String(new Date().getFullYear())];
    }

    var months = [
      { v: 'ALL', t: 'All months' },
      { v: '01', t: 'Jan' },
      { v: '02', t: 'Feb' },
      { v: '03', t: 'Mar' },
      { v: '04', t: 'Apr' },
      { v: '05', t: 'May' },
      { v: '06', t: 'Jun' },
      { v: '07', t: 'Jul' },
      { v: '08', t: 'Aug' },
      { v: '09', t: 'Sep' },
      { v: '10', t: 'Oct' },
      { v: '11', t: 'Nov' },
      { v: '12', t: 'Dec' }
    ];

    var selectStyle = {
      minHeight: 34,
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid #e2e8f0',
      background: '#fff',
      fontSize: 12,
      fontWeight: 600,
      color: '#0f172a',
      cursor: 'pointer'
    };

    return React.createElement(
      'div',
      {
        className: 'overview-period-filter',
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12
        }
      },
      React.createElement(
        'span',
        { style: { fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' } },
        'Period'
      ),
      React.createElement(
        'select',
        {
          'aria-label': 'Analytics year',
          value: year,
          onChange: function (e) {
            setYear(e.target.value);
          },
          style: selectStyle
        },
        React.createElement('option', { value: 'ALL' }, 'All years'),
        years.map(function (y) {
          return React.createElement('option', { key: y, value: y }, y);
        })
      ),
      React.createElement(
        'select',
        {
          'aria-label': 'Analytics month',
          value: month.length === 1 ? '0' + month : month,
          onChange: function (e) {
            setMonth(e.target.value);
          },
          style: selectStyle
        },
        months.map(function (x) {
          return React.createElement('option', { key: x.v, value: x.v }, x.t);
        })
      )
    );
  }

  function renderExtraPanels() {
    return null;
  }

  function applyStyles() {}

  root.SDLGBossAnalytics = {
    version: '1.0.0-overview-period',
    filterByPeriod: filterByPeriod,
    periodFilterBar: periodFilterBar,
    renderExtraPanels: renderExtraPanels,
    applyStyles: applyStyles
  };

  if (isDebug()) {
    try {
      console.info('[SDLG] boss-analytics v1.0 (period filter active)');
    } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
