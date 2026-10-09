/**
 * SDLG core helpers — identity + currency. Portal Mirror disabled.
 * Policy via sdlg_policy_runtime_snapshot RPC (service_policy_rules).
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
      version: '1.1.8',
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
    // Portal Mirror disabled — do not load sdlg-repair-date-inject.js
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
        if (k.indexOf('supabase') !== -1 && k.toLowerCase().indexOf('auth') !== -1) return true;
      }
    } catch (_) {}
    return false;
  }
  async function waitForSession(client, maxMs) {
    var started = Date.now();
    var session = null;
    while (Date.now() - started < maxMs) {
      try {
        var sessionResult = await client.auth.getSession();
        session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
        if (session && session.access_token) return session;
      } catch (_) {}
      await sleep(SESSION_POLL_MS);
    }
    try {
      var finalResult = await client.auth.getSession();
      session = finalResult && finalResult.data ? finalResult.data.session : null;
      if (session && session.access_token) return session;
    } catch (_) {}
    return null;
  }
  root.SDLGPolicyRulesQuery = async function (client, selectColumns, ruleCodes) {
    try {
      if (!client || !client.auth || typeof client.rpc !== 'function') {
        return { data: [], error: null, deferred: true };
      }
      var session = null;
      try {
        var quick = await client.auth.getSession();
        session = quick && quick.data ? quick.data.session : null;
      } catch (_) {}
      if ((!session || !session.access_token) && hasStoredSessionHint()) {
        session = await waitForSession(client, SESSION_WAIT_MS);
      }
      if (!session || !session.access_token) {
        return { data: [], error: null, deferred: true };
      }
      // Correct source: RPC over service_policy_rules (table policy_rules does NOT exist)
      var rpc = await client.rpc('sdlg_policy_runtime_snapshot');
      if (rpc && rpc.error) return { data: null, error: rpc.error };
      var payload = rpc && rpc.data != null ? rpc.data : [];
      var normalizeJsonValue = function (value) {
        if (typeof value !== 'string') return value;
        try { return JSON.parse(value); } catch (_) { return value; }
      };
      var unwrapPolicyPayload = function (value) {
        var current = normalizeJsonValue(value);
        for (var depth = 0; depth < 5; depth++) {
          current = normalizeJsonValue(current);
          if (Array.isArray(current)) {
            if (current.length === 1 && current[0] && typeof current[0] === 'object') {
              var one = current[0];
              if (Array.isArray(one.service_policy_rules)) return one.service_policy_rules;
              if (one.sdlg_policy_runtime_snapshot !== undefined) { current = one.sdlg_policy_runtime_snapshot; continue; }
              if (one.data !== undefined) { current = one.data; continue; }
              if (one.result !== undefined) { current = one.result; continue; }
            }
            return current;
          }
          if (current && typeof current === 'object') {
            if (Array.isArray(current.service_policy_rules)) return current.service_policy_rules;
            if (current.sdlg_policy_runtime_snapshot !== undefined) { current = current.sdlg_policy_runtime_snapshot; continue; }
            if (current.data !== undefined) { current = current.data; continue; }
            if (current.result !== undefined) { current = current.result; continue; }
          }
          return [];
        }
        return [];
      };
      var rows = unwrapPolicyPayload(payload);
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
