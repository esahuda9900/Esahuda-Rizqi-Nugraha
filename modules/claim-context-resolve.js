/**
 * Claim context resolve runtime v1.1.0
 * - resolve_sdlg_claim_context after parse / before save
 * - Auto-create customer when unresolved
 * - Branch typeahead: type name → suggest existing → Enter creates if new
 * - On branch pick: sdlg_resolve_or_create_branch + update machine unit
 * - STOCK / SOLD-no-branch banners via SDLGMasterResolutionUX
 */
(function (root) {
  'use strict';
  if (root.__SDLG_CLAIM_CONTEXT_RESOLVE_V11__) return;
  root.__SDLG_CLAIM_CONTEXT_RESOLVE_V11__ = true;
  root.__SDLG_CLAIM_CONTEXT_RESOLVE_V1__ = true;

  var SUPABASE_URL = 'https://frqvelcreczmnofldrga.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_5TrTvCR8ymE3VNLhthYFMg_vWRRMHMi';
  var client = null;
  var lastCtx = null;
  var branchCache = null;
  var branchCacheAt = 0;

  function getClient() {
    if (client) return client;
    try {
      if (root.supabase && typeof root.supabase.createClient === 'function') {
        client = root.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
      }
    } catch (_) {}
    return client;
  }

  function clean(v) {
    return v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  }

  function pickSerialFromDom() {
    var text = document.body ? String(document.body.innerText || '') : '';
    var m = text.match(/\b(VLG[A-Z0-9]{8,})\b/i);
    if (m) return m[1].toUpperCase();
    m = text.match(/Serial No\.?\s*([A-Z0-9]{6,})/i);
    if (m) return m[1].toUpperCase();
    m = text.match(/SN:\s*(VLG[A-Z0-9]{6,}|[A-Z0-9]{8,})/i);
    if (m) return m[1].toUpperCase();
    m = text.match(/MACHINE\s*\n\s*(VLG[A-Z0-9]{6,})/i);
    return m ? m[1].toUpperCase() : '';
  }

  function pickCustomerFromDom() {
    var text = document.body ? String(document.body.innerText || '') : '';
    var m = text.match(/\nCustomer\n([^\n]+)/i);
    if (m) return clean(m[1]);
    m = text.match(/Customer Name\s+([^\n\t]+)/i);
    if (m) return clean(m[1]);
    return '';
  }

  async function resolveContext(source) {
    var c = getClient();
    if (!c || typeof c.rpc !== 'function') return null;
    try {
      var res = await c.rpc('resolve_sdlg_claim_context', { p_source: source || {} });
      if (res && res.error) {
        console.warn('[SDLG claim-context]', res.error);
        return null;
      }
      var data = res && res.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_) {}
      }
      lastCtx = data && typeof data === 'object' ? data : null;
      root.__SDLG_LAST_RESOLVE_CONTEXT__ = lastCtx;
      return lastCtx;
    } catch (err) {
      console.warn('[SDLG claim-context]', err);
      return null;
    }
  }

  async function ensureCustomer(name) {
    var c = getClient();
    if (!c || !name) return null;
    try {
      var res = await c.rpc('sdlg_resolve_or_create_customer', {
        p_name: name,
        p_account: null
      });
      if (res && res.error) {
        console.warn('[SDLG customer resolve]', res.error);
        return null;
      }
      return res ? res.data : null;
    } catch (err) {
      console.warn('[SDLG customer resolve]', err);
      return null;
    }
  }

  async function loadBranches(force) {
    var now = Date.now();
    if (!force && branchCache && (now - branchCacheAt) < 60000) return branchCache;
    var c = getClient();
    if (!c) return branchCache || [];
    try {
      var res = await c.from('branches')
        .select('id, branch_name, branch_code')
        .eq('is_active', true)
        .order('branch_name');
      if (res && !res.error && Array.isArray(res.data)) {
        branchCache = res.data;
        branchCacheAt = now;
      }
    } catch (err) {
      console.warn('[SDLG branches]', err);
    }
    return branchCache || [];
  }

  async function resolveOrCreateBranch(name, serial) {
    var c = getClient();
    if (!c || !name) return null;
    try {
      var res = await c.rpc('sdlg_resolve_or_create_branch', {
        p_name: name,
        p_serial: serial || null
      });
      if (res && res.error) {
        console.warn('[SDLG branch resolve]', res.error);
        return null;
      }
      var data = res && res.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_) {}
      }
      if (data && data.ok) {
        branchCache = null;
        return data;
      }
      return data;
    } catch (err) {
      console.warn('[SDLG branch resolve]', err);
      return null;
    }
  }

  function applyBanners(ctx) {
    try {
      if (root.SDLGMasterResolutionUX && typeof root.SDLGMasterResolutionUX.applyResolveContextHints === 'function') {
        root.SDLGMasterResolutionUX.applyResolveContextHints(ctx || {}, document);
      }
    } catch (_) {}
  }

  function styleChip(el, bg, color) {
    el.style.background = bg;
    el.style.color = color;
    el.style.borderRadius = '8px';
    el.style.padding = '4px 8px';
  }

  function setChipValue(el, value) {
    var lines = el.querySelectorAll('div');
    if (lines.length >= 2) {
      lines[1].textContent = value;
    } else {
      var kids = el.childNodes;
      var replaced = false;
      for (var i = kids.length - 1; i >= 0; i--) {
        if (kids[i].nodeType === 3 && clean(kids[i].textContent)) {
          kids[i].textContent = ' ' + value;
          replaced = true;
          break;
        }
      }
      if (!replaced) el.appendChild(document.createTextNode(' → ' + value));
    }
  }

  function findMasterSection() {
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      if (/MASTER MATCHING/i.test(nodes[i].textContent || '') && (nodes[i].textContent || '').length < 1200) {
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

    if (ctx.customer_id && ctx.customer_name) {
      section.querySelectorAll('div').forEach(function (el) {
        var t = clean(el.textContent);
        if (!/^CUSTOMER/i.test(t)) return;
        if (/Source only|Tidak match|kandidat/i.test(t) || t.length < 80) {
          styleChip(el, '#dcfce7', '#166534');
          setChipValue(el, ctx.customer_name);
        }
      });
    }

    section.querySelectorAll('div').forEach(function (el) {
      var t = clean(el.textContent);
      if (!/^BRANCH/i.test(t)) return;
      if (ctx.branch_id && ctx.branch_name) {
        styleChip(el, '#dcfce7', '#166534');
        setChipValue(el, ctx.branch_name);
        return;
      }
      if (unitStatus === 'SOLD' || (ctx.machine_sale_date || ctx.sale_date)) {
        styleChip(el, '#fef3c7', '#92400e');
        setChipValue(el, 'SOLD · pilih manual');
        return;
      }
      if (unitStatus === 'STOCK') {
        styleChip(el, '#dbeafe', '#1e3a5f');
        setChipValue(el, 'STOCK');
      }
    });

    ensureBranchPicker(section, ctx);
    applyBanners(ctx);
  }

  function ensureBranchPicker(section, ctx) {
    if (!section || !document.body) return;
    var existing = document.getElementById('sdlg-branch-typeahead');
    if (existing) {
      var status = existing.querySelector('[data-sdlg-branch-status]');
      if (status && ctx && ctx.branch_name) {
        status.textContent = 'Terpilih: ' + ctx.branch_name + (ctx.branch_created ? ' (baru)' : '');
        status.style.color = '#166534';
      }
      return;
    }

    var wrap = document.createElement('div');
    wrap.id = 'sdlg-branch-typeahead';
    wrap.setAttribute('data-sdlg-branch-picker', '1');
    wrap.style.cssText = 'margin:10px 0 14px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;font:13px/1.4 system-ui,sans-serif;max-width:420px;position:relative;z-index:20';

    var label = document.createElement('div');
    label.style.cssText = 'font-weight:700;color:#0f172a;margin-bottom:6px';
    label.textContent = 'Branch — ketik nama cabang';
    wrap.appendChild(label);

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:8px';
    hint.textContent = 'Rekomendasi dari master. Enter / pilih list → pakai cabang itu. Nama baru → otomatis ditambah & unit di-update.';
    wrap.appendChild(hint);

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Contoh: DENPASAR, BALI, SURABAYA…';
    input.autocomplete = 'off';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font:14px system-ui,sans-serif;outline:none';
    if (ctx && ctx.branch_name) input.value = ctx.branch_name;
    wrap.appendChild(input);

    var list = document.createElement('div');
    list.style.cssText = 'display:none;position:absolute;left:14px;right:14px;top:100%;margin-top:-4px;max-height:220px;overflow:auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.12);z-index:50';
    wrap.appendChild(list);

    var status = document.createElement('div');
    status.setAttribute('data-sdlg-branch-status', '1');
    status.style.cssText = 'margin-top:8px;font-size:12px;color:#64748b;min-height:16px';
    if (ctx && ctx.branch_name) {
      status.textContent = 'Terpilih: ' + ctx.branch_name;
      status.style.color = '#166534';
    }
    wrap.appendChild(status);

    var anchor = null;
    var kids = section.children;
    for (var i = 0; i < kids.length; i++) {
      if (/MASTER MATCHING/i.test(kids[i].textContent || '')) {
        anchor = kids[i];
        break;
      }
    }
    if (anchor && anchor.parentNode) {
      if (anchor.nextSibling) anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      else anchor.parentNode.appendChild(wrap);
    } else {
      section.insertBefore(wrap, section.firstChild);
    }

    var activeIdx = -1;
    var currentItems = [];

    function hideList() {
      list.style.display = 'none';
      list.innerHTML = '';
      activeIdx = -1;
      currentItems = [];
    }

    function renderList(items, query) {
      currentItems = items;
      list.innerHTML = '';
      if (!items.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:10px 12px;color:#64748b;font-size:13px';
        empty.textContent = query
          ? 'Tidak ada match. Tekan Enter untuk buat cabang baru: “' + query + '”'
          : 'Ketik untuk mencari…';
        list.appendChild(empty);
        list.style.display = 'block';
        return;
      }
      items.forEach(function (b, idx) {
        var row = document.createElement('div');
        row.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:13px;color:#0f172a';
        row.textContent = b.branch_name + (b.branch_code ? ' (' + b.branch_code + ')' : '');
        row.onmouseenter = function () {
          activeIdx = idx;
          highlight();
        };
        row.onmousedown = function (e) {
          e.preventDefault();
          pickBranch(b.branch_name);
        };
        list.appendChild(row);
      });
      var q = clean(query);
      var exact = items.some(function (b) {
        return clean(b.branch_name).toUpperCase() === q.toUpperCase();
      });
      if (q && !exact) {
        var create = document.createElement('div');
        create.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:13px;color:#1d4ed8;border-top:1px solid #e2e8f0;font-weight:600';
        create.textContent = '+ Buat cabang baru: “' + q + '”';
        create.onmousedown = function (e) {
          e.preventDefault();
          pickBranch(q);
        };
        list.appendChild(create);
      }
      list.style.display = 'block';
      activeIdx = 0;
      highlight();
    }

    function highlight() {
      var rows = list.querySelectorAll('div');
      rows.forEach(function (r, i) {
        r.style.background = i === activeIdx ? '#e0f2fe' : '';
      });
    }

    async function filterAndShow(q) {
      var all = await loadBranches(false);
      var nq = clean(q).toUpperCase();
      var filtered = !nq
        ? all.slice(0, 12)
        : all.filter(function (b) {
            var name = clean(b.branch_name).toUpperCase();
            var code = clean(b.branch_code).toUpperCase();
            return name.indexOf(nq) >= 0 || code.indexOf(nq) >= 0;
          }).slice(0, 12);
      renderList(filtered, q);
    }

    async function pickBranch(name) {
      var n = clean(name);
      if (!n) return;
      status.textContent = 'Menyimpan…';
      status.style.color = '#64748b';
      input.value = n;
      hideList();
      var serial = pickSerialFromDom() || (lastCtx && lastCtx.machine_serial_no) || '';
      var result = await resolveOrCreateBranch(n, serial);
      if (!result || !result.ok) {
        status.textContent = 'Gagal simpan branch (cek login admin / jaringan).';
        status.style.color = '#b91c1c';
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
          var t = clean(el.textContent);
          if (!/^BRANCH/i.test(t)) return;
          styleChip(el, '#dcfce7', '#166534');
          setChipValue(el, result.branch_name);
        });
      }

      var msg = 'Terpilih: ' + result.branch_name;
      if (result.created) msg += ' (cabang baru)';
      if (result.machine_updated) msg += ' · unit di-update';
      status.textContent = msg;
      status.style.color = '#166534';
      applyBanners(lastCtx);
    }

    input.addEventListener('focus', function () {
      filterAndShow(input.value);
      loadBranches(false);
    });
    input.addEventListener('input', function () {
      filterAndShow(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentItems.length) {
          activeIdx = Math.min(activeIdx + 1, currentItems.length - 1);
          highlight();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentItems.length) {
          activeIdx = Math.max(activeIdx - 1, 0);
          highlight();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && currentItems[activeIdx]) {
          pickBranch(currentItems[activeIdx].branch_name);
        } else if (clean(input.value)) {
          pickBranch(input.value);
        }
      } else if (e.key === 'Escape') {
        hideList();
      }
    });
    input.addEventListener('blur', function () {
      setTimeout(hideList, 180);
    });

    loadBranches(false);
  }

  async function runResolveFromPage() {
    var serial = pickSerialFromDom();
    var customer = pickCustomerFromDom();
    if (!serial && !customer) return null;
    var ctx = await resolveContext({
      serial_no: serial || null,
      customer: customer || null,
      customer_name: customer || null
    });
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

  function isParseButton(btn) {
    if (!btn) return false;
    var label = clean(btn.textContent).toLowerCase();
    return /parse input|\u2728 parse|parse/.test(label) && label.length < 40;
  }

  function isSaveButton(btn) {
    if (!btn) return false;
    var label = clean(btn.textContent).toLowerCase();
    return /simpan ke supabase|simpan|save claim|update klaim/.test(label);
  }

  function installHooks() {
    if (root.__SDLG_CLAIM_CONTEXT_HOOKS_V11__) return;
    root.__SDLG_CLAIM_CONTEXT_HOOKS_V11__ = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('button');
      if (!btn) return;
      if (isParseButton(btn)) {
        setTimeout(function () { runResolveFromPage(); }, 900);
        setTimeout(function () { runResolveFromPage(); }, 2200);
        setTimeout(function () { runResolveFromPage(); }, 4000);
      }
      if (isSaveButton(btn)) runResolveFromPage();
    }, true);
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var timer = null;
      var obs = new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var body = document.body ? document.body.innerText : '';
          if (/MASTER MATCHING/i.test(body) && !document.getElementById('sdlg-branch-typeahead')) {
            runResolveFromPage();
          }
        }, 500);
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

  function patchClientRpc(c) {
    if (!c || typeof c.rpc !== 'function' || c.__sdlgResolvePatched) return c;
    var orig = c.rpc.bind(c);
    c.rpc = async function (fn, args) {
      if ((fn === 'create_sdlg_claim' || fn === 'update_sdlg_claim') && args && args.p_claim) {
        try {
          args.p_claim = await enrichClaimPayload(args.p_claim);
        } catch (err) {
          console.warn('[SDLG claim-context save patch]', err);
        }
      }
      return orig(fn, args);
    };
    c.__sdlgResolvePatched = true;
    return c;
  }

  function installRpcPatch() {
    try {
      if (root.supabase && typeof root.supabase.createClient === 'function' && !root.supabase.__sdlgCreatePatched) {
        var origCreate = root.supabase.createClient.bind(root.supabase);
        root.supabase.createClient = function () {
          var c = origCreate.apply(root.supabase, arguments);
          return patchClientRpc(c);
        };
        root.supabase.__sdlgCreatePatched = true;
      }
    } catch (_) {}
    patchClientRpc(getClient());
  }

  function boot() {
    installHooks();
    var tries = 0;
    (function wait() {
      tries += 1;
      installRpcPatch();
      if (tries < 40) setTimeout(wait, 250);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  root.SDLGClaimContextResolve = {
    version: '1.1.0',
    resolve: resolveContext,
    ensureCustomer: ensureCustomer,
    resolveOrCreateBranch: resolveOrCreateBranch,
    loadBranches: loadBranches,
    runFromPage: runResolveFromPage,
    getLastContext: function () { return lastCtx; }
  };
})(window);
