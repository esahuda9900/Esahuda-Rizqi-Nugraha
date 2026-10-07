/**
 * Pure claim currency — matches index.html rules; sets window hooks index already checks.
 */
(function (root) {
  'use strict';
  function normalizeClaimCurrency(value, sourceText, dealerClaimNo) {
    var v = String(value || '').trim().toUpperCase();
    var src = String(sourceText || '');
    var claimNo = String(dealerClaimNo || '').trim().toUpperCase();
    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return 'USD';
    var srcWithoutPlaceholders = src.replace(/\bUSD\s*[-–—]+/gi, ' ').replace(/\$\s*[-–—]+/g, ' ');
    var hasRealUsd = /\bUSD\b/i.test(srcWithoutPlaceholders) || /\$\s*\d/.test(srcWithoutPlaceholders);
    if (hasRealUsd && (v === 'USD' || v === '')) return 'USD';
    if (/\bIDR\b|\bRP\b/i.test(src) && v === 'IDR') return 'IDR';
    if (/¥|CNY/i.test(src)) return 'CNY';
    if (v === 'USD' && !hasRealUsd) return 'CNY';
    return 'CNY';
  }
  function effectiveClaimCurrency(claim) {
    var claimNo = String((claim && (claim.dealer_claim_no || claim.dealerClaimNo)) || '').trim().toUpperCase();
    var stored = String((claim && claim.currency) || '').trim().toUpperCase();
    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return 'USD';
    if (/^ORF(?:-|$)/.test(claimNo)) return 'CNY';
    return ['USD', 'CNY', 'IDR'].indexOf(stored) >= 0 ? stored : 'UNKNOWN';
  }
  root.SDLGCoreCurrency = { version: '1.0.0', normalizeClaimCurrency: normalizeClaimCurrency, effectiveClaimCurrency: effectiveClaimCurrency };
  root.SDLGNormalizeClaimCurrency = normalizeClaimCurrency;
  root.SDLGEffectiveClaimCurrency = effectiveClaimCurrency;
})(typeof window !== 'undefined' ? window : globalThis);
