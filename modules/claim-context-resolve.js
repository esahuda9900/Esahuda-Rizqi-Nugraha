/**
 * Claim context resolve runtime v1.0.1
 * - After parse / before save: call resolve_sdlg_claim_context
 * - Auto-create customer via sdlg_resolve_or_create_customer when still unresolved
 * - Surface STOCK / SOLD-no-branch banners via SDLGMasterResolutionUX
 * - Annotate MASTER MATCHING chips (customer / branch STOCK / SOLD·manual)
 */
(function (root) {
  'use strict';
  if (root.__SDLG_CLAIM_CONTEXT_RESOLVE_V1__) return;
  root.__SDLG_CLAIM_CONTEXT_RESOLVE_V1__ = true;

  var SUPABASE_URL = 'https://frqvelcreczmnofldrga.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_5TrTvCR8ymE3VNLhthYFMg_vWRRMHMi';
  var client = null;
  var lastCtx = null;

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
    m = text.match(/HASIL PARSE[\s\S]{0,400}?([A-Z][A-Z0-9 .,'-]{8,60})\s*\n/i);
    return m ? clean(m[1]) : '';
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

  function enhanceMasterMatchingUi(ctx) {
    if (!ctx || !document.body) return;
    var section = null;
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      if (/MASTER MATCHING/i.test(nodes[i].textContent || '') && (nodes[i].textContent || '').length < 1200) {
        section = nodes[i].parentElement || nodes[i];
        break;
      }
    }
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

    applyBanners(ctx);
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
    if (root.__SDLG_CLAIM_CONTEXT_HOOKS__) return;
    root.__SDLG_CLAIM_CONTEXT_HOOKS__ = true;
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
          if (/MASTER MATCHING/i.test(body) && /Source only|kandidat|23 kandidat/i.test(body)) {
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
    version: '1.0.1',
    resolve: resolveContext,
    ensureCustomer: ensureCustomer,
    runFromPage: runResolveFromPage,
    getLastContext: function () { return lastCtx; }
  };
})(window);
