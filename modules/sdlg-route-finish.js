/**
 * SDLG Route Finish v1.2 — year URL, unit360 serial, breadcrumb, NotFound, sub-tab hashes
 * v1.2: no breadcrumb on SDLG Input (looked like empty/broken page)
 */
(function (root) {
  'use strict';
  if (root.__SDLG_ROUTE_FINISH_V12__) return;
  root.__SDLG_ROUTE_FINISH_V12__ = true;

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

  function breadcrumbHtml(route) {
    var parts = [];
    function link(label, hash) {
      return '<a href="' + hash + '" data-sdlg-bc style="color:#2563eb;text-decoration:none;font-weight:700">' + label + '</a>';
    }
    parts.push(link('Overview', '#/overview'));
    if (route.page === 'claims' || route.page === 'claim') {
      parts.push(link('Claims', '#/claims'));
      if (route.page === 'claim' && route.params && route.params.claimId) {
        parts.push('<span style="font-weight:800;color:#0f172a">' + route.params.claimId + '</span>');
        if (route.subTab && route.subTab !== 'overview') {
          parts.push('<span style="color:#64748b">' + route.subTab + '</span>');
        }
      } else if (route.params && route.params.year) {
        parts.push('<span style="font-weight:800">' + route.params.year + '</span>');
      }
    } else if (route.page === 'sdlg-input') {
      // No breadcrumb on SDLG Input — main nav already highlights the tab.
      return '';
    } else if (route.page === 'master-data') {
      parts.push(link('Master Data', '#/master-data/customers'));
      if (route.params && route.params.type) {
        parts.push('<span style="font-weight:800">' + route.params.type + '</span>');
      }
    } else if (route.page === 'unit360') {
      parts.push(link('Unit 360', '#/unit360'));
      if (route.params && route.params.serial) {
        parts.push('<span style="font-weight:800">' + route.params.serial + '</span>');
      }
    } else if (route.page === 'data-quality') {
      parts.push('<span style="font-weight:800">Data Quality</span>');
    } else if (route.page === 'new-claim') {
      parts.push('<span style="font-weight:800">New Claim</span>');
    } else {
      return '';
    }
    return parts.join(' <span style="color:#94a3b8">/</span> ');
  }

  function ensureBreadcrumb() {
    var route = parse();
    var id = 'sdlg-route-breadcrumb';
    var existing = document.getElementById(id);
    var html = breadcrumbHtml(route);
    if (!html || route.page === 'overview' || route.page === 'sdlg-input') {
      if (existing) existing.remove();
      return;
    }
    var page = document.querySelector('.page');
    if (!page) return;
    if (!existing) {
      existing = document.createElement('nav');
      existing.id = id;
      existing.setAttribute('aria-label', 'Breadcrumb');
      existing.style.cssText =
        'display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0 4px;' +
        'font-size:12px;color:#64748b;margin:0 0 6px';
      var title = page.querySelector('.page-title, h1, h2');
      if (title && title.parentNode) title.parentNode.insertBefore(existing, title);
      else page.insertBefore(existing, page.firstChild);
    }
    existing.innerHTML =
      '<button type="button" data-sdlg-bc-back style="border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:3px 8px;font-size:11px;font-weight:800;cursor:pointer;margin-right:6px">\u2190 Back</button>' +
      html;
    var back = existing.querySelector('[data-sdlg-bc-back]');
    if (back && !back.getAttribute('data-wired')) {
      back.setAttribute('data-wired', '1');
      back.addEventListener('click', function () {
        if (root.history.length > 1) root.history.back();
        else if (R() && R().navigate) R().navigate('overview');
        else root.location.hash = '#/overview';
      });
    }
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
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(tick, 300); })
        .observe(document.documentElement, { childList: true, subtree: true });
    }
    setInterval(tick, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGRouteFinish = { version: '1.2.0', refresh: tick };
})(window);
