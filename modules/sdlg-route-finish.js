/**
 * SDLG Route Finish v1.5 — year URL, unit360 serial, NotFound, sub-tab hashes
 * v1.5: breadcrumb injection DELETED entirely; nuclear kill of #sdlg-route-breadcrumb
 */
(function (root) {
  'use strict';
  if (root.__SDLG_ROUTE_FINISH_V15__) return;
  root.__SDLG_ROUTE_FINISH_V15__ = true;
  root.__SDLG_ROUTE_FINISH_DISABLED__ = true; // breadcrumb off

  function R() { return root.SDLGHashRouter || null; }

  function parse() {
    try { return R() && R().parse ? R().parse() : { page: 'overview', params: {}, subTab: '', tab: 'dashboard' }; }
    catch (_) { return { page: 'overview', params: {}, subTab: '', tab: 'dashboard' }; }
  }

  function ensureNotFound() {
    var route = parse();
    var id = 'sdlg-route-notfound';
    var existing = document.getElementById(id);
    if (!route.invalid) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    var el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'alert');
    el.style.cssText =
      'position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:100000;' +
      'max-width:520px;width:calc(100% - 24px);padding:14px 16px;border-radius:10px;' +
      'background:#7f1d1d;color:#fff;font-size:13px;line-height:1.45;box-shadow:0 12px 32px rgba(0,0,0,.25)';
    el.innerHTML =
      '<b>Halaman tidak ditemukan</b><br/>Rute <code style="opacity:.9">#' +
      String(route.raw || '') +
      '</code> tidak dikenal.' +
      '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<button type="button" id="sdlg-nf-overview" style="border:0;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;background:#fff;color:#7f1d1d">Kembali ke Overview</button>' +
      '</div>';
    document.body.appendChild(el);
    var btn = document.getElementById('sdlg-nf-overview');
    if (btn) {
      btn.addEventListener('click', function () {
        if (R() && R().navigate) R().navigate('overview');
        else root.location.hash = '#/overview';
        el.remove();
      });
    }
  }

  // BREADCRUMB PERMANENTLY DISABLED (v1.5)
  // React headers already own ← Kembali on Claim Detail / Claims / SDLG Input.
  // Any leftover #sdlg-route-breadcrumb is removed on every tick (nuclear).
  function killBreadcrumb() {
    var id = 'sdlg-route-breadcrumb';
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    try {
      var nodes = document.querySelectorAll('nav[aria-label="Breadcrumb"], [data-sdlg-bc-back]');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.id === id || n.getAttribute('data-sdlg-bc-back') != null) {
          var victim = (n.id === id) ? n : (document.getElementById(id) || n.parentElement || n);
          if (victim && victim.parentNode) victim.parentNode.removeChild(victim);
          else if (n.parentNode) n.parentNode.removeChild(n);
        }
      }
    } catch (_) {}
  }

  function ensureBreadcrumb() {
    killBreadcrumb();
  }

  function wireYearFilter() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var btn = e.target.closest('button, a, [role="tab"]');
      if (!btn) return;
      var t = String(btn.textContent || '').trim();
      if (/^Semua$|^All$/i.test(t)) {
        if (document.querySelector('.claims-table-shell, .claims-list') || /claim/i.test(String((document.querySelector('.page-title') || {}).textContent || ''))) {
          if (R() && R().navigate) R().navigate('claims', {});
          else root.location.hash = '#/claims';
        }
        return;
      }
      if (/^(20\d{2})$/.test(t)) {
        if (document.querySelector('.claims-table-shell, .claims-list') || /claim/i.test(String((document.querySelector('.page-title') || {}).textContent || ''))) {
          if (R() && R().navigate) R().navigate('claims', { year: t });
          else root.location.hash = '#/claims/' + t;
        }
      }
    }, true);
  }

  function wireUnit360() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      if (!/#\/?unit360/i.test(String(root.location.hash || '')) && parse().page !== 'unit360') return;
      var row = e.target.closest('tr, .unit-row, [data-serial]');
      if (!row) return;
      var serial = row.getAttribute('data-serial') || '';
      if (!serial) {
        var m = String(row.textContent || '').match(/\b(VLG[A-Z0-9]{8,}|[A-Z]{2,}\d{6,}[A-Z0-9]*)\b/i);
        if (m) serial = m[1];
      }
      if (serial && serial.length >= 6) {
        setTimeout(function () {
          if (R() && R().navigate) R().navigate('unit360', { serial: serial });
          else root.location.hash = '#/unit360/' + encodeURIComponent(serial);
        }, 0);
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var el = e.target;
      if (!el || el.tagName !== 'INPUT') return;
      if (parse().page !== 'unit360' && !/#\/?unit360/i.test(String(root.location.hash || ''))) return;
      var v = String(el.value || '').trim();
      if (v.length >= 4) {
        if (R() && R().navigate) R().navigate('unit360', { serial: v }, { replace: true });
        else root.location.hash = '#/unit360/' + encodeURIComponent(v);
      }
    }, true);
  }

  function wireClaimSubTabs() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var btn = e.target.closest('button, a');
      if (!btn || btn.classList.contains('nav-btn')) return;
      var label = String(btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
      var route = parse();
      var claimId = (route.params && route.params.claimId) || '';
      try { if (!claimId) claimId = root.localStorage.getItem('sdlg-warranty:last-claim:v1') || ''; } catch (_) {}
      if (!claimId) return;
      if (/sdlg input|input helper/.test(label)) {
        setTimeout(function () {
          if (R() && R().navigate) R().navigate('sdlg-input', { claimId: claimId });
        }, 0);
      }
      if (/warranty assessment|assessment/.test(label)) {
        setTimeout(function () {
          if (R() && R().navigate) R().navigate('claim', { claimId: claimId }, { subTab: 'assessment' });
        }, 0);
      }
    }, true);
  }

  function wireMasterTabs() {
    document.addEventListener('click', function (e) {
      if (!e.target) return;
      var btn = e.target.closest('button, a, [role="tab"]');
      if (!btn) return;
      var route = parse();
      if (route.page !== 'master-data' && route.tab !== 'masters') return;
      var t = String(btn.textContent || '').trim().toLowerCase();
      var map = {
        customers: 'customers', customer: 'customers',
        branches: 'branches', branch: 'branches',
        dealers: 'dealers', dealer: 'dealers',
        models: 'models', model: 'models',
        parts: 'parts', part: 'parts',
        machines: 'machines', machine: 'machines', units: 'machines', unit: 'machines'
      };
      if (map[t]) {
        if (R() && R().navigate) R().navigate('master-data', { type: map[t] }, { replace: true });
        else root.location.hash = '#/master-data/' + map[t];
      }
    }, true);
  }

  function tick() {
    ensureNotFound();
    ensureBreadcrumb();
  }

  function boot() {
    wireYearFilter();
    wireUnit360();
    wireClaimSubTabs();
    wireMasterTabs();
    tick();
    root.addEventListener('hashchange', tick);
    root.addEventListener('sdlg-route', tick);
    if (typeof MutationObserver !== 'undefined') {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(tick, 200); })
        .observe(document.documentElement, { childList: true, subtree: true });
    }
    setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGRouteFinish = { version: '1.5.0', refresh: tick, killBreadcrumb: killBreadcrumb };
})(window);
