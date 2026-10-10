/**
 * data-pipeline-guard.js — claim fetch diagnostics + session recovery
 * v1.2.1 — do not show red "Belum login" banner on the login page
 * - Self-heal: if token exists but getSession() null, try refreshSession once
 */
(function (root) {
  'use strict';
  if (root.__SDLG_DATA_PIPELINE_GUARD__) return;
  root.__SDLG_DATA_PIPELINE_GUARD__ = true;

  function log() {
    try {
      var a = ['[SDLG pipeline]'].concat([].slice.call(arguments));
      console.log.apply(console, a);
    } catch (_) {}
  }
  function warn() {
    try {
      var a = ['[SDLG pipeline]'].concat([].slice.call(arguments));
      console.warn.apply(console, a);
    } catch (_) {}
  }
  function err() {
    try {
      var a = ['[SDLG pipeline]'].concat([].slice.call(arguments));
      console.error.apply(console, a);
    } catch (_) {}
  }

  function getClient() {
    try {
      if (typeof root.getSdlgSupabase === 'function') {
        var c = root.getSdlgSupabase();
        if (c) return c;
      }
    } catch (_) {}
    if (root.sdlgSupabase && typeof root.sdlgSupabase.from === 'function') return root.sdlgSupabase;
    if (root.supabaseClient && typeof root.supabaseClient.from === 'function') return root.supabaseClient;
    return null;
  }

  function hasStoredTokenHint() {
    try {
      if (typeof localStorage === 'undefined') return false;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (/sb-.*-auth-token/i.test(k)) return true;
      }
    } catch (_) {}
    return false;
  }

  /** One-shot session recovery when token exists but getSession is empty */
  async function recoverSession(supabase) {
    var sessionRes = null;
    try {
      sessionRes = await supabase.auth.getSession();
    } catch (e) {
      warn('getSession throw', e);
    }
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
    if (session && session.access_token) return session;

    if (!hasStoredTokenHint()) return null;

    log('Token present but session null — attempting refreshSession once');
    try {
      var refreshed = await supabase.auth.refreshSession();
      session = refreshed && refreshed.data ? refreshed.data.session : null;
      if (session && session.access_token) {
        log('Session recovered via refreshSession');
        return session;
      }
    } catch (e) {
      warn('refreshSession failed', e);
    }

    try {
      await new Promise(function (r) { setTimeout(r, 400); });
      sessionRes = await supabase.auth.getSession();
      session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
      if (session) log('Session appeared after delay');
      return session;
    } catch (_) {
      return null;
    }
  }

  async function fetchClaimsProbe(limit) {
    limit = limit || 5;
    var supabase = getClient();
    if (!supabase) {
      return { ok: false, reason: 'NO_CLIENT', message: 'Supabase client missing', rows: [] };
    }

    var session = await recoverSession(supabase);
    if (!session || !session.access_token) {
      return { ok: false, reason: 'NOT_AUTHENTICATED', message: 'No session', rows: [] };
    }

    var result;
    try {
      result = await supabase
        .from('claims')
        .select('claim_id')
        .is('archived_at', null)
        .limit(limit);
    } catch (e) {
      err('fetch throw', e);
      return { ok: false, reason: 'FETCH_THROW', message: String(e && e.message || e), rows: [] };
    }

    if (result && result.error) {
      return {
        ok: false,
        reason: 'FETCH_ERROR',
        message: result.error.message || JSON.stringify(result.error),
        code: result.error.code,
        rows: []
      };
    }

    var rows = Array.isArray(result.data) ? result.data : [];
    if (!rows.length) {
      warn('Query OK but 0 rows');
      return { ok: true, reason: 'EMPTY', message: 'Belum ada data yang cocok', rows: [] };
    }

    log('Fetch OK —', rows.length, 'row(s)');
    return { ok: true, reason: 'DATA', message: 'ok', rows: rows };
  }

  function showBanner(kind, text) {
    try {
      var id = 'sdlg-data-pipeline-banner';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;z-index:99999;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);';
        document.body.appendChild(el);
      }
      if (kind === 'error') {
        el.style.background = '#fef2f2';
        el.style.color = '#991b1b';
        el.style.border = '1px solid #fecaca';
      } else if (kind === 'warn') {
        el.style.background = '#fffbeb';
        el.style.color = '#92400e';
        el.style.border = '1px solid #fde68a';
      } else {
        el.style.background = '#ecfdf5';
        el.style.color = '#065f46';
        el.style.border = '1px solid #a7f3d0';
      }
      el.textContent = text;
      if (kind === 'ok') {
        clearTimeout(el.__sdlgHideTimer);
        el.__sdlgHideTimer = setTimeout(function () {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        }, 8000);
      }
    } catch (_) {}
  }

  async function runDiagnostics() {
    var probe = await fetchClaimsProbe(5);
    if (probe.reason === 'NOT_AUTHENTICATED') {
      // On login page this is expected — do not flash a red error banner.
      var onLogin = false;
      try { onLogin = !!document.querySelector('main.login-screen, .login-screen'); } catch (_) {}
      if (!onLogin) {
        showBanner('error', 'Belum login — session kosong. RLS memblokir data. Silakan login.');
      }
    } else if (probe.reason === 'FETCH_ERROR' || probe.reason === 'FETCH_THROW' || probe.reason === 'NO_CLIENT') {
      showBanner('error', 'Gagal fetch data. Cek console. (' + probe.message + ')');
    } else if (probe.reason === 'EMPTY') {
      showBanner('warn', 'Query sukses, 0 baris claims. Belum ada data yang cocok.');
    } else if (probe.reason === 'DATA') {
      showBanner('ok', 'Data loaded successfully — ' + probe.rows.length + ' claim(s) readable from Supabase.');
    }
    return probe;
  }

  root.SDLGDataPipeline = {
    version: '1.2.1',
    getClient: getClient,
    recoverSession: recoverSession,
    fetchClaimsProbe: fetchClaimsProbe,
    runDiagnostics: runDiagnostics
  };

  root.SDLGDisplayValue = function SDLGDisplayValue(value, emptyText) {
    emptyText = emptyText == null ? '\u2014' : emptyText;
    if (value == null) return emptyText;
    if (typeof value === 'string' && value.trim() === '') return emptyText;
    if (Array.isArray(value) && value.length === 0) return emptyText;
    return value;
  };

  function boot() {
    var client = getClient();
    if (!client) {
      setTimeout(function () {
        if (!getClient()) warn('No supabase client after boot delay. Cek console.');
        else runDiagnostics().catch(function (e) { err(e); });
      }, 1200);
    } else {
      setTimeout(function () {
        runDiagnostics().catch(function (e) { err(e); });
      }, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); }, { once: true });
  } else {
    setTimeout(boot, 300);
  }
})(typeof window !== 'undefined' ? window : globalThis);
