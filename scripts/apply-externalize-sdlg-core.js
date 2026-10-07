const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(input, pattern, replacement, label) {
  const output =
    typeof pattern === 'string'
      ? input.includes(pattern)
        ? input.replace(pattern, replacement)
        : input
      : input.replace(pattern, replacement);
  if (output === input) throw new Error(`${label}: target not found; refusing unsafe patch.`);
  return output;
}

// 1) Ensure core module loads first among local modules
const moduleTag = '<script src="/modules/sdlg-core.js"></script>\n';
if (!source.includes('/modules/sdlg-core.js')) {
  if (source.includes('<script src="/modules/claim-parser-helpers.js"></script>')) {
    source = replaceOnce(
      source,
      '<script src="/modules/claim-parser-helpers.js"></script>',
      moduleTag + '<script src="/modules/claim-parser-helpers.js"></script>',
      'inject sdlg-core script tag'
    );
    console.log('Injected /modules/sdlg-core.js script tag.');
  } else {
    throw new Error('Cannot find claim-parser-helpers script tag to inject sdlg-core before it.');
  }
} else {
  console.log('sdlg-core script tag already present.');
}

// 1b) Shared UX runtime modules. Keep these as standalone modules so routine behavior
// does not grow the injector chain further.
const uxModuleAnchor = '<script src="/modules/claim-parser-helpers.js"></script>';
const uxModuleTags =
  '<script src="/modules/navigation-state.js"></script>\n' +
  '<script src="/modules/claim-list-sort.js"></script>\n' +
  uxModuleAnchor;
if (!source.includes('/modules/navigation-state.js')) {
  source = replaceOnce(source, uxModuleAnchor, uxModuleTags, 'inject UX runtime modules');
  console.log('Injected navigation-state and claim-list-sort modules.');
} else {
  console.log('UX runtime modules already present.');
}

// 2) Guard the whole identity-helper assignment block with one if.
// Core module defines these first; inline becomes fallback only.
if (source.includes('SDLG_CORE_EXTERNALIZED')) {
  console.log('Inline identity helpers already guarded.');
} else if (source.includes('window.SDLGCanonicalModel = function(v){')) {
  source = replaceOnce(
    source,
    'window.SDLGCanonicalModel = function(v){',
    `/* SDLG_CORE_EXTERNALIZED */\n      if (typeof window.SDLGCanonicalModel !== 'function') {\n      window.SDLGCanonicalModel = function(v){`,
    'open identity helper guard'
  );
  const marker = 'return !!A && !!B && A===B;\n      };';
  if (source.includes(marker)) {
    source = source.replace(marker, marker + '\n      }');
  } else {
    const alt = /(return !!A && !!B && A===B;\s*\};)/;
    if (!alt.test(source)) throw new Error('Could not find end of SDLGModelsEquivalent for guard close.');
    source = source.replace(alt, '$1\n      }');
  }
  console.log('Guarded full identity helper block (fallback if core missing).');
} else {
  console.log('Inline SDLGCanonicalModel not found (may already differ).');
}

