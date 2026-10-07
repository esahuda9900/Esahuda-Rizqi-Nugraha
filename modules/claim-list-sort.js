(function () {
  'use strict';

  const BUSINESS_DATE_FIELDS = [
    'dealer_claim_date',
    'claim_date',
    'input_date',
    'created_at',
    'updated_at',
  ];

  function parseDate(value) {
    if (value == null || value === '') return null;
    const raw = String(value).trim();
    if (!raw) return null;

    // Handle common Indonesian/Excel-style date text without relying on locale parsing.
    let match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    }

    // ISO date/date-time and other browser-safe formats.
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function firstTimestamp(claim, fields) {
    for (const field of fields) {
      const timestamp = parseDate(claim?.[field]);
      if (timestamp != null) return timestamp;
    }
    return null;
  }

  function claimIdKey(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d+)-(\d{4})-SDLG-PFR$/i);
    if (match) return `${match[2]}-${String(Number(match[1])).padStart(6, '0')}`;
    return raw;
  }

  function compareNewest(a, b) {
    // Business date first: this intentionally does NOT use Claim-ID year.
    // Legacy IDs can carry an older year than their actual claim date.
    const dateA = firstTimestamp(a, BUSINESS_DATE_FIELDS);
    const dateB = firstTimestamp(b, BUSINESS_DATE_FIELDS);
    if (dateA == null && dateB != null) return 1;
    if (dateA != null && dateB == null) return -1;
    if (dateA != null && dateB != null && dateA !== dateB) return dateB - dateA;

    // Deterministic secondary ordering for rows sharing the same business date.
    const createdA = parseDate(a?.created_at);
    const createdB = parseDate(b?.created_at);
    if (createdA == null && createdB != null) return 1;
    if (createdA != null && createdB == null) return -1;
    if (createdA != null && createdB != null && createdA !== createdB) return createdB - createdA;

    return claimIdKey(b?.claim_id).localeCompare(claimIdKey(a?.claim_id), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  window.SDLGClaimListSort = {
    compareNewest,
    sortNewest(rows) {
      return Array.isArray(rows) ? rows.slice().sort(compareNewest) : [];
    },
  };
})();
