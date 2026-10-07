/**
 * SDLG core helpers — identity + currency. Loads portal mirror v1.5.5 if needed.
 */
(function (root) {
  'use strict';

  function modelKey(value) {
    return String(value == null ? '' : value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  const MODEL_ALIASES = {
    SDLGG9138F: 'G9138F-LS', G9138F: 'G9138F-LS', G9138FLS: 'G9138F-LS',
    SDLGRS7120H: 'RS7120H-LS', RS7120H: 'RS7120H-LS', RS7120HLS: 'RS7120H-LS',
    SDLGE6210F: 'E6210F', E6210F: 'E6210F', SDLGE660FL: 'E660FL', E660FL: 'E660FL',
    SDLG968F: 'L968F', '968F': 'L968F', L968F: 'L968F',
    SDLG953H: 'L953H', '953H': 'L953H', L953H: 'L953H',
    SDLGL968F: 'L968F', SDLGE6138F: 'E6138F', E6138F: 'E6138F',
    SDLGE6550F: 'E6550F', E6550F: 'E6550F'
  };

  function canonicalModel(value) {
    const raw = String(value == null ? '' : value).trim();
    return MODEL_ALIASES[modelKey(raw)] || raw;
  }

  function modelsEquivalent(a, b) {
    const norm = function (v) {
      return modelKey(canonicalModel(v)).replace(/LS$/i, '').replace(/^SDLG(?=(?:E|G|L|RS|RD|B|S|EA|ER|LG))/, '');
    };
    const A = norm(a);
    const B = norm(b);
    return Boolean(A && B && A === B);
  }

  function baseCustomerName(value) {
    var x = String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, ' ');
    x = x.replace(/^(PT|CV|MR|MRS|MS|HJ|HAJI|H)[.\s-]+/i, '');
    x = x.replace(/[.\s,-]+(PT|CV|MR|MRS|MS|HJ|HAJI|H)\.?$/i, '');
    x = x.replace(/,?\s*(PT|CV)\.?$/i, '');
    return x.replace(/[^A-Z0-9]/g, '');
  }

  function normalizeDealerCode(value) {
    const x = String(value == null ? '' : value).trim().toUpperCase();
    return ['ITU', 'ITU2', 'ITU4', 'ITU6', 'ITU7'].indexOf(x) >= 0 ? 'ITU' : x;
  }

  function serialEquivalent(a, b) {
    const A = String(a == null ? '' : a).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const B = String(b == null ? '' : b).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!A || !B) return false;
    if (A === B) return true;
    const six = function (x) { var m = String(x || '').match(/(\d{6})$/); return m ? m[1] : null; };
    const a6 = six(A), b6 = six(B);
    if (a6 && b6 && a6 === b6) return true;
    if (A.length <= 10 && B.endsWith(A)) return true;
    if (B.length <= 10 && A.endsWith(B)) return true;
    return false;
  }

  function normalizeClaimCurrency(value, sourceText, dealerClaimNo) {
    const v = String(value == null ? '' : value).trim().toUpperCase();
    const src = String(sourceText == null ? '' : sourceText);
    const claimNo = String(dealerClaimNo == null ? '' : dealerClaimNo).trim().toUpperCase();
    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return 'USD';
    const srcWithoutPlaceholders = src.replace(/\bUSD\s*[-–—]+/gi, ' ').replace(/\$\s*[-–—]+/g, ' ');
    const hasRealUsd = /\bUSD\b/i.test(srcWithoutPlaceholders) || /\$\s*\d/.test(srcWithoutPlaceholders);
    if (hasRealUsd && (v === 'USD' || v === '')) return 'USD';
    if (/\bIDR\b|\bRP\b/i.test(src) && v === 'IDR') return 'IDR';
    if (/¥|CNY/i.test(src)) return 'CNY';
    if (v === 'USD' && !hasRealUsd) return 'CNY';
    return 'CNY';
  }

  function effectiveClaimCurrency(claim) {
    const claimNo = String(claim && claim.dealer_claim_no != null ? claim.dealer_claim_no : '').trim().toUpperCase();
    const stored = String(claim && claim.currency != null ? claim.currency : '').trim().toUpperCase();
    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return 'USD';
    if (/^ORF(?:-|$)/.test(claimNo)) return 'CNY';
    return ['USD', 'CNY', 'IDR'].indexOf(stored) >= 0 ? stored : 'UNKNOWN';
  }

  function inferCurrencyTokenFromSource(rawText) {
    const cleaned = String(rawText == null ? '' : rawText).replace(/\bUSD\s*[-–—]+/gi, ' ').replace(/\$\s*[-–—]+/g, ' ');
    if (/\bUSD\b/i.test(cleaned) || /\$\s*\d/.test(cleaned)) return 'USD';
    if (/\bIDR\b|\bRP\b/i.test(rawText || '')) return 'IDR';
    return 'CNY';
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
      version: '1.1.5', modelKey: modelKey, canonicalModel: canonicalModel,
      modelsEquivalent: modelsEquivalent, baseCustomerName: baseCustomerName,
      normalizeDealerCode: normalizeDealerCode, serialEquivalent: serialEquivalent,
      normalizeClaimCurrency: normalizeClaimCurrency, effectiveClaimCurrency: effectiveClaimCurrency,
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
    if (!document.querySelector('script[data-sdlg-portal-mirror-155]') &&
        !window.__SDLG_PORTAL_MIRROR_155__) {
      var s = document.createElement('script');
      s.src = '/modules/sdlg-repair-date-inject.js?v=1.5.5';
      s.async = true;
      s.setAttribute('data-sdlg-portal-mirror-155', '1');
      (document.head || document.documentElement).appendChild(s);
    }
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
