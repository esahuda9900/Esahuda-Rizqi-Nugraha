const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(input, pattern, replacement, label) {
  const output = typeof pattern === 'string'
    ? (input.includes(pattern) ? input.replace(pattern, replacement) : input)
    : input.replace(pattern, replacement);
  if (output === input) throw new Error(label + ': target not found');
  return output;
}

// Module script
if (!source.includes('/modules/boss-analytics-dashboard.js')) {
  const tag = '<script src="/modules/boss-analytics-dashboard.js"></script>\n';
  for (const anchor of [
    '<script src="/modules/claim-list-sort.js"></script>',
    '<script src="/modules/navigation-state.js"></script>',
    '<script src="/modules/sdlg-core.js"></script>',
    '<script src="/modules/claim-parser-helpers.js"></script>'
  ]) {
    if (source.includes(anchor)) {
      source = replaceOnce(source, anchor, tag + anchor, 'module');
      console.log('Injected boss analytics module');
      break;
    }
  }
} else console.log('Boss analytics module ok');

// Operational Command Center module. Keep this additive and outside the monolithic React bundle.
if (!source.includes('/modules/command-center.js')) {
  const tag = '<script src="/modules/command-center.js"></script>\n';
  for (const anchor of [
    '<script src="/modules/boss-analytics-dashboard.js"></script>',
    '<script src="/modules/claim-list-sort.js"></script>',
    '<script src="/modules/navigation-state.js"></script>'
  ]) {
    if (source.includes(anchor)) {
      source = replaceOnce(source, anchor, tag + anchor, 'command center module');
      console.log('Injected command center module');
      break;
    }
  }
} else console.log('Command center module ok');

// Analytics state + DB-backed operational datasets
if (!source.includes('__SDLG_ANALYTICS_STATE_V2__')) {
  const anchor = 'const [analyticsYear, setAnalyticsYear] = useState("ALL");';
  const additions = `${anchor}\n    /* __SDLG_ANALYTICS_STATE_V2__ */\n    const [analyticsMonth, setAnalyticsMonth] = useState("ALL");\n    const [bossOpsRows, setBossOpsRows] = useState([]);\n    const [stageAgingRows, setStageAgingRows] = useState([]);\n    const [statusDwellRows, setStatusDwellRows] = useState([]);\n    useEffect(() => {\n        let cancelled = false;\n        (async () => {\n            try {\n                const client = (typeof sdlgSupabase !== "undefined") ? sdlgSupabase : null;\n                if (!client?.from) return;\n                const [ops, stages, dwell] = await Promise.all([\n                    client.from("claim_ops_boss_v").select("*"),\n                    client.from("claim_stage_aging_summary_v").select("*"),\n                    client.from("claim_status_dwell_v").select("*")\n                ]);\n                if (cancelled) return;\n                setBossOpsRows(Array.isArray(ops?.data) ? ops.data : []);\n                setStageAgingRows(Array.isArray(stages?.data) ? stages.data : []);\n                setStatusDwellRows(Array.isArray(dwell?.data) ? dwell.data : []);\n            } catch (_) {\n                // Read-only analytics enrichment; dashboard remains usable if a view is unavailable.\n            }\n        })();\n        return () => { cancelled = true; };\n    }, []);`;
  source = replaceOnce(source, anchor, additions, 'analytics state');
  console.log('Analytics state + DB views wired');
} else console.log('Analytics state ok');

