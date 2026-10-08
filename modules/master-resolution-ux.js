(function (root) {
  'use strict';

  const MODEL_LOCK_RE = /SOURCE LOCK:\s*Model:\s*source=(["'])((?:(?!\1).)*)\1\s*vs\s*parse=(["'])((?:(?!\3).)*)\3/i;
  const BROAD_BRANCH_FALLBACK_MIN = 10;
  const BRANCH_EVIDENCE_MIN = 70;
  const BRANCH_EVIDENCE_MARGIN = 1.5;
  const INDENT_BRANCH_RE = /Branch diinfer dari histori indent|indent\s*\+\s*model\s*\+\s*customer/i;
  const STOCK_BRANCH_RE = /\bSTOCK\b/i;
  const MODEL_ALIASES = new Map([
    ['SDLG968F', 'L968F'],
    ['968F', 'L968F'],
    ['L968F', 'L968F'],
    ['SDLGG9138F', 'G9138F-LS'],
    ['G9138F', 'G9138F-LS'],
    ['G9138FLS', 'G9138F-LS']
  ]);

  function clean(value) { return value == null ? '' : String(value).replace(/\s+/g, ' ').trim(); }
  function norm(value) { return clean(value).toUpperCase().replace(/[.,']/g, '').replace(/\s+/g, ' '); }
  function normalizeModel(value) { return clean(value).replace(/^SDLG\s+/i, '').replace(/\s+/g, '').toUpperCase(); }

  function localCanonicalModel(value) {
    const normalized = normalizeModel(value);
    return MODEL_ALIASES.get(normalized) || normalized;
  }

  function canonicalModel(value) {
    if (typeof root.SDLGCanonicalModel === 'function' && root.SDLGCore) {
      return root.SDLGCanonicalModel(value);
    }
    return localCanonicalModel(value);
  }

  function modelsEquivalent(a, b) {
    if (typeof root.SDLGModelsEquivalent === 'function' && root.SDLGCore) {
      return root.SDLGModelsEquivalent(a, b);
    }
    const left = localCanonicalModel(a);
    const right = localCanonicalModel(b);
    return Boolean(left && right && left === right);
  }

  function canonicalModelMatch(sourceModel, parsedModel, masterModel) {
    const rawSource = normalizeModel(sourceModel);
    const rawParsed = normalizeModel(parsedModel);
    const source = canonicalModel(sourceModel);
    const parsed = canonicalModel(parsedModel);
    const master = canonicalModel(masterModel);
    return Boolean(
      rawSource && rawParsed && source && parsed && master &&
      modelsEquivalent(source, parsed) && modelsEquivalent(parsed, master) &&
      rawSource !== rawParsed
    );
  }

  function isBenignCanonicalModelLock(sourceOrDocument, parsedModel, masterModel) {
    if (sourceOrDocument && typeof sourceOrDocument.querySelector === 'function') {
      const documentRef = sourceOrDocument;
      const bodyText = documentRef.body ? clean(documentRef.body.innerText || '') : '';
      const match = bodyText.match(MODEL_LOCK_RE);
      if (!match) return false;
      const source = match[2];
      const parsed = match[4];
      const text = documentRef.body ? String(documentRef.body.innerText || '') : '';
      const section = text.match(/MASTER MATCHING([\s\S]{0,1600})/i);
      const lines = section ? section[1].split(/\n+/).map(clean).filter(Boolean) : [];
      const models = [];
      for (let i = 0; i < lines.length - 1; i += 1) if (norm(lines[i]) === 'MODEL') models.push(lines[i + 1]);
      return canonicalModelMatch(source, parsed, models.find((value) => normalizeModel(value) === normalizeModel(parsed)) || '');
    }
    return canonicalModelMatch(sourceOrDocument, parsedModel, masterModel);
  }

  function scoreBranchRows(rows, identity) {
    const byBranch = new Map();
    const seen = new Set();
    const serial = norm(identity?.serial);
    const suffix6 = serial.slice(-6);
    (rows || []).forEach((row) => {
      const branchId = clean(row.branch_id);
      const branch = clean(row.branch);
      if (!branchId || !branch) return;
      const rowSerial = norm(row.serial_no);
      const key = `${rowSerial}|${branchId}`;
      if (seen.has(key)) return;
      seen.add(key);
      let score = 0;
      if (rowSerial && serial && rowSerial === serial) score += 200;
      else if (suffix6 && rowSerial && rowSerial.slice(-6) === suffix6) score += 150;
      if (!score) return;
      const current = byBranch.get(branchId) || { branchId, branch, score: 0, units: 0 };
      current.score += score;
      current.units += 1;
      byBranch.set(branchId, current);
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

  function isStockBranchName(name) {
    return STOCK_BRANCH_RE.test(clean(name));
  }

  function pageHasIndentBranchInference(doc) {
    const el = doc || (typeof document !== 'undefined' ? document : null);
    if (!el || !el.body) return false;
    return INDENT_BRANCH_RE.test(String(el.body.innerText || ''));
  }

  function pageShowsStockUnit(doc) {
    const el = doc || (typeof document !== 'undefined' ? document : null);
    if (!el || !el.body) return false;
    const text = String(el.body.innerText || '');
    if (/unit_status\s*[:=]\s*STOCK/i.test(text)) return true;
    if (/\bUNIT\s+STOCK\b|\bSTATUS\s+UNIT\s*[:：]?\s*STOCK\b/i.test(text)) return true;
    const section = text.match(/MASTER MATCHING([\s\S]{0,2000})/i);
    if (!section) return false;
    const lines = section[1].split(/\n+/).map(clean).filter(Boolean);
    for (let i = 0; i < lines.length - 1; i += 1) {
      if (norm(lines[i]) === 'BRANCH' && isStockBranchName(lines[i + 1])) return true;
    }
    return false;
  }

  function ensureIndentBranchBanner(doc) {
    const el = doc || document;
    if (!el || !el.body) return;
    var id = 'sdlg-indent-branch-guard';
    var existing = el.getElementById(id);
    if (!pageHasIndentBranchInference(el)) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing) return;
    var banner = el.createElement('div');
    banner.id = id;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'position:sticky;top:0;z-index:99998;padding:10px 14px;background:#7c2d12;color:#fff;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    banner.textContent = 'Branch dari tebakan indent diblok. Branch harus ikut UNIT (serial), bukan indent/customer. Pilih cabang manual sebelum simpan.';
    el.body.insertBefore(banner, el.body.firstChild);
  }

  function ensureStockUnitBanner(doc, unitStatus) {
    const el = doc || document;
    if (!el || !el.body) return;
    var id = 'sdlg-stock-unit-banner';
    var existing = el.getElementById(id);
    var status = clean(unitStatus).toUpperCase();
    var show = status === 'STOCK' || pageShowsStockUnit(el);
    if (!show) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing) return;
    var banner = el.createElement('div');
    banner.id = id;
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:sticky;top:0;z-index:99997;padding:10px 14px;background:#1e3a5f;color:#fff;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    banner.textContent = 'Unit ini masih STOCK (belum ada sale date / customer master). Branch otomatis di-set STOCK. Customer dari form akan di-create ke master saat resolve/simpan.';
    el.body.insertBefore(banner, el.body.firstChild);
  }

  function ensureSoldNoBranchHint(doc, ctx) {
    const el = doc || document;
    if (!el || !el.body) return;
    var id = 'sdlg-sold-no-branch-hint';
    var existing = el.getElementById(id);
    var status = inferUnitStatus(ctx || {});
    var branchId = ctx && (ctx.branch_id || ctx.branchId);
    var show = status === 'SOLD' && !branchId;
    if (!show) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing) return;
    var banner = el.createElement('div');
    banner.id = id;
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:sticky;top:0;z-index:99996;padding:10px 14px;background:#854d0e;color:#fff;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    banner.textContent = 'Unit sudah SOLD (ada sale date) tapi branch master masih kosong. Pilih branch operasional manual — sistem tidak menebak cabang dari indent.';
    el.body.insertBefore(banner, el.body.firstChild);
  }

  function applyResolveContextHints(ctx, doc) {
    var status = inferUnitStatus(ctx || {});
    ensureStockUnitBanner(doc, status);
    ensureSoldNoBranchHint(doc, ctx || {});
    ensureIndentBranchBanner(doc);
    return { unitStatus: status };
  }

  function installRuntimeIndentBranchGuard() {
    if (typeof document === 'undefined') return;
    if (root.__SDLG_INDENT_BRANCH_GUARD__) return;
    root.__SDLG_INDENT_BRANCH_GUARD__ = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('button');
      if (!btn) return;
      var label = String(btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!/(simpan|update klaim|update claim|save)/i.test(label)) return;
      if (!pageHasIndentBranchInference(document)) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      ensureIndentBranchBanner(document);
      try { window.alert('Diblok: branch hasil tebakan indent+customer. Pilih branch manual sesuai unit/cabang yang benar, lalu simpan lagi.'); } catch (_) {}
    }, true);
    function tick() {
      try { ensureIndentBranchBanner(document); ensureStockUnitBanner(document, null); } catch (_) {}
    }
    if (typeof MutationObserver !== 'undefined' && document.body) {
      new MutationObserver(function () { tick(); }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    setInterval(tick, 1500);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
    else tick();
  }

  function repair(documentRef) {
    if (!documentRef || !documentRef.body) return Promise.resolve(false);
    ensureIndentBranchBanner(documentRef);
    ensureStockUnitBanner(documentRef, null);
    return Promise.resolve({
      benignCanonicalModelLock: isBenignCanonicalModelLock(documentRef),
      broadBranchFallbackMin: BROAD_BRANCH_FALLBACK_MIN,
      branchEvidenceMin: BRANCH_EVIDENCE_MIN,
      branchEvidenceMargin: BRANCH_EVIDENCE_MARGIN,
      diagnosticOnly: true,
      branchPolicy: 'unit-serial-only',
      indentBranchBlocked: pageHasIndentBranchInference(documentRef),
      stockBanner: pageShowsStockUnit(documentRef)
    });
  }

  if (typeof root.SDLGCanonicalModel !== 'function') root.SDLGCanonicalModel = localCanonicalModel;
  if (typeof root.SDLGModelsEquivalent !== 'function') root.SDLGModelsEquivalent = modelsEquivalent;

  root.SDLGMasterResolutionUX = Object.freeze({
    normalizeModel, canonicalModel, modelsEquivalent, isBenignCanonicalModelLock, canonicalModelMatch,
    scoreBranchRows, repair, pageHasIndentBranchInference, inferUnitStatus, isStockBranchName,
    applyResolveContextHints, ensureStockUnitBanner, ensureSoldNoBranchHint
  });

  try { installRuntimeIndentBranchGuard(); } catch (_) {}
})(window);

;(function () {
  try {
    if (window.__SDLG_CLAIM_CONTEXT_LOADER__) return;
    window.__SDLG_CLAIM_CONTEXT_LOADER__ = true;
    function inject(src) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    }
    inject('./modules/claim-context-resolve.js?v=20261008-v4');
    inject('./modules/sdlg-portal-copy-helper.js?v=20261008-v1');
    if (/github\.io/i.test(location.host)) {
      inject((location.pathname.split('/').slice(0, 2).join('/') || '') + '/modules/claim-context-resolve.js?v=20261008-v4');
      inject((location.pathname.split('/').slice(0, 2).join('/') || '') + '/modules/sdlg-portal-copy-helper.js?v=20261008-v1');
    }
  } catch (e) {
    console.warn('[SDLG] claim-context loader', e);
  }
})();
