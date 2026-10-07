/**
 * Pure date helpers — no DOM, no fetch.
 * Calendar dates as YYYY-MM-DD (operator WIB; do not shift date-only fields).
 */
(function (root) {
  'use strict';

  var monthMap = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
  };

  function normalizeDateInput(value) {
    var s = String(value == null ? '' : value).replace(/\u00a0/g, ' ').trim();
    if (!s) return null;
    var y, m, d, mt;
    mt = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (mt) {
      y = Number(mt[1]); m = Number(mt[2]); d = Number(mt[3]);
    } else {
      mt = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
      if (mt) {
        d = Number(mt[1]); m = Number(mt[2]); y = Number(mt[3]);
      } else {
        mt = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})$/);
        if (mt) {
          d = Number(mt[1]);
          m = monthMap[String(mt[2]).slice(0, 4).toLowerCase()] || monthMap[String(mt[2]).slice(0, 3).toLowerCase()];
          y = Number(mt[3]);
        } else {
          mt = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
          if (mt) {
            m = monthMap[String(mt[1]).slice(0, 4).toLowerCase()] || monthMap[String(mt[1]).slice(0, 3).toLowerCase()];
            d = Number(mt[2]);
            y = Number(mt[3]);
          }
        }
      }
    }
    if (![y, m, d].every(Number.isFinite)) {
      var excelSerial = Number(s);
      if (Number.isFinite(excelSerial) && excelSerial >= 20000 && excelSerial <= 80000) {
        var base = new Date(Date.UTC(1899, 11, 30));
        var out = new Date(base.getTime() + Math.floor(excelSerial) * 86400000);
        return out.toISOString().slice(0, 10);
      }
      return null;
    }
    if (y < 100) y += y <= 49 ? 2000 : 1900;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function parseDateOnly(v) {
    var iso = normalizeDateInput(v);
    if (!iso) return null;
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  var api = {
    version: '1.0.0',
    monthMap: monthMap,
    normalizeDateInput: normalizeDateInput,
    parseDateOnly: parseDateOnly
  };

  root.SDLGCoreDate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
