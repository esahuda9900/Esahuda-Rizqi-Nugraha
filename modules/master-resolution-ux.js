(function (root) {
  'use strict';
  const MODEL_LOCK_RE = /SOURCE LOCK:\s*Model:\s*source=(["'])((?:(?!\1).)*)\1\s*vs\s*parse=(["'])((?:(?!\3).)*)\3/i;
  const BROAD_BRANCH_FALLBACK_MIN = 10;
  const BRANCH_EVIDENCE_MIN = 70;
  const BRANCH_EVIDENCE_MARGIN = 1.5;
  const INDENT_BRANCH_RE = /Branch diinfer dari histori indent|indent\s*\+\s*model\s*\+\s*customer/i;
  const STOCK_BRANCH_RE = /\bSTOCK\b/i;
  const MODEL_ALIASES = new Map([['SDLG968F','L968F'],['968F','L968F'],['L968F','L968F'],['SDLGG9138F','G9138F-LS'],['G9138F','G9138F-LS'],['G9138FLS','G9138F-LS']]);
  function clean(value) { return value == null ? '' : String(value).replace(/\s+/g, ' ').trim(); }
  function norm(value) { return clean(value).toUpperCase().replace(/[.,']/g, '').replace(/\s+/g, ' '); }
  function normalizeModel(value) { return clean(value).replace(/^SDLG\s+/i, '').replace(/\s+/g, '').toUpperCase(); }
  function localCanonicalModel(value) { const normalized = normalizeModel(value); return MODEL_ALIASES.get(normalized) || normalized; }
  function canonicalModel(value) { if (typeof root.SDLGCanonicalModel === 'function' && root.SDLGCore) return root.SDLGCanonicalModel(value); return localCanonicalModel(value); }
  function modelsEquivalent(a, b) { if (typeof root.SDLGModelsEquivalent === 'function' && root.SDLGCore) return root.SDLGModelsEquivalent(a, b); const left = localCanonicalModel(a); const right = localCanonicalModel(b); return Boolean(left && right && left === right); }
  function scoreBranchRows(rows, identity) {
    const byBranch = new Map(); const seen = new Set(); const serial = norm(identity?.serial); const suffix6 = serial.slice(-6);
    (rows || []).forEach((row) => {
      const branchId = clean(row.branch_id); const branch = clean(row.branch); if (!branchId || !branch) return;
      const rowSerial = norm(row.serial_no); const key = `${rowSerial}|${branchId}`; if (seen.has(key)) return; seen.add(key);
      let score = 0; if (rowSerial && serial && rowSerial === serial) score += 200; else if (suffix6 && rowSerial && rowSerial.slice(-6) === suffix6) score += 150;
      if (!score) return; const current = byBranch.get(branchId) || { branchId, branch, score: 0, units: 0 }; current.score += score; current.units += 1; byBranch.set(branchId, current);
    });
    return Array.from(byBranch.values()).sort((a, b) => b.score - a.score || b.units - a.units || a.branch.localeCompare(b.branch));
  }
  function inferUnitStatus(ctx) {
    if (!ctx || typeof ctx !== 'object') return 'UNKNOWN';
    const explicit = clean(ctx.unit_status || ctx.unitStatus).toUpperCase();
    if (explicit === 'STOCK' || explicit === 'SOLD') return explicit;
    const saleDate = ctx.machine_sale_date || ctx.sale_date || ctx.saleDate || null;
    const customerId = ctx.customer_id || ctx.customerId || null;
    const customerSource = clean(ctx.customer_name_source || ctx.customerNameSource || '');
    if (saleDate) return 'SOLD';
    if (!saleDate && !customerId && !customerSource) return 'STOCK';
    return 'UNKNOWN';
  }
  function isStockBranchName(name) { return STOCK_BRANCH_RE.test(clean(name)); }
  function pageHasIndentBranchInference(doc) { const el = doc || (typeof document !== 'undefined' ? document : null); if (!el || !el.body) return false; return INDENT_BRANCH_RE.test(String(el.body.innerText || '')); }
  function ensureIndentBranchBanner(doc) {
    const el = doc || document; if (!el || !el.body) return;
    var id = 'sdlg-indent-branch-guard'; var existing = el.getElementById(id);
    if (!pageHasIndentBranchInference(el)) { if (existing && existing.parentNode) existing.parentNode.removeChild(existing); return; }
    if (existing) return;
    var banner = el.createElement('div'); banner.id = id; banner.setAttribute('role', 'alert');
    banner.style.cssText = 'position:sticky;top:0;z-index:99998;padding:10px 14px;background:#7c2d12;color:#fff;font:600 13px/1.4 system-ui,sans-serif';
    banner.textContent = 'Branch dari tebakan indent diblok. Branch harus ikut UNIT (serial).';
    el.body.insertBefore(banner, el.body.firstChild);
  }
  function installRuntimeIndentBranchGuard() {
    if (typeof document === 'undefined') return; if (root.__SDLG_INDENT_BRANCH_GUARD__) return; root.__SDLG_INDENT_BRANCH_GUARD__ = true;
    function tick() { try { ensureIndentBranchBanner(document); } catch (_) {} }
    if (typeof MutationObserver !== 'undefined' && document.body) new MutationObserver(function () { tick(); }).observe(document.body, { childList: true, subtree: true });
    setInterval(tick, 1500); tick();
  }
  if (typeof root.SDLGCanonicalModel !== 'function') root.SDLGCanonicalModel = localCanonicalModel;
  if (typeof root.SDLGModelsEquivalent !== 'function') root.SDLGModelsEquivalent = modelsEquivalent;
  root.SDLGMasterResolutionUX = Object.freeze({ normalizeModel, canonicalModel, modelsEquivalent, scoreBranchRows, inferUnitStatus, isStockBranchName, pageHasIndentBranchInference, ensureIndentBranchBanner });
  try { installRuntimeIndentBranchGuard(); } catch (_) {}
})(window);

;(function () {
  try {
    if (window.__SDLG_CLAIM_CONTEXT_LOADER_V11__) return;
    window.__SDLG_CLAIM_CONTEXT_LOADER_V11__ = true;
    window.__SDLG_CLAIM_CONTEXT_LOADER__ = true;
    function inject(src) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    }
    inject('./modules/claim-context-resolve.js?v=20261008-v4');
    inject('./modules/sdlg-portal-copy-helper.js?v=20261008-v1.1');
    inject('./modules/sdlg-portal-ux-v2.js?v=20261008-v2');
    inject('./modules/sdlg-portal-enrich.js?v=20261008-v1.1');
    if (/github\.io/i.test(location.host)) {
      var base = (location.pathname.split('/').slice(0, 2).join('/') || '');
      inject(base + '/modules/claim-context-resolve.js?v=20261008-v4');
      inject(base + '/modules/sdlg-portal-copy-helper.js?v=20261008-v1.1');
      inject(base + '/modules/sdlg-portal-ux-v2.js?v=20261008-v2');
      inject(base + '/modules/sdlg-portal-enrich.js?v=20261008-v1.1');
    }
  } catch (e) {
    console.warn('[SDLG] claim-context loader', e);
  }
})();
