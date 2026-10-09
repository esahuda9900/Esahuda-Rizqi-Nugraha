/**
 * SDLG core helpers — identity + currency. Portal Mirror (Warranty Claim Form) disabled.
 */
(function (root) {
  'use strict';

  const MODEL_ALIASES = {
    L936H: ['L936H', 'L936'],
    L956H: ['L956H', 'L956'],
    L968F: ['L968F', 'L968'],
    L975H: ['L975H', 'L975']
  };

  function modelKey(value) {
    return String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, '');
  }

  function canonicalModel(value) {
    var k = modelKey(value);
    if (!k) return '';
    for (var base in MODEL_ALIASES) {
      if (Object.prototype.hasOwnProperty.call(MODEL_ALIASES, base)) {
        if (base === k || MODEL_ALIASES[base].indexOf(k) >= 0) return base;
      }
    }
    return k;
  }

  function modelsEquivalent(a, b) {
    var ca = canonicalModel(a);
    var cb = canonicalModel(b);
    return !!(ca && cb && ca === cb);
  }

  function baseCustomerName(value) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function normalizeDealerCode(value) {
    return String(value == null ? '' : value).trim().toUpperCase();
  }

  function serialEquivalent(a, b) {
    var sa = String(a == null ? '' : a).replace(/\s+/g, '').toUpperCase();
    var sb = String(b == null ? '' : b).replace(/\s+/g, '').toUpperCase();
    if (!sa || !sb) return false;
    if (sa === sb) return true;
    if (sa.length >= 6 && sb.length >= 6 && sa.slice(-6) === sb.slice(-6)) return true;
    return false;
  }

  function normalizeClaimCurrency(value, sourceText, dealerClaimNo) {
    var s = String(value == null ? '' : value).trim().toUpperCase();
    if (!s) {
      var blob = String(sourceText || '') + ' ' + String(dealerClaimNo || '');
      if (/\bIDR\b|\bRP\b|RUPIAH/i.test(blob)) return 'IDR';
      if (/\bUSD\b|\$/i.test(blob)) return 'USD';
      if (/\bCNY\b|\bRMB\b/i.test(blob)) return 'CNY';
      return '';
    }
    if (/IDR|RP|RUPIAH/.test(s)) return 'IDR';
    if (/USD|\$|DOLLAR/.test(s)) return 'USD';
    if (/CNY|RMB|YUAN/.test(s)) return 'CNY';
    return s;
  }

  function effectiveClaimCurrency(claim) {
    if (!claim || typeof claim !== 'object') return '';
    return normalizeClaimCurrency(
      claim.currency || claim.claim_currency || claim.amount_currency,
      claim.source_text || claim.raw_text,
      claim.dealer_claim_no
    );
  }

  function inferCurrencyTokenFromSource(rawText) {
    var s = String(rawText == null ? '' : rawText).toUpperCase();
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
  async function waitForSession(client, maxMs) {
    if (!client || !client.auth) return null;
    var limit = typeof maxMs === 'number' ? maxMs : SESSION_WAIT_MS;
    var start = Date.now();
    while (Date.now() - start < limit) {
      try {
        var res = await client.auth.getSession();
        if (res && res.data && res.data.session) return res.data.session;
      } catch (_) {}
      await sleep(SESSION_POLL_MS);
    }
    return null;
  }
  root.SDLGPolicyRulesQuery = async function (client, selectColumns, ruleCodes) {
    try {
      if (!client || typeof client.from !== 'function') {
        if (typeof previous === 'function') return previous(client, selectColumns, ruleCodes);
        return { data: null, error: new Error('No supabase client') };
      }
      if (hasStoredSessionHint()) {
        try { await waitForSession(client, 1500); } catch (_) {}
      }
      var q = client.from('policy_rules').select(selectColumns || '*');
      var res = await q;
      var rows = res && res.data;
      if (res && res.error) throw res.error;
      var normalizedRows = (Array.isArray(rows) ? rows : []).map(function (row) {
        if (!row || typeof row !== 'object') return row;
        var out = Object.assign({}, row);
        if (out.rule_code != null) out.rule_code = String(out.rule_code).trim();
        return out;
      });
      var wanted = new Set((Array.isArray(ruleCodes) ? ruleCodes : []).map(function (code) {
        return String(code == null ? '' : code).trim();
      }).filter(Boolean));
      var columns = String(selectColumns || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
      var data = normalizedRows.filter(function (row) {
        return row && (!wanted.size || wanted.has(row.rule_code));
      }).map(function (row) {
        if (!columns.length) return row;
        var mapped = {};
        columns.forEach(function (key) { mapped[key] = row[key]; });
        return mapped;
      });
      return { data: data, error: null, meta: { rowCount: normalizedRows.length } };
    } catch (error) {
      if (typeof previous === 'function') {
        try {
          var fallback = await previous(client, selectColumns, ruleCodes);
          if (fallback && Array.isArray(fallback.data) && fallback.data.length) return fallback;
        } catch (_) {}
      }
      return { data: null, error: error };
    }
  };
})(window);
