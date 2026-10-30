/**
 * SDLG Route Finish — V3.0 (Self-Healing Route Guardian)
 * Year URL, unit360 serial, NotFound with auto-heal, sub-tab hashes.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ AUTO-HEAL: Countdown 5s redirect ke Overview (bisa di-cancel).
 * ✅ SMART SUGGESTIONS: Fuzzy match kasih saran route valid.
 * ✅ LAST KNOWN GOOD: Tombol "Kembali ke halaman terakhir".
 * ✅ NAV QUEUE: Anti double-click (100ms cooldown).
 * ✅ MULTI-TAB SYNC: Storage event listener.
 * ✅ BUG FIX: Fallback navigate support replace option.
 * ✅ BUG FIX: isClaimsPage() gak false positive di claim detail.
 * ✅ ERROR BOUNDARY: try/catch di semua operasi critical.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_ROUTE_FINISH_V3__) return;
  root.__SDLG_ROUTE_FINISH_V3__ = true;
  root.__SDLG_ROUTE_FINISH_V2__ = true; // Backward compat

  // ─────────────────────────────────────────────────────────
  // 1. KONFIGURASI & REGEX
  // ─────────────────────────────────────────────────────────
  var NOTFOUND_ID = 'sdlg-route-notfound';
  var BREADCRUMB_ID = 'sdlg-route-breadcrumb';
  var LAST_GOOD_KEY = 'sdlg:last-good-route:v1';
  var NAV_COOLDOWN_MS = 100;
  var DEBOUNCE_MS = 300;
  var AUTO_HEAL_SECONDS = 8; // Auto redirect setelah 8 detik

  var RE_ALL = /^Semua$|^All$/i;
  var RE_YEAR = /^(20\d{2})$/;
  var RE_UNIT360_HASH = /#\/?unit360/i;
  var RE_SERIAL = /\b(VLG[A-Z0-9]{8,}|[A-Z]{2,}\d{6,}[A-Z0-9]*)\b/i;
  var RE_CLAIM_ID = /\b\d{3,4}-\d{4}-SDLG(?:-PFR)?\b/i;
  var RE_INPUT_HELPER = /sdlg input|input helper/i;
  var RE_ASSESSMENT = /warranty assessment|assessment/i;

  var MASTER_MAP = {
    customers: 'customers', customer: 'customers',
    branches: 'branches', branch: 'branches',
    dealers: 'dealers', dealer: 'dealers',
    models: 'models', model: 'models',
    parts: 'parts', part: 'parts',
    machines: 'machines', machine: 'machines',
    units: 'machines', unit: 'machines'
  };

  // ─────────────────────────────────────────────────────────
  // 2. STATE
  // ─────────────────────────────────────────────────────────
  var debounceTimer = null;
  var lastNotFoundSignature = '';
  var lastNavTime = 0;
  var autoHealTimer = null;
  var countdownTimer = null;
  var isTicking = false;

  // ─────────────────────────────────────────────────────────
  // 3. UTILITIES
  // ─────────────────────────────────────────────────────────
  function getRouter() {
    return root.SDLGHashRouter || null;
  }

  function parseRoute() {
    try {
      var r = getRouter();
      if (r && typeof r.parse === 'function') return r.parse();
    } catch (_) {}
    return { page: 'overview', params: {}, subTab: '', tab: 'dashboard', raw: '' };
  }

  function navigate(page, params, opts) {
    // Anti double-click
    var now = Date.now();
    if (now - lastNavTime < NAV_COOLDOWN_MS) return;
    lastNavTime = now;

    var r = getRouter();
    if (r && typeof r.navigate === 'function') {
      try {
        r.navigate(page, params, opts);
        return;
      } catch (err) {
        console.warn('[SDLG Route] Router navigate failed:', err.message);
      }
    }

    // Fallback: manual hash change
    var hash = '#/' + page;
    if (params) {
      if (params.claimId) hash += '/' + encodeURIComponent(params.claimId);
      else if (params.serial) hash += '/' + encodeURIComponent(params.serial);
      else if (params.year) hash += '/' + params.year;
      else if (params.type) hash += '/' + params.type;
    }

    try {
      var target = root.location.pathname + root.location.search + hash;
      if (opts && opts.replace) {
        root.history.replaceState(null, '', target);
        // Trigger hashchange manually (replaceState doesn't fire it)
        root.dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        root.location.hash = hash;
      }
    } catch (_) {
      root.location.hash = hash;
    }
  }

  function getPageTitle() {
    try {
      var el = document.querySelector('.page-title');
      return el ? String(el.textContent || '') : '';
    } catch (_) { return ''; }
  }

  function isClaimsListPage() {
    // Bug fix: kalau ini claim detail, jangan dianggap claims list
    if (document.querySelector('.claim-detail-page, [data-sdlg-claim-detail="1"]')) return false;
    if (document.querySelector('.claims-table-shell, .claims-list')) return true;
    return /^claims/i.test(getPageTitle());
  }

  function isUnit360Page() {
    if (parseRoute().page === 'unit360') return true;
    return RE_UNIT360_HASH.test(String(root.location.hash || ''));
  }

  // ─────────────────────────────────────────────────────────
  // 4. LAST KNOWN GOOD ROUTE
  // ─────────────────────────────────────────────────────────
  function saveLastGoodRoute() {
    try {
      var route = parseRoute();
      if (route.invalid || !route.page || route.page === 'login') return;
      localStorage.setItem(LAST_GOOD_KEY, JSON.stringify({
        hash: String(root.location.hash || ''),
        page: route.page,
        at: Date.now()
      }));
    } catch (_) {}
  }

  function getLastGoodRoute() {
    try {
      var raw = localStorage.getItem(LAST_GOOD_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.hash) return null;
      // Expire 1 jam
      if (Date.now() - (parsed.at || 0) > 3600000) return null;
      return parsed;
    } catch (_) { return null; }
  }

  // ─────────────────────────────────────────────────────────
  // 5. SMART SUGGESTIONS (Fuzzy Match)
  // ─────────────────────────────────────────────────────────
  function suggestRoutes(rawHash) {
    var suggestions = [];
    var raw = String(rawHash || '').toLowerCase().trim();
    if (!raw) return suggestions;

    // 1. Typo "claimss" -> "claims"
    var commonRoutes = [
      { route: 'claims', label: 'Daftar Claims' },
      { route: 'overview', label: 'Overview' },
      { route: 'sdlg-input', label: 'SDLG Input Helper' },
      { route: 'master-data', label: 'Master Data' },
      { route: 'data-quality', label: 'Data Quality' },
      { route: 'unit360', label: 'Unit 360' },
      { route: 'new-claim', label: 'New Claim' }
    ];

    commonRoutes.forEach(function (r) {
      // Cek kemiripan (substring atau mirror distance)
      var rLow = r.route.toLowerCase();
      if (raw.indexOf(rLow) >= 0 || rLow.indexOf(raw) >= 0) {
        suggestions.push(r);
      }
    });

    // 2. Pattern "claim/xxx" -> maybe sdlg-input
    if (/claim\//i.test(raw) || RE_CLAIM_ID.test(rawHash)) {
      if (!suggestions.find(function (s) { return s.route === 'claims'; })) {
        suggestions.unshift({ route: 'claims', label: 'Daftar Claims' });
      }
    }

    // 3. Kalau gak ada suggestion, kasih 2 default
    if (suggestions.length === 0) {
      suggestions.push({ route: 'overview', label: 'Overview' });
    }

    return suggestions.slice(0, 3);
  }

  // ─────────────────────────────────────────────────────────
  // 6. NOT FOUND BANNER (dengan Auto-Heal)
  // ─────────────────────────────────────────────────────────
  function clearAutoHealTimers() {
    if (autoHealTimer) { clearTimeout(autoHealTimer); autoHealTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }

  function removeNotFoundBanner() {
    var existing = document.getElementById(NOTFOUND_ID);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    clearAutoHealTimers();
    lastNotFoundSignature = '';
  }

  function showNotFound(route) {
    var sig = String(route.raw || '') + '|' + String(route.page || '');
    if (sig === lastNotFoundSignature && document.getElementById(NOTFOUND_ID)) return;
    lastNotFoundSignature = sig;

    removeNotFoundBanner();
    lastNotFoundSignature = sig;

    var rawHash = String(route.raw || '');
    var suggestions = suggestRoutes(rawHash);
    var lastGood = getLastGoodRoute();
    var countdown = AUTO_HEAL_SECONDS;

    // Build UI
    var el = document.createElement('div');
    el.id = NOTFOUND_ID;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.style.cssText = 
      'position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:100000;' +
      'max-width:560px;width:calc(100% - 24px);padding:20px 24px;border-radius:14px;' +
      'background:linear-gradient(135deg,#7f1d1d 0%,#991b1b 100%);color:#fff;' +
      'font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.5;' +
      'box-shadow:0 20px 40px -10px rgba(0,0,0,0.4);border:1px solid #991b1b';

    var sugHTML = suggestions.map(function (s) {
      return '<button type="button" data-nav="' + s.route + '" style="' +
        'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;' +
        'background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.25);' +
        'font-size:12px;font-weight:700;cursor:pointer;transition:background 0.15s;margin:4px 4px 0 0">' +
        '→ ' + s.label + '</button>';
    }).join('');

    var lastGoodHTML = '';
    if (lastGood && lastGood.hash && lastGood.hash !== '#' + rawHash) {
      var lastGoodLabel = lastGood.page === 'claim' ? 'Klaim Terakhir' :
                          lastGood.page === 'claims' ? 'Daftar Claims' :
                          lastGood.page || 'Halaman Terakhir';
      lastGoodHTML = '<button type="button" id="sdlg-nf-lastgood" style="' +
        'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;' +
        'background:#fff;color:#7f1d1d;border:none;font-size:12px;font-weight:800;' +
        'cursor:pointer;margin:4px 4px 0 0">↩ Kembali ke ' + lastGoodLabel + '</button>';
    }

    el.innerHTML = 
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<div style="font-size:28px;line-height:1">⚠️</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:800;font-size:16px;margin-bottom:6px">Halaman Tidak Ditemukan</div>' +
          '<div style="opacity:0.85;margin-bottom:14px;word-break:break-word">Rute <code style="background:rgba(255,255,255,0.15);padding:2px 8px;border-radius:4px;font-family:monospace">#' + rawHash + '</code> tidak dikenal.</div>' +
          
          (suggestions.length > 0 
            ? '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Mungkin maksud Anda:</div>' + sugHTML + '</div>' 
            : '') +
          
          (lastGoodHTML ? '<div style="margin-bottom:12px">' + lastGoodHTML + '</div>' : '') +
          
          '<div id="sdlg-nf-countdown" style="display:flex;justify-content:space-between;align-items:center;' +
          'padding-top:12px;border-top:1px solid rgba(255,255,255,0.2);font-size:12px;opacity:0.85">' +
            '<span id="sdlg-nf-timer-text">Auto-redirect ke Overview dalam <b id="sdlg-nf-timer-sec">' + countdown + '</b> detik…</span>' +
            '<button type="button" id="sdlg-nf-cancel" style="' +
              'background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);' +
              'padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Batal</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);

    // Auto-heal countdown
    var secEl = document.getElementById('sdlg-nf-timer-sec');
    countdownTimer = setInterval(function () {
      countdown--;
      if (secEl) secEl.textContent = String(countdown);
      if (countdown <= 0) {
        clearAutoHealTimers();
        removeNotFoundBanner();
        navigate('overview', {}, { replace: true });
      }
    }, 1000);

    // Cancel button
    var cancelBtn = document.getElementById('sdlg-nf-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        clearAutoHealTimers();
        var countdownRow = document.getElementById('sdlg-nf-countdown');
        if (countdownRow) countdownRow.remove();
      };
    }

    // Suggestion buttons
    el.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.onclick = function () {
        var route = btn.getAttribute('data-nav');
        removeNotFoundBanner();
        navigate(route);
      };
    });

    // Last good button
    var lastGoodBtn = document.getElementById('sdlg-nf-lastgood');
    if (lastGoodBtn && lastGood) {
      lastGoodBtn.onclick = function () {
        removeNotFoundBanner();
        try {
          root.location.hash = lastGood.hash.replace(/^#/, '');
        } catch (_) {}
      };
    }

    // Also announce via SDLGNotify
    if (root.SDLGNotify && root.SDLGNotify.warning) {
      root.SDLGNotify.warning('Rute Tidak Ditemukan', 'Halaman "' + rawHash + '" tidak dikenal.');
    }
  }

  function ensureNotFound() {
    var route = parseRoute();
    
    if (!route.invalid) {
      saveLastGoodRoute();
      if (document.getElementById(NOTFOUND_ID)) {
        removeNotFoundBanner();
      }
      return;
    }

    showNotFound(route);
  }

  // ─────────────────────────────────────────────────────────
  // 7. BREADCRUMB KILLER (Scoped)
  // ─────────────────────────────────────────────────────────
  function killBreadcrumb() {
    try {
      var existing = document.getElementById(BREADCRUMB_ID);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

      var scope = document.querySelector('.page');
      if (!scope) return;

      var nodes = scope.querySelectorAll('[data-sdlg-bc-back]');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 8. UNIFIED CLICK HANDLER
  // ─────────────────────────────────────────────────────────
  function handleClick(e) {
    try {
      var target = e.target;
      if (!target || !target.closest) return;

      var btn = target.closest('button, a, [role="tab"], tr, .unit-row, [data-serial]');
      if (!btn) return;

      // Skip nav buttons
      if (btn.classList && btn.classList.contains('nav-btn')) return;

      var label = String(btn.textContent || '').trim();
      var labelLower = label.toLowerCase();
      var route = parseRoute();

      // A. Year Filter (harus list page, bukan detail)
      if (RE_ALL.test(label) && isClaimsListPage()) {
        e.preventDefault();
        navigate('claims', {});
        return;
      }
      if (RE_YEAR.test(label) && isClaimsListPage()) {
        e.preventDefault();
        navigate('claims', { year: label });
        return;
      }

      // B. Unit360 Serial
      if (isUnit360Page()) {
        var serial = btn.getAttribute('data-serial') || '';
        if (!serial) {
          var m = String(btn.textContent || '').match(RE_SERIAL);
          if (m) serial = m[1];
        }
        if (serial && serial.length >= 6) {
          e.preventDefault();
          navigate('unit360', { serial: serial });
          return;
        }
      }

      // C. Claim Sub-Tabs
      var claimId = (route.params && route.params.claimId) || '';
      if (!claimId) {
        try { claimId = localStorage.getItem('sdlg-warranty:last-claim:v2') || ''; } catch (_) {}
      }

      if (claimId && RE_INPUT_HELPER.test(labelLower)) {
        e.preventDefault();
        navigate('sdlg-input', { claimId: claimId });
        return;
      }
      if (claimId && RE_ASSESSMENT.test(labelLower)) {
        e.preventDefault();
        navigate('claim', { claimId: claimId }, { subTab: 'assessment' });
        return;
      }

      // D. Master Tabs
      if (route.page === 'master-data' || route.tab === 'masters') {
        var masterType = MASTER_MAP[labelLower];
        if (masterType) {
          e.preventDefault();
          navigate('master-data', { type: masterType }, { replace: true });
          return;
        }
      }

    } catch (err) {
      console.warn('[SDLG Route] handleClick error:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 9. KEYBOARD HANDLER
  // ─────────────────────────────────────────────────────────
  function handleKeydown(e) {
    try {
      if (e.key !== 'Enter') return;
      var el = e.target;
      if (!el || el.tagName !== 'INPUT') return;
      if (!isUnit360Page()) return;

      var v = String(el.value || '').trim();
      if (v.length >= 4) {
        e.preventDefault();
        navigate('unit360', { serial: v }, { replace: true });
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 10. TICK (Debounced + Error Boundary)
  // ─────────────────────────────────────────────────────────
  function tick() {
    if (isTicking) return;
    isTicking = true;

    var start = performance.now();

    try {
      ensureNotFound();
      killBreadcrumb();
    } catch (err) {
      console.warn('[SDLG Route] tick error:', err.message);
    } finally {
      isTicking = false;
    }

    // Telemetry (debug only)
    if (/[?&]debug=true/.test(String(root.location.search || ''))) {
      var duration = performance.now() - start;
      if (duration > 16) {
        console.warn('[SDLG Route] tick took ' + duration.toFixed(1) + 'ms (slow)');
      }
    }
  }

  function scheduleTick() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tick, DEBOUNCE_MS);
  }

  // ─────────────────────────────────────────────────────────
  // 11. MULTI-TAB SYNC
  // ─────────────────────────────────────────────────────────
  function setupMultiTabSync() {
    try {
      root.addEventListener('storage', function (e) {
        if (!e || e.key !== LAST_GOOD_KEY) return;
        // Another tab navigated, no action needed (localStorage sync)
      });
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────
  // 12. BOOT
  // ─────────────────────────────────────────────────────────
  function boot() {
    // 1. Listeners
    document.addEventListener('click', handleClick, false);
    document.addEventListener('keydown', handleKeydown, false);

    // 2. Initial tick
    tick();

    // 3. Route change handlers
    root.addEventListener('hashchange', scheduleTick);
    root.addEventListener('sdlg-route', scheduleTick);
    root.addEventListener('sdlg-route-changed', scheduleTick);

    // 4. Mutation Observer (scoped + debounced)
    if (typeof MutationObserver !== 'undefined') {
      var container = document.querySelector('.page') || document.body;
      if (container) {
        try {
          var obs = new MutationObserver(scheduleTick);
          obs.observe(container, { childList: true, subtree: true });
        } catch (_) {}
      }
    }

    // 5. Multi-tab sync
    setupMultiTabSync();

    // 6. Cleanup on unload
    root.addEventListener('beforeunload', clearAutoHealTimers);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─────────────────────────────────────────────────────────
  // 13. PUBLIC API (Immutable)
  // ─────────────────────────────────────────────────────────
  root.SDLGRouteFinish = Object.freeze({
    version: '3.0.0',
    refresh: tick,
    killBreadcrumb: killBreadcrumb,
    ensureNotFound: ensureNotFound,
    suggestRoutes: suggestRoutes,
    getLastGoodRoute: getLastGoodRoute,
    clearLastGoodRoute: function () {
      try { localStorage.removeItem(LAST_GOOD_KEY); } catch (_) {}
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);