// Upgrade legacy year-only scope to year + month.
if (!source.includes('__SDLG_ANALYTICS_FILTER_V2__')) {
  const oldScope = 'const scopeClaims = (window.SDLGBossAnalytics && window.SDLGBossAnalytics.filterByYear)\n                ? window.SDLGBossAnalytics.filterByYear(claims, analyticsYear)\n                : claims.filter(c => !c.archived_at);';
  const newScope = `const scopeClaims = (window.SDLGBossAnalytics && window.SDLGBossAnalytics.filterByPeriod)\n                ? window.SDLGBossAnalytics.filterByPeriod(claims, analyticsYear, analyticsMonth)\n                : claims.filter(c => !c.archived_at);\n            const scopeBossRows = (window.SDLGBossAnalytics && window.SDLGBossAnalytics.filterByPeriod)\n                ? window.SDLGBossAnalytics.filterByPeriod(bossOpsRows, analyticsYear, analyticsMonth)\n                : bossOpsRows;\n            /* __SDLG_ANALYTICS_FILTER_V2__ */`;
  if (source.includes(oldScope)) {
    source = replaceOnce(source, oldScope, newScope, 'period scope');
  } else if (source.includes('__SDLG_ANALYTICS_FILTER_V1__')) {
    source = source.replace(
      /\/\* __SDLG_ANALYTICS_FILTER_V1__ \*\/[\s\S]*?const totalClaims = scopeClaims\.length;/,
      `/* __SDLG_ANALYTICS_FILTER_V2__ */\n            ${newScope}\n            const totalClaims = scopeClaims.length;`
    );
  } else {
    throw new Error('period scope legacy target missing');
  }
  console.log('Year + month scope wired');
} else console.log('Period scope ok');

// KPI calculations: targeted replacements only.
if (!source.includes('__SDLG_ANALYTICS_SCOPE_CALC_V2__')) {
  const kpiOld = 'const approved = claims.filter(c => c.claim_status === "Approved").length;\n            const rejected = claims.filter(c => c.claim_status === "Rejected").length;\n            const onHold = claims.filter(c => c.claim_status === "On Hold").length;\n            const amountsByCurrency = claims.reduce';
  const kpiNew = '/* __SDLG_ANALYTICS_SCOPE_CALC_V2__ */\n            const approved = scopeClaims.filter(c => c.claim_status === "Approved").length;\n            const rejected = scopeClaims.filter(c => c.claim_status === "Rejected").length;\n            const onHold = scopeClaims.filter(c => c.claim_status === "On Hold").length;\n            const amountsByCurrency = scopeClaims.reduce';
  if (source.includes(kpiOld)) source = replaceOnce(source, kpiOld, kpiNew, 'kpi scope');
  else console.log('KPI scope already baked or changed; leaving intact');

  const chartsOld = 'const monthData = Object.entries(claims.reduce((a, c) => { const k = monthKey(c); a[k] = (a[k] || 0) + 1; return a; }, {})).filter(([k]) => k !== "Unknown").sort((a, b) => a[0].localeCompare(b[0])).slice(-12);\n            const modelData = Object.entries(claims.reduce((a, c) => { const k = c.model || "Unknown"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);\n            const branchData = Object.entries(claims.reduce((a, c) => { const k = c.branch || "Unassigned"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);\n            const partAgg = claims.reduce((a, c) => {';
  const chartsNew = 'const monthData = Object.entries(scopeClaims.reduce((a, c) => { const k = monthKey(c); a[k] = (a[k] || 0) + 1; return a; }, {})).filter(([k]) => k !== "Unknown").sort((a, b) => a[0].localeCompare(b[0])).slice(-12);\n            const modelData = Object.entries(scopeClaims.reduce((a, c) => { const k = c.model || "Unknown"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);\n            const branchData = Object.entries(scopeClaims.reduce((a, c) => { const k = c.branch || "Unassigned"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);\n            const partAgg = scopeClaims.reduce((a, c) => {';
  if (source.includes(chartsOld)) source = replaceOnce(source, chartsOld, chartsNew, 'chart scope');
  else console.log('Chart scope already baked or changed; leaving intact');
}

