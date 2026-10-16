/** Port of modules/claim-parser-helpers.js v1.1.0 — pure functions. */

export function cleanSourceCell(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

export function isNumericCell(value: unknown): boolean {
  return /^[+-]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?$/.test(cleanSourceCell(value));
}

export function isZeroMoneyPlaceholder(value: unknown): boolean {
  const x = cleanSourceCell(value);
  if (!x) return false;
  if (/^[-–—]+$/.test(x)) return true;
  return /^(?:(?:USD|CNY|IDR|RP|RMB)\s*)?(?:[¥￥$])?\s*[-–—]+$/i.test(x);
}

export function isRejectableAmountToken(value: unknown): boolean {
  const x = cleanSourceCell(value);
  if (!x) return true;
  if (/\bSN\.?\s*\d+/i.test(x)) return true;
  if (/\bVLG[A-Z0-9]{6,}/i.test(x)) return true;
  if (/Machine\s+Name\s+Plate|Hour\s+Meter|Finish\s+Hour|Mileage\s+To\s+Site|Milage\s+To\s+Site/i.test(x))
    return true;
  if (/Attach\s+rele(?:vant|vent)\s+photos?/i.test(x)) return true;
  if (/Failure\s+Part\s+Location|Engine\s+Name\s+Plate|Machine\s+Work\s+Location/i.test(x))
    return true;
  if (/Dealer\s+Distributor\s+Labour|Labour\s+Hrs|PARTS\s+TOTAL|TOTAL\s+AMOUNT\s+CLAIMED/i.test(x))
    return true;
  return false;
}

/**
 * Section boundary: PARTS TOTAL scan must not continue into the Labour table.
 * Port of claim-parser-helpers isPartsTotalSectionStop.
 */
export function isPartsTotalSectionStop(line: unknown): boolean {
  const x = String(line == null ? '' : line);
  return /Dealer\s+Distributor\s+Labour|Labour\s+Hrs\s+Rate|TOTAL\s+AMOUNT\s+CLAIMED|Attach\s+rele(?:vant|vent)\s+photos?/i.test(
    x,
  );
}

export function parseCellMoney(value: unknown): number | null {
  const x = cleanSourceCell(value);
  if (!x) return null;
  if (isZeroMoneyPlaceholder(x)) return 0;
  if (isRejectableAmountToken(x)) return null;
  const stripped = x
    .replace(/^(?:USD|CNY|IDR|RP|RMB)\s*/i, '')
    .replace(/^[¥￥$]\s*/, '')
    .trim();
  if (isZeroMoneyPlaceholder(stripped)) return 0;
  if (!isNumericCell(stripped) && !/^[+-]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?$/.test(stripped)) {
    if (/[A-Za-z]/.test(x)) return null;
  }
  let s = stripped.replace(/[^0-9,.-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return null;
  if (/^\.-?\d+$/.test(s) || /^\.\d+$/.test(s)) return null;
  const lc = s.lastIndexOf(',');
  const ld = s.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) {
    s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lc >= 0) {
    s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseHourMeter(value: unknown): number | null {
  const x = cleanSourceCell(value).replace(/,/g, '');
  const m = x.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