// 3) Currency delegates to module when present
if (source.includes('SDLG_CURRENCY_EXTERNALIZED')) {
  console.log('Currency already externalized.');
} else {
  const oldNorm =
    /function normalizeClaimCurrency\(value, sourceText = "", dealerClaimNo = ""\) \{[\s\S]*?return "CNY";\n\}/;
  if (oldNorm.test(source)) {
    source = source.replace(
      oldNorm,
      `function normalizeClaimCurrency(value, sourceText = "", dealerClaimNo = "") {\n    /* SDLG_CURRENCY_EXTERNALIZED */\n    if (typeof window.SDLGNormalizeClaimCurrency === 'function') {\n        return window.SDLGNormalizeClaimCurrency(value, sourceText, dealerClaimNo);\n    }\n    const v = String(value || "").trim().toUpperCase();\n    const src = String(sourceText || "");\n    const claimNo = String(dealerClaimNo || "").trim().toUpperCase();\n    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return "USD";\n    const srcWithoutPlaceholders = src.replace(/\\bUSD\\s*[-–—]+/gi, " ").replace(/\\$\\s*[-–—]+/g, " ");\n    const hasRealUsd = /\\bUSD\\b/i.test(srcWithoutPlaceholders) || /\\$\\s*\\d/.test(srcWithoutPlaceholders);\n    if (hasRealUsd && (v === "USD" || v === "")) return "USD";\n    if (/\\bIDR\\b|\\bRP\\b/i.test(src) && v === "IDR") return "IDR";\n    if (/¥|CNY/i.test(src)) return "CNY";\n    if (v === "USD" && !hasRealUsd) return "CNY";\n    return "CNY";\n}`
    );
    console.log('normalizeClaimCurrency delegates to sdlg-core when available.');
  } else {
    console.log('normalizeClaimCurrency pattern not matched; skip.');
  }

  const oldEff =
    /function effectiveClaimCurrency\(claim\) \{[\s\S]*?return \["USD", "CNY", "IDR"\]\.includes\(stored\) \? stored : "UNKNOWN";\n\}/;
  if (oldEff.test(source) && !/window\.SDLGEffectiveClaimCurrency/.test(source)) {
    source = source.replace(
      oldEff,
      `function effectiveClaimCurrency(claim) {\n    if (typeof window.SDLGEffectiveClaimCurrency === 'function') {\n        return window.SDLGEffectiveClaimCurrency(claim);\n    }\n    const claimNo = String(claim?.dealer_claim_no || "").trim().toUpperCase();\n    const stored = String(claim?.currency || "").trim().toUpperCase();\n    if (/^YNFW[A-Z0-9-]*$/.test(claimNo)) return "USD";\n    if (/^ORF(?:-|$)/.test(claimNo)) return "CNY";\n    return ["USD", "CNY", "IDR"].includes(stored) ? stored : "UNKNOWN";\n}`
    );
    console.log('effectiveClaimCurrency delegates to sdlg-core when available.');
  }
}

// 4) Policy runtime reads MUST NOT query internal policy tables directly from the browser.
// Anonymous SELECT is intentionally blocked. Use the authenticated SECURITY DEFINER RPC
// and defer silently while auth is still being established.
if (!source.includes('__SDLG_POLICY_RPC_BRIDGE_V1__')) {
  const bridgeTag = '<script src="/modules/claim-parser-helpers.js"></script>';
  const bridge = "<script>\n/* __SDLG_POLICY_RPC_BRIDGE_V1__ */\nif (typeof window.SDLGPolicyRulesQuery !== 'function') {\nwindow.SDLGPolicyRulesQuery = async function(client, selectColumns, ruleCodes) {\n  try {\n    if (!client || !client.auth || typeof client.rpc !== 'function') {\n      return { data: [], error: null, deferred: true };\n    }\n    const sessionResult = await client.auth.getSession();\n    const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;\n    if (!session) {\n      return { data: [], error: null, deferred: true };\n    }\n    const rpc = await client.rpc('sdlg_policy_runtime_snapshot');\n    if (rpc && rpc.error) return { data: null, error: rpc.error };\n    const payload = rpc && rpc.data ? rpc.data : {};\n    const unwrapPolicyPayload = function (value) {\n      if (Array.isArray(value)) {\n        if (value.length === 1 && value[0] && typeof value[0] === 'object' &&\n            Array.isArray(value[0].service_policy_rules)) {\n          return value[0].service_policy_rules;\n        }\n        return value;\n      }\n      if (value && typeof value === 'object' && Array.isArray(value.service_policy_rules)) {\n        return value.service_policy_rules;\n      }\n      return [];\n    };\n    const rows = unwrapPolicyPayload(payload);\n    const wanted = new Set(Array.isArray(ruleCodes) ? ruleCodes : []);\n    const columns = String(selectColumns || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean);\n    const data = rows.filter(function(row){ return !wanted.size || wanted.has(row.rule_code); }).map(function(row){\n      if (!columns.length) return row;\n      const out = {};\n      columns.forEach(function(key){ out[key] = row[key]; });\n      return out;\n    });\n    return { data: data, error: null };\n  } catch (error) {\n    return { data: null, error: error };\n  }\n};\n}\n</script>\n";
  if (source.includes(bridgeTag)) {
    source = replaceOnce(source, bridgeTag, bridge + bridgeTag, 'inject policy RPC bridge');
    console.log('Injected authenticated policy RPC bridge.');
  } else {
    throw new Error('Cannot find claim-parser-helpers script tag to inject policy RPC bridge.');
  }
}