// Upgrade year-only filter UI to year + month.
if (!source.includes('__SDLG_ANALYTICS_PERIOD_BAR_V2__')) {
  const oldCall = '(window.SDLGBossAnalytics && window.SDLGBossAnalytics.yearFilterBar)\n                    ? window.SDLGBossAnalytics.yearFilterBar({ React, claims, year: analyticsYear, setYear: setAnalyticsYear })\n                    : null,';
  const newCall = `/* __SDLG_ANALYTICS_PERIOD_BAR_V2__ */\n                (window.SDLGBossAnalytics && window.SDLGBossAnalytics.periodFilterBar)\n                    ? window.SDLGBossAnalytics.periodFilterBar({ React, claims, year: analyticsYear, setYear: setAnalyticsYear, month: analyticsMonth, setMonth: setAnalyticsMonth })\n                    : null,`;
  if (source.includes(oldCall)) source = replaceOnce(source, oldCall, newCall, 'period bar upgrade');
  else if (source.includes('__SDLG_ANALYTICS_YEAR_BAR_V1__')) {
    source = source.replace(
      '/* __SDLG_ANALYTICS_YEAR_BAR_V1__ */',
      '/* __SDLG_ANALYTICS_YEAR_BAR_V1__ */\n                ' + newCall
    );
  } else throw new Error('period bar target missing');
  console.log('Year + month filter UI wired');
} else console.log('Period bar ok');

// Keep extra analytics panels INSIDE the dashboard page.
const extra = `/* __SDLG_BOSS_EXTRA_PANELS_V2__ */
                (window.SDLGBossAnalytics && window.SDLGBossAnalytics.renderExtraPanels)
                    ? window.SDLGBossAnalytics.renderExtraPanels({
                        React,
                        claims: scopeClaims,
                        bossRows: scopeBossRows,
                        actionCenterRows,
                        stageAgingRows,
                        statusDwellRows,
                        year: analyticsYear,
                        month: analyticsMonth
                      })
                    : null`;

if (source.includes('__SDLG_BOSS_EXTRA_PANELS_V2__')) {
  console.log('Boss analytics panel v2 already wired');
} else if (source.includes('__SDLG_BOSS_EXTRA_PANELS_V1__')) {
  const reTail = /"Belum ada claim rejected\."\)+,?\s*\/\* __SDLG_BOSS_EXTRA_PANELS_V1__ \*\/[\s\S]*?: null\)*;/;
  if (!reTail.test(source)) throw new Error('existing boss analytics v1 block not found');
  source = source.replace(reTail, `"Belum ada claim rejected.")),\n                ${extra}));`);
  console.log('Boss analytics panel upgraded to v2');
} else if (source.includes('"Belum ada claim rejected."))));')) {
  source = source.replace('"Belum ada claim rejected."))));', `"Belum ada claim rejected.")),\n                ${extra}));`);
  console.log('Boss analytics panel inserted');
} else {
  throw new Error('No rejection end found');
}

fs.writeFileSync(file, source);

const start = source.indexOf('return (React.createElement("div", { className: "page" }', source.indexOf('__SDLG_ANALYTICS_STATE_V2__'));
if (start < 0) throw new Error('dashboard return start not found');
const extraAt = source.indexOf('__SDLG_BOSS_EXTRA_PANELS_V2__', start);
if (extraAt < 0) throw new Error('analytics v2 marker not found');
let depth = 0;
for (const ch of source.slice(start, extraAt)) {
  if (ch === '(') depth++;
  else if (ch === ')') depth--;
}
console.log('depth at extra panels start (need >= 2 for page open):', depth);
if (depth < 2) {
  console.error('FAIL: page createElement already closed before extra panels');
  process.exit(1);
}
const end = source.indexOf('})()', extraAt);
depth = 0;
for (const ch of source.slice(start, end)) {
  if (ch === '(') depth++;
  else if (ch === ')') depth--;
}
console.log('depth at IIFE end (need 0):', depth);
if (depth !== 0) {
  console.error('FAIL: unbalanced');
  process.exit(1);
}
console.log('apply-boss-analytics-dashboard.js complete. VERIFIED.');
