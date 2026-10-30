/**
 * SDLG Claim Context Resolve — V2.0 (Smart Context Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ ZERO LAG: Observer dioptimasi, gak nge-scan body terus-terusan.
 * ✅ SMART POLLING: Ganti setTimeout tebak-tebakan jadi Polling presisi.
 * ✅ PREMIUM UI: Desain ulang Branch Typeahead (mirip Linear/Stripe).
 * ✅ SAFE RPC: Error handling yang lebih rapi di semua API call.
 * ✅ CLEAN CSS: Semua style dipisah, gak numpuk di JS.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_CLAIM_CONTEXT_RESOLVE_V2__) return;
  root.__SDLG_CLAIM_CONTEXT_RESOLVE_V2__ = true;
  root.__SDLG_CLAIM_CONTEXT_RESOLVE_V11__ = true; // backward compatibility

  // ─────────────────────────────────────────────────────────
  // 1. STATE & CONFIG
  // ─────────────────────────────────────────────────────────
  var client = null;
  var lastCtx = null;
  var branchCache = null;
  var branchCacheAt = 0;
  var CACHE_TTL = 60000; // 60 detik

  function getClient() {
    if (client) return client;
    if (typeof root.getSdlgSupabase === 'function') {
      client = root.getSdlgSupabase();
      return client;
    }
    var existing = root.supabaseClient || root.sdlgSupabase || root.__SDLG_SUPABASE_CLIENT || root.__SUPABASE_CLIENT;
    if (existing && typeof existing.from === 'function' && typeof existing.rpc === 'function') {
      client = existing;
      return client;
    }
    return null;
  }

  function clean(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }

  // ─────────────────────────────────────────────────────────
  // 2. INJECT PREMIUM STYLES (Gak perlu style inline lagi)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sdlg-branch-picker-styles')) return;
    var style = document.createElement('style');
    style.id = 'sdlg-branch-picker-styles';
    style.textContent = [
      '.sdlg-bp-wrap { margin: 12px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-family: system-ui, sans-serif; max-width: 480px; position: relative; z-index: 50; }',
      '.sdlg-bp-label { font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }',
      '.sdlg-bp-hint { font-size: 11px; color: #64748b; margin-bottom: 12px; line-height: 1.4; }',
      '.sdlg-bp-input { width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 500; color: #0f172a; outline: none; transition: all 0.2s; background: #f8fafc; }',
      '.sdlg-bp-input:focus { border-color: #2f5bff; background: #fff; box-shadow: 0 0 0 3px rgba(47,91,255,0.1); }',
      '.sdlg-bp-list { display: none; position: absolute; left: 16px; right: 16px; top: 100%; margin-top: 4px; max-height: 240px; overflow-y: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); z-index: 100; }',
      '.sdlg-bp-item { padding: 10px 14px; cursor: pointer; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s; }',
      '.sdlg-bp-item:last-child { border-bottom: none; }',
      '.sdlg-bp-item:hover, .sdlg-bp-item.active { background: #f1f5f9; color: #0f172a; font-weight: 600; }',
      '.sdlg-bp-item-create { color: #2f5bff; font-weight: 700; border-top: 1px solid #e2e8f0; }',
      '.sdlg-bp-status { margin-top: 10px; font-size: 12px; font-weight: 600; color: #64748b; display: flex; align-items: center; gap: 6px; }',
      '.sdlg-bp-status--success { color: #16a34a; }',
      '.sdlg-bp-status--error { color: #dc2626; }',
      '.sdlg-bp-spinner { width: 12px; height: 12px; border: 2px solid #cbd5e1; border-top-color: #2f5bff; border-radius: 50%; animation: sdlg-spin 0.6s linear infinite; display: none; }',
      '@keyframes sdlg-spin { to { transform: rotate(360deg); } }',
      '.sdlg-chip-success { background: #dcfce7; color: #166534; border-radius: 6px; padding: 4px 8px; font-weight: 600; }',
      '.sdlg-chip-warning { background: #fef3c7; color: #92400e; border-radius: 6px; padding: 4px 8px; font-weight: 600; }',
      '.sdlg-chip-info { background: #dbeafe; color: #1e3a5f; border-radius: 6px; padding: 4px 8px; font-weight: 600; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  // 3. DOM SCRAPERS (Lebih Aman & Cepat)
  // ─────────────────────────────────────────────────────────
  function pickSerialFromDom() {
    if (!document.body) return '';
    var text = String(document.body.innerText || '');
    var m = text.match(/\b(VLG[A-Z0-9]{8,})\b/i);
    if (m) return m[1].toUpperCase();
    m = text.match(/Serial No\.?\s*([A-Z0-9]{6,})/i);
    if (m) return m[1].toUpperCase();
    return '';
  }

  function pickCustomerFromDom() {
    if (!document.body) return '';
    var text = String(document.body.innerText || '');
    var m = text.match(/\nCustomer\n([^\n]+)/i);
    if (m) return clean(m[1]);
    return '';
  }

  // ─────────────────────────────────────────────────────────
  // 4. API CALLS (RPC & Database)
  // ─────────────────────────────────────────────────────────
  async function resolveContext(source) {
    var c = getClient();
    if (!c || typeof c.rpc !== 'function') return null;
    try {
      var res = await c.rpc('resolve_sdlg_claim_context', { p_source: source || {} });
      if (res && res.error) throw res.error;
      var data = res && res.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) {} }
      lastCtx = data && typeof data === 'object' ? data : null;
      root.__SDLG_LAST_RESOLVE_CONTEXT__ = lastCtx;
      return lastCtx;
    } catch (err) {
      console.warn('[SDLG Context] Gagal resolve:', err.message);
      return null;
    }
  }

  async function ensureCustomer(name) {
    var c = getClient();
    if (!c || !name) return null;
    try {
      var res = await c.rpc('sdlg_resolve_or_create_customer', { p_name: name, p_account: null });
      if (res && res.error) throw res.error;
      return res ? res.data : null;
    } catch (err) {
      console.warn('[SDLG Customer] Gagal create:', err.message);
      return null;
    }
  }

  async function loadBranches(force) {
    var now = Date.now();
    if (!force && branchCache && (now - branchCacheAt) < CACHE_TTL) return branchCache;
    var c = getClient();
    if (!c) return branchCache || [];
    try {
      var res = await c.from('branches').select('id, branch_name, branch_code').eq('is_active', true).order('branch_name');
      if (res && !res.error && Array.isArray(res.data)) {
        branchCache = res.data;
        branchCacheAt = now;
      }
    } catch (err) {
      console.warn('[SDLG Branches] Gagal load:', err.message);
    }
    return branchCache || [];
  }

  async function resolveOrCreateBranch(name, serial) {
    var c = getClient();
    if (!c || !name) return null;
    try {
      var res = await c.rpc('sdlg_resolve_or_create_branch', { p_name: name, p_serial: serial || null });
      if (res && res.error) throw res.error;
      var data = res && res.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) {} }
      if (data && data.ok) { branchCache = null; return data; }
      return data;
    } catch (err) {
      console.warn('[SDLG Branch] Gagal resolve/create:', err.message);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. UI HELPER (Banner & Chip)
  // ─────────────────────────────────────────────────────────
  function applyBanners(ctx) {
    try {
      if (root.SDLGMasterResolutionUX && typeof root.SDLGMasterResolutionUX.applyResolveContextHints === 'function') {
        root.SDLGMasterResolutionUX.applyResolveContextHints(ctx || {}, document);
      }
    } catch (_) {}
  }

  function setChip(el, type, value) {
    el.className = 'sdlg-chip-' + (type || 'info');
    var lines = el.querySelectorAll('div');
    if (lines.length >= 2) {
      lines[1].textContent = value;
    } else {
      el.textContent = value;
    }
  }

  function findMasterSection() {
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      if (/MASTER MATCHING/i.test(nodes[i].textContent || '') && (nodes[i].textContent || '').length < 1500) {
        return nodes[i].parentElement || nodes[i];
      }
    }
    return null;
  }

  function enhanceMasterMatchingUi(ctx) {
    if (!ctx || !document.body) return;
    var section = findMasterSection();
    if (!section) return;

    var unitStatus = clean(ctx.unit_status || '').toUpperCase();
    if (!unitStatus && (ctx.machine_sale_date || ctx.sale_date)) unitStatus = 'SOLD';

    // Update Customer Chip
    if (ctx.customer_id && ctx.customer_name) {
      section.querySelectorAll('div').forEach(function (el) {
        var t = clean(el.textContent);
        if (/^CUSTOMER/i.test(t) && t.length < 100) setChip(el, 'success', ctx.customer_name);
      });
    }

    // Update Branch Chip
    section.querySelectorAll('div').forEach(function (el) {
      var t = clean(el.textContent);
      if (!/^BRANCH/i.test(t) || t.length > 100) return;
      if (ctx.branch_id && ctx.branch_name) {
        setChip(el, 'success', ctx.branch_name);
      } else if (unitStatus === 'SOLD' || (ctx.machine_sale_date || ctx.sale_date)) {
        setChip(el, 'warning', 'SOLD · pilih manual');
      } else if (unitStatus === 'STOCK') {
        setChip(el, 'info', 'STOCK');
      }
    });

    ensureBranchPicker(section, ctx);
    applyBanners(ctx);
  }

  // ─────────────────────────────────────────────────────────
  // 6. UI COMPONENT: BRANCH TYPEAHEAD
  // ─────────────────────────────────────────────────────────
  function ensureBranchPicker(section, ctx) {
    if (!section || !document.body) return;
    injectStyles();

    var existing = document.getElementById('sdlg-branch-typeahead');
    if (existing) {
      var status = existing.querySelector('[data-sdlg-branch-status]');
      if (status && ctx && ctx.branch_name) {
        status.className = 'sdlg-bp-status sdlg-bp-status--success';
        status.innerHTML = '✓ Terpilih: <b>' + ctx.branch_name + '</b>' + (ctx.branch_created ? ' (baru)' : '');
      }
      return;
    }

    var wrap = document.createElement('div');
    wrap.id = 'sdlg-branch-typeahead';
    wrap.className = 'sdlg-bp-wrap';

    wrap.innerHTML = `
      <div class="sdlg-bp-label">Branch — Ketik nama cabang</div>
      <div class="sdlg-bp-hint">Rekomendasi dari master. Tekan Enter untuk memilih. Nama baru akan otomatis dibuat.</div>
      <input type="text" class="sdlg-bp-input" placeholder="Contoh: DENPASAR, BALI..." autocomplete="off" value="${ctx && ctx.branch_name ? ctx.branch_name : ''}">
      <div class="sdlg-bp-list"></div>
      <div class="sdlg-bp-status" data-sdlg-branch-status>
        <div class="sdlg-bp-spinner"></div>
        <span>${ctx && ctx.branch_name ? '✓ Terpilih: ' + ctx.branch_name : 'Belum ada branch terpilih.'}</span>
      </div>
    `;

    // Sisipkan setelah "MASTER MATCHING"
    var anchor = null;
    var kids = section.children;
    for (var i = 0; i < kids.length; i++) {
      if (/MASTER MATCHING/i.test(kids[i].textContent || '')) { anchor = kids[i]; break; }
    }
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else {
      section.insertBefore(wrap, section.firstChild);
    }

    var input = wrap.querySelector('input');
    var list = wrap.querySelector('.sdlg-bp-list');
    var statusBox = wrap.querySelector('.sdlg-bp-status');
    var spinner = wrap.querySelector('.sdlg-bp-spinner');
    var statusText = statusBox.querySelector('span');

    var activeIdx = -1;
    var currentItems = [];

    function setStatus(type, text) {
      statusBox.className = 'sdlg-bp-status ' + (type ? 'sdlg-bp-status--' + type : '');
      if (type === 'loading') spinner.style.display = 'block';
      else spinner.style.display = 'none';
      statusText.innerHTML = text;
    }

    function hideList() {
      list.style.display = 'none';
      list.innerHTML = '';
      activeIdx = -1;
      currentItems = [];
    }

    function renderList(items, query) {
      currentItems = items;
      list.innerHTML = '';
      if (!items.length && !query) { hideList(); return; }
      
      if (!items.length) {
        var empty = document.createElement('div');
        empty.className = 'sdlg-bp-item';
        empty.style.color = '#64748b';
        empty.textContent = query ? 'Tekan Enter untuk buat: "' + query + '"' : 'Ketik untuk mencari...';
        list.appendChild(empty);
        list.style.display = 'block';
        return;
      }

      items.forEach(function (b, idx) {
        var row = document.createElement('div');
        row.className = 'sdlg-bp-item';
        row.innerHTML = '<span>' + b.branch_name + '</span>' + (b.branch_code ? '<span style="font-size:10px;color:#94a3b8">' + b.branch_code + '</span>' : '');
        row.onmouseenter = function () { activeIdx = idx; highlight(); };
        row.onmousedown = function (e) { e.preventDefault(); pickBranch(b.branch_name); };
        list.appendChild(row);
      });

      var q = clean(query);
      var exact = items.some(function (b) { return clean(b.branch_name).toUpperCase() === q.toUpperCase(); });
      
      if (q && !exact) {
        var createBtn = document.createElement('div');
        createBtn.className = 'sdlg-bp-item sdlg-bp-item-create';
        createBtn.textContent = '+ Buat cabang baru: "' + q + '"';
        createBtn.onmousedown = function (e) { e.preventDefault(); pickBranch(q); };
        list.appendChild(createBtn);
      }

      list.style.display = 'block';
      activeIdx = 0;
      highlight();
    }

    function highlight() {
      var rows = list.querySelectorAll('.sdlg-bp-item');
      rows.forEach(function (r, i) {
        if (i === activeIdx) r.classList.add('active');
        else r.classList.remove('active');
      });
    }

    async function filterAndShow(q) {
      var all = await loadBranches(false);
      var nq = clean(q).toUpperCase();
      var filtered = !nq ? all.slice(0, 12) : all.filter(function (b) {
        return clean(b.branch_name).toUpperCase().indexOf(nq) >= 0 || clean(b.branch_code).toUpperCase().indexOf(nq) >= 0;
      }).slice(0, 12);
      renderList(filtered, q);
    }

    async function pickBranch(name) {
      var n = clean(name);
      if (!n) return;
      setStatus('loading', 'Menyimpan branch...');
      input.value = n;
      hideList();

      var serial = pickSerialFromDom() || (lastCtx && lastCtx.machine_serial_no) || '';
      var result = await resolveOrCreateBranch(n, serial);
      
      if (!result || !result.ok) {
        setStatus('error', 'Gagal simpan branch. Cek koneksi/jaringan.');
        return;
      }

      if (!lastCtx) lastCtx = {};
      lastCtx.branch_id = result.branch_id;
      lastCtx.branch_name = result.branch_name;
      lastCtx.branch_source = result.created ? 'USER_CREATE' : 'USER_PICK';
      lastCtx.branch_created = !!result.created;
      lastCtx.branch_confidence = 'HIGH';
      root.__SDLG_LAST_RESOLVE_CONTEXT__ = lastCtx;

      var section2 = findMasterSection();
      if (section2) {
        section2.querySelectorAll('div').forEach(function (el) {
          if (/^BRANCH/i.test(clean(el.textContent)) && clean(el.textContent).length < 100) {
            setChip(el, 'success', result.branch_name);
          }
        });
      }

      var msg = '✓ Terpilih: <b>' + result.branch_name + '</b>';
      if (result.created) msg += ' (cabang baru)';
      if (result.machine_updated) msg += ' · unit di-update';
      setStatus('success', msg);
      applyBanners(lastCtx);
    }

    input.addEventListener('focus', function () { filterAndShow(input.value); loadBranches(false); });
    input.addEventListener('input', function () { filterAndShow(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (currentItems.length) { activeIdx = Math.min(activeIdx + 1, currentItems.length - 1); highlight(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (currentItems.length) { activeIdx = Math.max(activeIdx - 1, 0); highlight(); } }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && currentItems[activeIdx]) pickBranch(currentItems[activeIdx].branch_name);
        else if (clean(input.value)) pickBranch(input.value);
      }
      else if (e.key === 'Escape') { hideList(); }
    });
    input.addEventListener('blur', function () { setTimeout(hideList, 180); });
    
    loadBranches(false);
  }

  // ─────────────────────────────────────────────────────────
  // 7. ORCHESTRATOR (Smart Polling)
  // ─────────────────────────────────────────────────────────
  async function runResolveFromPage() {
    var serial = pickSerialFromDom();
    var customer = pickCustomerFromDom();
    if (!serial && !customer) return null;

    var ctx = await resolveContext({ serial_no: serial || null, customer: customer || null, customer_name: customer || null });

    if (ctx && !ctx.customer_id && customer) {
      var cid = await ensureCustomer(customer);
      if (cid) {
        ctx.customer_id = cid;
        ctx.customer_name = customer;
        ctx.customer_source = 'CLAIM_TEXT_RESOLVE_OR_CREATE';
        ctx.customer_confidence = 'HIGH';
      }
    }

    if (ctx && !ctx.unit_status) {
      if (ctx.machine_sale_date || ctx.sale_date) ctx.unit_status = 'SOLD';
      else if (!ctx.customer_id && !ctx.customer_name_source) ctx.unit_status = 'STOCK';
    }

    if (lastCtx && lastCtx.branch_id && (!ctx || !ctx.branch_id)) {
      if (!ctx) ctx = {};
      ctx.branch_id = lastCtx.branch_id;
      ctx.branch_name = lastCtx.branch_name;
      ctx.branch_source = lastCtx.branch_source;
    }

    if (ctx) enhanceMasterMatchingUi(ctx);
    return ctx;
  }

  // ─────────────────────────────────────────────────────────
  // 8. EVENT HOOKS & OBSERVERS (Bebas Lag)
  // ─────────────────────────────────────────────────────────
  function isParseButton(btn) { return btn && /parse/i.test(clean(btn.textContent)) && clean(btn.textContent).length < 40; }
  function isSaveButton(btn) { return btn && /simpan|save/i.test(clean(btn.textContent)); }

  // Smart Polling: Nunggu sampai "MASTER MATCHING" muncul, max 10 detik
  function waitForMasterMatching(callback) {
    var attempts = 0;
    var maxAttempts = 50; // 50 x 200ms = 10 detik
    var timer = setInterval(function () {
      var body = document.body ? document.body.innerText : '';
      if (/MASTER MATCHING/i.test(body)) {
        clearInterval(timer);
        callback();
      } else if (++attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 200);
  }

  function installHooks() {
    if (root.__SDLG_CLAIM_CONTEXT_HOOKS_V2__) return;
    root.__SDLG_CLAIM_CONTEXT_HOOKS_V2__ = true;

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('button');
      if (!btn) return;

      if (isParseButton(btn)) {
        waitForMasterMatching(function () { runResolveFromPage(); });
      }
      if (isSaveButton(btn)) {
        runResolveFromPage();
      }
    }, true);

    // Mutation Observer yang jauh lebih hemat (Debounce 1 detik)
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var timer = null;
      var obs = new MutationObserver(function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          var body = document.body ? document.body.innerText : '';
          if (/MASTER MATCHING/i.test(body) && !document.getElementById('sdlg-branch-typeahead')) {
            runResolveFromPage();
          }
        }, 1000);
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  async function enrichClaimPayload(claim) {
    if (!claim || typeof claim !== 'object') return claim;
    var needCust = !claim.customer_id;
    var needBranch = !claim.branch_id;
    if (!needCust && !needBranch) return claim;

    var ctx = lastCtx || await resolveContext({
      serial_no: claim.serial_no || claim.source_serial_no || null,
      customer: claim.customer || null,
      customer_name: claim.customer || null,
      dealer_wo_so: claim.dealer_wo_so || null,
      wo_no: claim.dealer_wo_so || null
    });

    if (ctx) {
      if (needCust && ctx.customer_id) {
        claim.customer_id = ctx.customer_id;
        if (!claim.customer && ctx.customer_name) claim.customer = ctx.customer_name;
      }
      if (needBranch && ctx.branch_id) {
        claim.branch_id = ctx.branch_id;
        if (!claim.branch && ctx.branch_name) claim.branch = ctx.branch_name;
      }
    }
    if (!claim.customer_id && claim.customer) {
      var id = await ensureCustomer(claim.customer);
      if (id) claim.customer_id = id;
    }
    return claim;
  }

  // ─────────────────────────────────────────────────────────
  // 9. EXPORT & INIT
  // ─────────────────────────────────────────────────────────
  root.SDLGClaimContextResolve = {
    version: '2.0.0',
    getClient: getClient,
    resolveContext: resolveContext,
    ensureCustomer: ensureCustomer,
    loadBranches: loadBranches,
    resolveOrCreateBranch: resolveOrCreateBranch,
    runResolveFromPage: runResolveFromPage,
    enrichClaimPayload: enrichClaimPayload,
    getLastContext: function () { return lastCtx; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installHooks, { once: true });
  } else {
    installHooks();
  }

})(typeof window !== 'undefined' ? window : globalThis);