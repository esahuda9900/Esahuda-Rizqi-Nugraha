/**
 * SDLG Data Pipeline Guard v1
 * - Waits for Supabase singleton + session
 * - Diagnoses empty UI (auth vs RLS vs real empty)
 * - Exposes window.SDLGDataPipeline for console debugging
 * Load AFTER modules/supabase-client.js
 */
(function (root) {
  'use strict';
  if (root.__SDLG_DATA_PIPELINE_GUARD_V1__) return;
  root.__SDLG_DATA_PIPELINE_GUARD_V1__ = true;

  function log() {
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[SDLG data-pipeline]');
    try { console.info.apply(console, a); } catch (_) {}
  }
  function warn() {
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[SDLG data-pipeline]');
    try { console.warn.apply(console, a); } catch (_) {}
  }
  function err() {
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[SDLG data-pipeline]');
    try { console.error.apply(console, a); } catch (_) {}
  }

  function getClient() {
    if (typeof root.getSdlgSupabase === 'function') return root.getSdlgSupabase();
    return root.sdlgSupabase || root.supabaseClient || null;
  }

  /**
   * Core fetch probe — distinguishes auth / error / empty / data.
   */
  async function fetchClaimsProbe(limit) {
    limit = limit || 5;
    if (typeof root.waitForSupabaseReady === 'function') {
      await root.waitForSupabaseReady();
    }
    var supabase = getClient();
    if (!supabase) {
      return { ok: false, reason: 'NO_CLIENT', message: 'Supabase client is null', rows: [] };
    }

    var sessionRes;
    try {
      sessionRes = await supabase.auth.getSession();
    } catch (e) {
      return { ok: false, reason: 'SESSION_THROW', message: String(e && e.message || e), rows: [] };
    }
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
    if (!session) {
      err('USER NOT AUTHENTICATED — RLS WILL BLOCK DATA');
      return {
        ok: false,
        reason: 'NOT_AUTHENTICATED',
        message: 'USER NOT AUTHENTICATED — RLS WILL BLOCK DATA. Login required before claims load.',
        rows: []
      };
    }

    log('Authenticated as', session.user && (session.user.email || session.user.id));

    var result;
    try {
      result = await supabase
        .from('claims')
        .select('claim_id,claim_status,customer,serial_no,last_updated')
        .order('claim_id', { ascending: false })
        .limit(limit);
    } catch (e) {
      return { ok: false, reason: 'FETCH_THROW', message: String(e && e.message || e), rows: [] };
    }

    if (result.error) {
      err('Fetch error', result.error);
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
      warn('Query OK but 0 rows — real empty OR RLS filtered all rows');
      return { ok: true, reason: 'EMPTY', message: 'Belum ada data yang cocok', rows: [] };
    }

    log('Fetch OK —', rows.length, 'row(s) sample', rows[0]);
    return { ok: true, reason: 'DATA', message: 'ok', rows: rows };
  }

  function showBanner(kind, text) {
    try {
      var id = 'sdlg-data-pipeline-banner';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.setAttribute('role', 'alert');
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
    } catch (_) {}
  }

  async function runDiagnostics() {
    var probe = await fetchClaimsProbe(5);
    if (probe.reason === 'NOT_AUTHENTICATED') {
      showBanner('error', 'Failed to fetch data: belum login. Session kosong — RLS memblokir semua baris. Silakan login ulang.');
    } else if (probe.reason === 'FETCH_ERROR' || probe.reason === 'FETCH_THROW' || probe.reason === 'NO_CLIENT') {
      showBanner('error', 'Failed to fetch data. Check console. (' + probe.message + ')');
    } else if (probe.reason === 'EMPTY') {
      showBanner('warn', 'Belum ada data yang cocok (query sukses, 0 baris).');
    } else if (probe.reason === 'DATA') {
      showBanner('ok', 'Supabase OK — ' + probe.rows.length + ' sample claim(s) readable. Jika UI masih 0, React state/user belum ter-bind.');
    }
    return probe;
  }

  root.SDLGDataPipeline = {
    version: '1.0.0',
    getClient: getClient,
    fetchClaimsProbe: fetchClaimsProbe,
    runDiagnostics: runDiagnostics
  };

  function boot() {
    if (typeof root.waitForSupabaseReady === 'function') {
      root.waitForSupabaseReady()
        .then(function () { return runDiagnostics(); })
        .catch(function (e) { err(e); showBanner('error', 'Failed to fetch data. Check console.'); });
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