// Replace direct browser reads of the internal policy table with the RPC bridge.
const directPolicyQuery = /sdlgSupabase\.from\("service_policy_rules"\)\.select\("([^"]+)"\)\.in\("rule_code", (\[[^\]]+\])\)/g;
if (directPolicyQuery.test(source)) {
  source = source.replace(directPolicyQuery, 'window.SDLGPolicyRulesQuery(sdlgSupabase, "$1", $2)');
  console.log('Re-routed direct service_policy_rules browser reads to sdlg_policy_runtime_snapshot RPC.');
} else if (source.includes('window.SDLGPolicyRulesQuery(sdlgSupabase,')) {
  console.log('Policy rule reads already routed through RPC bridge.');
} else {
  throw new Error('Policy runtime bridge: direct service_policy_rules query targets not found.');
}

// 5) Persist the last top-level menu locally so a refresh returns the user to the same area.
// Claim detail stays represented by the list tab + detailId and therefore does not create
// a separate persisted destination.
const navStateMarker = '__SDLG_NAV_STATE_WIRING_V1__';
if (!source.includes(navStateMarker)) {
  const tabInit = 'const [tab, setTab] = useState("list"); // list | paste | detail';
  const tabInitReplacement = `/* ${navStateMarker} */\n    const [tab, setTab] = useState(() => window.SDLGNavState?.restore("list") || "list"); // dashboard | list | paste | sdlginput | masters | quality\n    useEffect(() => {\n        try { window.SDLGNavState?.persist(tab); } catch (_) {}\n    }, [tab]);`;
  source = replaceOnce(source, tabInit, tabInitReplacement, 'wire persisted navigation state');
  console.log('Persisted navigation state wired to App tab.');
} else {
  console.log('Persisted navigation state already wired.');
}

// 6) Claims page: newest business date first, regardless of Claim-ID year.
// Legacy claim IDs may carry older years than their actual claim date, so Claim ID is only
// a deterministic tie-breaker. Sorting is applied before pagination so every page/filter
// keeps the same newest-first behavior.
const claimOrderMarker = '__SDLG_CLAIM_NEWEST_FIRST_V1__';
if (!source.includes(claimOrderMarker)) {
  const filteredEnd = 'return matchYear && matchBranch && matchStatus && matchSearch;\n    });';
  const filteredReplacement = `return matchYear && matchBranch && matchStatus && matchSearch;\n    });\n    /* ${claimOrderMarker} */\n    const orderedFiltered = window.SDLGClaimListSort?.sortNewest(filtered) || filtered;`;
  source = replaceOnce(source, filteredEnd, filteredReplacement, 'wire newest-first claim ordering');

  source = replaceOnce(
    source,
    'const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));\n    const safePage = Math.min(page, totalPages);\n    const pagedFiltered = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);',
    'const totalPages = Math.max(1, Math.ceil(orderedFiltered.length / PAGE_SIZE));\n    const safePage = Math.min(page, totalPages);\n    const pagedFiltered = orderedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);',
    'apply sorted claim pagination'
  );
  console.log('Claims default order is now newest business date first.');
} else {
  console.log('Newest-first claim ordering already wired.');
}

fs.writeFileSync(file, source);
console.log('apply-externalize-sdlg-core.js complete.');
