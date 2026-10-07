/**
 * Apply performance patches to index.html (build pipeline).
 *
 * 1) Progressive claims load: first page paints UI faster, remainder hydrates in background.
 * 2) Defer SheetJS (xlsx) until export needs it.
 * 3) Smaller PAGE_SIZE for listClaims pagination chunks.
 *
 * Does not change warranty engine, RLS, or claim write paths.
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
let changes = 0;

function replaceOnce(label, from, to) {
  if (!source.includes(from)) {
    console.warn('[apply-perf] skip (not found):', label);
    return;
  }
  if (to.length > 40 && source.includes(to)) {
    console.log('[apply-perf] already applied:', label);
    return;
  }
  const next = source.replace(from, to);
  if (next === source) {
    console.warn('[apply-perf] no-op:', label);
    return;
  }
  source = next;
  changes += 1;
  console.log('[apply-perf] applied:', label);
}

replaceOnce(
  'PAGE_SIZE const 500 -> 100',
  'const PAGE_SIZE = 500;',
  'const PAGE_SIZE = 100;'
);
replaceOnce(
  'FOUNDATION PAGE_SIZE 500 -> 100',
  'PAGE_SIZE: 500,',
  'PAGE_SIZE: 100,'
);

const oldLoad = `const loadClaims = useCallback(async () => {
        if (!user) {
            setClaims([]);
            setActionCenterRows([]);
            setLoading(false);
            return;
        }
        if (!sdlgSupabase) {
            setLoading(false);
            showToast("Konfigurasi Supabase belum diisi.");
            return;
        }
        setLoading(true);
        setClaimsLoadError(null);
        try {
            const [all, actionRows] = await Promise.all([
                SDLG_REPOSITORY.listClaims(),
                runSupabaseRead(async () => {
                    const result = await sdlgSupabase.from("claim_action_center_v").select("*");
                    return result;
                })
            ]);
            setClaims(all);
            setClaimsLoadError(null);
            if (actionRows?.error) throw actionRows.error;
            setActionCenterRows(actionRows?.data || []);
            setActionCenterLoadError(null);
        }
        catch (e) {
            console.error(e);
            const msg = e?.message || "Unknown error";
            setClaimsLoadError(msg);
            setActionCenterLoadError(msg);
            showToast("Gagal load data: " + msg);
        }
        finally {
            setLoading(false);
        }
    }, [user]);`;

const newLoad = `const loadClaims = useCallback(async () => {
        if (!user) {
            setClaims([]);
            setActionCenterRows([]);
            setLoading(false);
            return;
        }
        if (!sdlgSupabase) {
            setLoading(false);
            showToast("Konfigurasi Supabase belum diisi.");
            return;
        }
        setLoading(true);
        setClaimsLoadError(null);
        try {
            /* PERF: first page for fast interactive list; full hydrate in background */
            const firstPage = typeof SDLG_REPOSITORY.listClaimsPage === "function"
                ? await SDLG_REPOSITORY.listClaimsPage(0)
                : null;
            if (firstPage && firstPage.length) {
                setClaims(firstPage);
                setLoading(false);
            }
            const [all, actionRows] = await Promise.all([
                SDLG_REPOSITORY.listClaims(),
                runSupabaseRead(async () => {
                    const result = await sdlgSupabase.from("claim_action_center_v").select("*");
                    return result;
                })
            ]);
            setClaims(all);
            setClaimsLoadError(null);
            if (actionRows?.error) throw actionRows.error;
            setActionCenterRows(actionRows?.data || []);
            setActionCenterLoadError(null);
        }
        catch (e) {
            console.error(e);
            const msg = e?.message || "Unknown error";
            setClaimsLoadError(msg);
            setActionCenterLoadError(msg);
            showToast("Gagal load data: " + msg);
        }
        finally {
            setLoading(false);
        }
    }, [user]);`;

replaceOnce('progressive loadClaims', oldLoad, newLoad);

// Always ensure helper *definition* exists (name may already appear in loadClaims)
if (!source.includes('listClaimsPage = async function')) {
  const anchor = 'SDLG_REPOSITORY.listClaims = async function () {';
  const idx = source.indexOf(anchor);
  if (idx !== -1) {
    const insert = `\n    SDLG_REPOSITORY.listClaimsPage = async function (page) {\n        const from = (page || 0) * SDLG_FOUNDATION.LIMITS.PAGE_SIZE;\n        const result = await SDLG_FOUNDATION.retry(async () => {\n            const r = await runSupabaseRead(() => sdlgSupabase.from("claims").select("*").order("claim_id", { ascending: false }).range(from, from + SDLG_FOUNDATION.LIMITS.PAGE_SIZE - 1));\n            if (r?.error) throw r.error;\n            return r;\n        });\n        const rows = result?.data || [];\n        const normalized = SDLG_DATA_MODEL.normalizeClaimCollection(rows);\n        return normalized.rows;\n    };\n`;
    source = source.slice(0, idx) + insert + source.slice(idx);
    changes += 1;
    console.log('[apply-perf] applied: listClaimsPage helper');
  } else {
    console.warn('[apply-perf] skip listClaimsPage (anchor not found)');
  }
} else {
  console.log('[apply-perf] already applied: listClaimsPage helper');
}

const xlsxTag = '<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"';
const xlsxIdx = source.indexOf(xlsxTag);
if (xlsxIdx !== -1 && !source.includes('SDLG_LOAD_XLSX')) {
  const end = source.indexOf('</script>', xlsxIdx);
  if (end !== -1) {
    const lineEnd = end + '</script>'.length;
    const stub = `<script>\nwindow.SDLG_LOAD_XLSX = function () {\n  if (window.XLSX) return Promise.resolve(window.XLSX);\n  if (window.__sdlgXlsxLoading) return window.__sdlgXlsxLoading;\n  window.__sdlgXlsxLoading = new Promise(function (resolve, reject) {\n    var s = document.createElement('script');\n    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';\n    s.async = true;\n    s.onload = function () { resolve(window.XLSX); };\n    s.onerror = function () { reject(new Error('Failed to load SheetJS')); };\n    document.head.appendChild(s);\n  });\n  return window.__sdlgXlsxLoading;\n};\n</script>`;
    source = source.slice(0, xlsxIdx) + stub + source.slice(lineEnd);
    changes += 1;
    console.log('[apply-perf] applied: defer SheetJS');
  }
} else if (source.includes('SDLG_LOAD_XLSX')) {
  console.log('[apply-perf] already applied: defer SheetJS');
} else {
  console.warn('[apply-perf] skip SheetJS (tag not found)');
}

const perfTag = '<script src="/modules/perf-runtime.js"></script>';
if (!source.includes('/modules/perf-runtime.js')) {
  if (source.includes('</head>')) {
    source = source.replace('</head>', perfTag + '\n</head>');
    changes += 1;
    console.log('[apply-perf] applied: perf-runtime script tag');
  }
}

if (changes === 0) {
  console.log('[apply-perf] no changes written');
  process.exit(0);
}

fs.writeFileSync(file, source);
console.log('[apply-perf] wrote index.html changes=', changes);
