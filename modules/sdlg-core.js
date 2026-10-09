/**
 * SDLG core helpers — identity + currency. Portal Mirror (Warranty Claim Form) disabled.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_CORE_IDENTITY_V1__) return;
  root.__SDLG_CORE_IDENTITY_V1__ = true;

  var MODEL_ALIASES = {
    L936H: ['L936H', 'L936'],
    L956H: ['L956H', 'L956'],
    L968F: ['L968F', 'L968'],
    L975H: ['L975H', 'L975']
  };

  function modelKey(m) {
    return String(m || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function canonicalModel(m) {
    var k = modelKey(m);
    if (!k) return '';
    for (var base in MODEL_ALIASES) {
      if (MODEL_ALIASES[base].indexOf(k) >= 0 || base === k) return base;
    }
    return k;
  }

  function modelsEquivalent(a, b) {
    var ca = canonicalModel(a);
    var cb = canonicalModel(b);
    return !!(ca && cb && ca === cb);
  }

  function baseCustomerName(name) {
    return String(name || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function normalizeDealerCode(code) {
    return String(code || '').trim().toUpperCase();
  }

  function serialEquivalent(a, b) {
    var sa = String(a || '').replace(/\s+/g, '').toUpperCase();
    var sb = String(b || '').replace(/\s+/g, '').toUpperCase();
    if (!sa || !sb) return false;
    if (sa === sb) return true;
    if (sa.length >= 6 && sb.length >= 6 && (sa.slice(-6) === sb.slice(-6))) return true;
    return false;
  }

  function normalizeClaimCurrency(v) {
    var s = String(v || '').trim().toUpperCase();
    if (!s) return '';
    if (/IDR|RP|RUPIAH/.test(s)) return 'IDR';
    if (/USD|\$|DOLLAR/.test(s)) return 'USD';
    if (/CNY|RMB|YUAN/.test(s)) return 'CNY';
    return s;
  }

  function effectiveClaimCurrency(row) {
    if (!row) return '';
    return normalizeClaimCurrency(row.currency || row.claim_currency || row.amount_currency || '');
  }

  function inferCurrencyTokenFromSource(text) {
    var s = String(text || '').toUpperCase();
    if (/\bIDR\b|\bRP\b|RUPIAH/.test(s)) return 'IDR';
    if (/\bUSD\b|\$/.test(s)) return 'USD';
    if (/\bCNY\b|\bRMB\b/.test(s)) return 'CNY';
    return '';
  }

  function installIdentityHelpers() {
    root.SDLGCanonicalModel = canonicalModel;
    root.SDLGModelsEquivalent = modelsEquivalent;
    root.SDLGBaseCustomerName = baseCustomerName;
    root.SDLGNormalizeDealerCode = normalizeDealerCode;
    root.SDLGSerialEquivalent = serialEquivalent;
    root.SDLGNormalizeClaimCurrency = normalizeClaimCurrency;
    root.SDLGEffectiveClaimCurrency = effectiveClaimCurrency;
    root.SDLGInferCurrencyToken = inferCurrencyTokenFromSource;
    root.SDLGCore = Object.freeze({
      version: '1.1.7',
      modelKey: modelKey,
      canonicalModel: canonicalModel,
      modelsEquivalent: modelsEquivalent,
      baseCustomerName: baseCustomerName,
      normalizeDealerCode: normalizeDealerCode,
      serialEquivalent: serialEquivalent,
      normalizeClaimCurrency: normalizeClaimCurrency,
      effectiveClaimCurrency: effectiveClaimCurrency,
      inferCurrencyTokenFromSource: inferCurrencyTokenFromSource,
      MODEL_ALIASES: Object.freeze(Object.assign({}, MODEL_ALIASES))
    });
  }

  installIdentityHelpers();

  if (typeof document !== 'undefined') {
    setTimeout(installIdentityHelpers, 0);
    setTimeout(installIdentityHelpers, 50);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installIdentityHelpers, { once: true });
    }
    // Portal Mirror (Warranty Claim Form) permanently disabled — do not load sdlg-repair-date-inject.js
    try { window.__SDLG_PORTAL_MIRROR_155__ = true; } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);

(function (root) {
  'use strict';
  const previous = root.SDLGPolicyRulesQuery;
  const SESSION_WAIT_MS = 4000;
  const SESSION_POLL_MS = 200;
  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function hasStoredSessionHint() {
    try {
      if (typeof localStorage === 'undefined') return false;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (/sb-.*-auth-token/i.test(k) || /supabase\.auth/i.test(k)) return true;
      }
    } catch (_) {}
    return false;
  }
  function getClient() {
    try {
      if (typeof root.getSdlgSupabase === 'function') {
        var c = root.getSdlgSupabase();
        if (c) return c;
      }
    } catch (_) {}
    return root.sdlgSupabase || root.supabaseClient || null;
  }
  async function waitForSession(client) {
    if (!client || !client.auth) return null;
    var start = Date.now();
    while (Date.now() - start < SESSION_WAIT_MS) {
      try {
        var res = await client.auth.getSession();
        if (res && res.data && res.data.session) return res.data.session;
      } catch (_) {}
      await sleep(SESSION_POLL_MS);
    }
    return null;
  }
  root.SDLGPolicyRulesQuery = previous || function () { return Promise.resolve([]); };
})(typeof window !== 'undefined' ? window : globalThis);
