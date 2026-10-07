/**
 * Claim source-parser pure helpers.
 * Loaded before the main app bundle; index.html must delegate isNumericCell here.
 *
 * v1.1.0 — money placeholders (¥-/USD -/CNY -) + reject serial-like amount tokens
 * so PARTS TOTAL / TOTAL AMOUNT CLAIMED cannot borrow Labour Hrs or SN plate digits.
 */
(function (root) {
  'use strict';

  function cleanSourceCell(value) {
    return value == null ? '' : String(value).trim();
  }

  function isNumericCell(value) {
    return /^[+-]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?$/.test(cleanSourceCell(value));
  }

  /**
   * True for blank money placeholders used on SDLG warranty forms.
   * Covers: "-", "—", "USD -", "$ -", "¥-", "¥ —", "CNY -", "IDR -", "RP -".
   */
  function isZeroMoneyPlaceholder(value) {
    const x = cleanSourceCell(value);
    if (!x) return false;
    if (/^[-–—]+$/.test(x)) return true;
    // Currency token optional, then optional yen/dollar symbol, then dashes only.
    return /^(?:(?:USD|CNY|IDR|RP|RMB)\s*)?(?:[¥￥$])?\s*[-–—]+$/i.test(x);
  }

  /**
   * Tokens that must never become claim money (parts total / total amount).
   * Serial plates, photo captions, and narrative lines leak digits (e.g. SN.611152 → 0.611152).
   */
  function isRejectableAmountToken(value) {
    const x = cleanSourceCell(value);
    if (!x) return true;
    if (/\bSN\.?\s*\d+/i.test(x)) return true;
    if (/\bVLG[A-Z0-9]{6,}/i.test(x)) return true;
    if (/Machine\s+Name\s+Plate|Hour\s+Meter|Finish\s+Hour|Mileage\s+To\s+Site|Milage\s+To\s+Site/i.test(x)) return true;
    if (/Attach\s+rele(?:vant|vent)\s+photos?/i.test(x)) return true;
    if (/Failure\s+Part\s+Location|Engine\s+Name\s+Plate|Machine\s+Work\s+Location/i.test(x)) return true;
    if (/Dealer\s+Distributor\s+Labour|Labour\s+Hrs|PARTS\s+TOTAL|TOTAL\s+AMOUNT\s+CLAIMED/i.test(x)) return true;
    return false;
  }

  /**
   * Parse a single money/qty cell from the warranty form.
   * Placeholders → 0. Serial-like / caption noise → null. Else decimal number or null.
   */
  function parseCellMoney(value) {
    const x = cleanSourceCell(value);
    if (!x) return null;
    if (isZeroMoneyPlaceholder(x)) return 0;
    if (isRejectableAmountToken(x)) return null;
    // Prefer strict numeric cells; allow a leading currency symbol on an otherwise numeric token.
    const stripped = x.replace(/^(?:USD|CNY|IDR|RP|RMB)\s*/i, '').replace(/^[¥￥$]\s*/, '').trim();
    if (isZeroMoneyPlaceholder(stripped)) return 0;
    if (!isNumericCell(stripped) && !/^[+-]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?$/.test(stripped)) {
      // Fall through only for plain digit-ish tokens without letters (legacy path).
      if (/[A-Za-z]/.test(x)) return null;
    }
    let s = stripped.replace(/[^0-9,.-]/g, '');
    if (!s || s === '-' || s === '.' || s === ',' ) return null;
    // Leading-dot serial residue (e.g. ".611152" from SN.611152) is not money.
    if (/^\.-?\d+$/.test(s) || /^\.\d+$/.test(s)) return null;
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) {
      s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (lc >= 0) {
      s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Section boundary: PARTS TOTAL scan must not continue into the Labour table.
   */
  function isPartsTotalSectionStop(line) {
    const x = String(line == null ? '' : line);
    return /Dealer\s+Distributor\s+Labour|Labour\s+Hrs\s+Rate|TOTAL\s+AMOUNT\s+CLAIMED|Attach\s+rele(?:vant|vent)\s+photos?/i.test(x);
  }

  root.SDLGClaimParserHelpers = Object.freeze({
    version: '1.1.0',
    cleanSourceCell: cleanSourceCell,
    isNumericCell: isNumericCell,
    isZeroMoneyPlaceholder: isZeroMoneyPlaceholder,
    isRejectableAmountToken: isRejectableAmountToken,
    parseCellMoney: parseCellMoney,
    isPartsTotalSectionStop: isPartsTotalSectionStop
  });
})(typeof window !== 'undefined' ? window : globalThis);
