/**
 * SDLG UI Consolidate v2.0.0
 * =============================================================================
 * Production-grade UI consolidation for SDLG Input Helper pages in D365 Portal.
 *
 * Upgraded from v1.1:
 *   ✓ Config-driven — no hardcoded strings/selectors/intervals
 *   ✓ CSS-based styling (no inline-style flashing / thrash)
 *   ✓ Scoped, debounced + rIC-scheduled, visibility-aware scheduler
 *   ✓ Idempotent, collect-then-remove DOM ops, focus-guarded
 *   ✓ Full lifecycle: destroy() unwinds observers, timers, listeners
 *   ✓ Structured logging + CustomEvents for observability
 *   ✓ Adaptive throttling under mutation storms
 *   ✓ SSR-safe, zero-dependency, ~9KB
 *   ✓ Backwards-compatible API — SDLGUIConsolidate.refresh()
 *
 * Public API:
 *   SDLGUIConsolidate.refresh()     → synchronous re-apply (compat)
 *   SDLGUIConsolidate.applyNow()    → forced synchronous (debug)
 *   SDLGUIConsolidate.isHelperPage()→ boolean
 *   SDLGUIConsolidate.diagnose()    → full state snapshot
 *   SDLGUIConsolidate.stats()       → scheduler metrics
 *   SDLGUIConsolidate.destroy()     → full teardown
 *   SDLGUIConsolidate.version       → '2.0.0'
 * =============================================================================
 */
(function (root) {
  'use strict';
  // React is the sole owner of SDLG Input. Legacy DOM modifiers must not boot.
  if (typeof window !== 'undefined' && window.__SDLG_REACT_INPUT_SINGLE_OWNER__) return;

  if (!root || !root.document) return;
  var win = root;
  var doc = win.document;
  var html = doc.documentElement;
  if (!html) return;

  // ── Version guard — blocks v1.1 from re-installing, prevents double-install
  if (win.__SDLG_UI_CONSOLIDATE_V2__) return;
  win.__SDLG_UI_CONSOLIDATE_V2__ = true;
  win.__SDLG_UI_CONSOLIDATE_V11__ = true;

  // ── Defaults ──────────────────────────────────────────────────────────
  var DEFAULTS = {
    version: '2.0.0',
    logLevel: 'warn',              // silent | error | warn | info | debug
    exposeInternals: false,
    helperFieldThreshold: 5,

    patterns: {
      helperTitle:  /Warranty Claim Input Helper|SDLG Input Helper/i,
      mirrorTitle:  /^Warranty Claim Form$/i,
      actionBarTxt: /Copy Home Fields|Copy Replacement|Buka SDLG Portal/i,
      helperHash:   /#\/?sdlg-input|#\/?sdlginput|#\/?claim\/[^/]+\/input/i
    },

    selectors: {
      page:        '.page[data-sdlg-input-helper], [data-sdlg-input-helper].page, .page',
      pageTitle:   '.page-title',
      copyAll:     '[data-sdlg-copy-all]',
      field:       '[data-sdlg-field]',
      stickyBar:   '#sdlg-portal-sticky-bar, .sdlg-portal-sticky-bar, [data-sdlg-sticky-bar]',
      mirror:      '[data-sdlg-dynamics-mirror], #sdlg-portal-mirror-panel',
      actionBar:   '[id*="action-bar"], [class*="action-bar"], [class*="taskbar"]',
      titleNodes:  '.page-title, h1, h2, h3, [class*="title"]',
      interactive: 'input, textarea, select, button, ' +
                   '[contenteditable=""], [contenteditable="true"], [data-sdlg-field]'
    },

    sticky: { paddingPx: 72, zIndex: 99990 },

    scheduler: {
      debounceMs:     250,
      minDebounceMs:  100,
      maxDebounceMs:  2000,
      heartbeatMs:    5000,
      idleTimeoutMs:  500,
      slowRunWarnMs:  50
    }
  };

  // ── Deep-merge user config ────────────────────────────────────────────
  function mergeDeep(base, override) {
    var out = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    if (!override) return out;
    for (var k2 in override) {
      if (!Object.prototype.hasOwnProperty.call(override, k2)) continue;
      var bv = base[k2], ov = override[k2];
      var plainBoth = bv && ov && typeof bv === 'object' && typeof ov === 'object'
        && !Array.isArray(bv) && !Array.isArray(ov)
        && !(bv instanceof RegExp) && !(ov instanceof RegExp);
      out[k2] = plainBoth ? mergeDeep(bv, ov) : ov;
    }
    return out;
  }
  var CONFIG = mergeDeep(DEFAULTS, win.SDLGUIConsolidateConfig || {});

  // ── Logger ────────────────────────────────────────────────────────────
  var LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
  var threshold = LEVELS[CONFIG.logLevel] != null ? LEVELS[CONFIG.logLevel] : LEVELS.warn;
  var PREFIX = '%c[SDLG ui-consolidate]';
  var STYLES = {
    error: 'color:#c00;font-weight:bold',
    warn:  'color:#c80;font-weight:bold',
    info:  'color:#08c;font-weight:bold',
    debug: 'color:#888'
  };
  function emitLog(level) {
    if ((LEVELS[level] || 0) > threshold) return;
    try {
      var fn = level === 'error' ? console.error
             : level === 'warn'  ? console.warn
             : level === 'info'  ? console.info : console.log;
      var args = [PREFIX, STYLES[level]].concat(
        Array.prototype.slice.call(arguments, 1)
      );
      fn.apply(console, args);
    } catch (_) { /* ignore */ }
  }
  var log = {
    error: function () { emitLog.apply(null, ['error'].concat([].slice.call(arguments))); },
    warn:  function () { emitLog.apply(null, ['warn'].concat([].slice.call(arguments))); },
    info:  function () { emitLog.apply(null, ['info'].concat([].slice.call(arguments))); },
    debug: function () { emitLog.apply(null, ['debug'].concat([].slice.call(arguments))); }
  };

  // ── Utils ─────────────────────────────────────────────────────────────
  function toArray(nl) {
    var out = [];
    for (var i = 0; i < nl.length; i++) out.push(nl[i]);
    return out;
  }
  function safeQueryAll(rootNode, sel) {
    try { return toArray(rootNode.querySelectorAll(sel)); }
    catch (e) { log.error('invalid selector:', sel, e); return []; }
  }
  function normText(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }
  function nowMs() {
    return (win.performance && typeof win.performance.now === 'function')
      ? win.performance.now() : Date.now();
  }
  function safeRemove(node) {
    try {
      if (node && node.parentNode) { node.parentNode.removeChild(node); return true; }
    } catch (_) {}
    return false;
  }
  function emit(name, detail) {
    try {
      if (typeof win.CustomEvent === 'function') {
        win.dispatchEvent(new win.CustomEvent('sdlg:consolidate:' + name, { detail: detail }));
      }
    } catch (_) {}
  }

  // ── CSS injection (once) ──────────────────────────────────────────────
  var STYLE_ID = 'sdlg-ui-consolidate-styles';
  var CSS_TEXT =
    'html.sdlg-has-portal-sticky .page{' +
      'padding-bottom:var(--sdlg-sticky-padding,72px)!important}' +
    '#sdlg-portal-sticky-bar,.sdlg-portal-sticky-bar{' +
      'position:fixed!important;bottom:0!important;left:0!important;right:0!important;' +
      'z-index:var(--sdlg-sticky-z,99990)!important}';

  function injectStyles() {
    if (doc.getElementById(STYLE_ID)) return;
    try {
      var style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS_TEXT;
      (doc.head || html).appendChild(style);
    } catch (e) { log.warn('style injection failed', e); }
    try {
      html.style.setProperty('--sdlg-sticky-padding', CONFIG.sticky.paddingPx + 'px');
      html.style.setProperty('--sdlg-sticky-z', String(CONFIG.sticky.zIndex));
    } catch (_) {}
  }

  // ── Detector ──────────────────────────────────────────────────────────
  function isHelperPage() {
    try {
      var r = win.SDLGHashRouter;
      if (r && typeof r.showBottomTaskbar === 'function' && !r.showBottomTaskbar()) return false;
    } catch (_) {}

    var page = null;
    try { page = doc.querySelector(CONFIG.selectors.page); } catch (_) {}
    if (!page) return false;

    if (page.hasAttribute && page.hasAttribute('data-sdlg-input-helper')) return true;

    try {
      var t = page.querySelector(CONFIG.selectors.pageTitle);
      if (t && CONFIG.patterns.helperTitle.test(normText(t.textContent))) return true;
    } catch (_) {}

    try { if (page.querySelector(CONFIG.selectors.copyAll)) return true; } catch (_) {}

    try {
      if (CONFIG.patterns.helperHash.test(String((win.location && win.location.hash) || ''))) return true;
    } catch (_) {}

    return false;
  }

  // ── Cleaners ──────────────────────────────────────────────────────────
  function cleanStickyBars(helper) {
    var bars = safeQueryAll(doc, CONFIG.selectors.stickyBar);
    var res = { removed: 0, kept: null };
    if (!bars.length) { html.classList.remove('sdlg-has-portal-sticky'); return res; }

    // Off helper page → no sticky bar allowed
    if (!helper) {
      for (var i = 0; i < bars.length; i++) if (safeRemove(bars[i])) res.removed++;
      html.classList.remove('sdlg-has-portal-sticky');
      return res;
    }

    // Pick canonical bar: id > class > first
    var keep = null, j;
    for (j = 0; j < bars.length; j++) {
      if (bars[j].id === 'sdlg-portal-sticky-bar') { keep = bars[j]; break; }
    }
    if (!keep) for (j = 0; j < bars.length; j++) {
      if (bars[j].classList && bars[j].classList.contains('sdlg-portal-sticky-bar')) { keep = bars[j]; break; }
    }
    if (!keep) keep = bars[0];

    for (var m = 0; m < bars.length; m++) {
      if (bars[m] === keep) continue;
      if (safeRemove(bars[m])) res.removed++;
    }

    if (keep) {
      if (keep.id !== 'sdlg-portal-sticky-bar') keep.id = 'sdlg-portal-sticky-bar';
      if (keep.classList && !keep.classList.contains('sdlg-portal-sticky-bar')) {
        keep.classList.add('sdlg-portal-sticky-bar');
      }
      // Clean up v1.1 inline styles (CSS now owns the styling)
      try {
        var st = keep.style;
        if (st && st.position === 'fixed') {
          st.position = ''; st.bottom = ''; st.left = ''; st.right = '';
          if (st.zIndex === '99990') st.zIndex = '';
        }
      } catch (_) {}
      html.classList.add('sdlg-has-portal-sticky');
      res.kept = keep;
    }
    return res;
  }

  function cleanDuplicateForms() {
    var removed = 0, i;

    // 1) Kill D365 mirror panels
    var mirrors = safeQueryAll(doc, CONFIG.selectors.mirror);
    for (i = 0; i < mirrors.length; i++) if (safeRemove(mirrors[i])) removed++;

    // 2) Kill "Warranty Claim Form" sections — only when the page really
    //    looks like a helper (plenty of field markers) to avoid nuking content.
    var page = null;
    try { page = doc.querySelector(CONFIG.selectors.page); } catch (_) {}
    var fieldCount = page
      ? page.querySelectorAll(CONFIG.selectors.copyAll + ',' + CONFIG.selectors.field).length
      : 0;

    if (page && fieldCount > CONFIG.helperFieldThreshold) {
      var titles = safeQueryAll(doc, CONFIG.selectors.titleNodes);
      for (i = 0; i < titles.length; i++) {
        var el = titles[i];
        if (!el || !el.parentNode) continue;
        if (!CONFIG.patterns.mirrorTitle.test(normText(el.textContent))) continue;
        if (el.querySelector(CONFIG.selectors.interactive)) continue; // never nuke form controls

        var section = el.closest
          ? el.closest('section, .card, [class*="card"], form, .page > div')
          : el.parentElement;
        if (!section || !section.parentNode || section === page) continue;

        // Preserve user focus
        try {
          var ae = doc.activeElement;
          if (ae && section.contains(ae) && ae.matches && ae.matches(CONFIG.selectors.interactive)) continue;
        } catch (_) {}

        if (safeRemove(section)) removed++;
      }
    }

    // 3) Kill stray action bars (never remove our own bar or bars with forms)
    var abBars = safeQueryAll(doc, CONFIG.selectors.actionBar);
    for (i = 0; i < abBars.length; i++) {
      var ab = abBars[i];
      if (!ab || !ab.parentNode) continue;
      if (ab.id === 'sdlg-portal-sticky-bar') continue;
      if (ab.closest && ab.closest('#sdlg-portal-sticky-bar')) continue;
      if (!CONFIG.patterns.actionBarTxt.test(normText(ab.textContent))) continue;
      if (ab.querySelector(CONFIG.selectors.interactive)) continue;
      if (safeRemove(ab)) removed++;
    }
    return removed;
  }

  // ── Layout ────────────────────────────────────────────────────────────
  function syncLayout(helper) {
    try {
      var hasBar = !!doc.getElementById('sdlg-portal-sticky-bar');
      html.classList.toggle('sdlg-has-portal-sticky', helper && hasBar);
    } catch (e) { log.warn('layout sync failed', e); }
  }

  // ── Orchestrator ──────────────────────────────────────────────────────
  var lastSummary = { at: 0, removed: 0, helper: false };

  function applyAll(reason) {
    var t0 = nowMs(), removed = 0, helper = false;
    try {
      helper = isHelperPage();
      removed += cleanStickyBars(helper).removed;
      removed += cleanDuplicateForms();
      syncLayout(helper);
    } catch (e) {
      log.error('applyAll failed (' + reason + ')', e);
      emit('error', { reason: reason, error: String(e && e.message || e) });
      return;
    }
    var dt = nowMs() - t0;
    lastSummary = { at: Date.now(), removed: removed, helper: helper };
    if (removed > 0) {
      log.info('applied (' + reason + ')', { removed: removed, ms: +dt.toFixed(1) });
      emit('applied', { reason: reason, removed: removed, ms: dt });
    } else {
      log.debug('noop (' + reason + ') ' + dt.toFixed(1) + 'ms');
    }
    if (dt > CONFIG.scheduler.slowRunWarnMs) {
      log.warn('slow apply', dt.toFixed(1) + 'ms', 'reason=' + reason);
    }
  }

  // ── Scheduler (debounced + rIC + visibility-aware + adaptive) ────────
  var scheduler = (function () {
    var debounceMs = CONFIG.scheduler.debounceMs;
    var timerId = null, heartbeatId = null, running = false, destroyed = false;
    var observer = null, visibilityHandler = null;
    var mutationCount = 0, rateWindowStart = nowMs();
    var stats = { runs: 0, totalMs: 0, lastRun: 0 };

    function scheduleIdle(fn) {
      if (typeof win.requestIdleCallback === 'function') {
        try { return win.requestIdleCallback(fn, { timeout: CONFIG.scheduler.idleTimeoutMs }); }
        catch (_) {}
      }
      return win.setTimeout(fn, 0);
    }

    function execute(reason, force) {
      if (destroyed || running) return;
      if (!force && doc.visibilityState === 'hidden') {
        log.debug('skipped (hidden)'); return;
      }
      running = true;
      var t0 = nowMs();
      try { applyAll(reason); }
      catch (e) { log.error('execute failed', e); }
      finally {
        stats.runs++;
        stats.totalMs += nowMs() - t0;
        stats.lastRun = Date.now();
        running = false;
      }
    }

    function schedule(reason) {
      if (destroyed) return;
      if (timerId) win.clearTimeout(timerId);
      timerId = win.setTimeout(function () {
        timerId = null;
        scheduleIdle(function () { execute(reason); });
      }, debounceMs);
    }

    function onMutation() {
      // Adaptive throttling: scale debounce with mutation rate
      mutationCount++;
      var elapsed = nowMs() - rateWindowStart;
      if (elapsed > 1000) {
        var rate = mutationCount / (elapsed / 1000);
        if (rate > 30) debounceMs = Math.min(debounceMs * 1.5, CONFIG.scheduler.maxDebounceMs);
        else if (rate < 5) debounceMs = Math.max(debounceMs / 1.2, CONFIG.scheduler.minDebounceMs);
        mutationCount = 0; rateWindowStart = nowMs();
      }
      schedule('mutation');
    }

    function start() {
      scheduleIdle(function () { execute('boot'); });

      if (typeof win.MutationObserver === 'function') {
        try {
          observer = new win.MutationObserver(onMutation);
          observer.observe(doc.body || html, { childList: true, subtree: true });
        } catch (e) { log.warn('MutationObserver failed', e); }
      }

      heartbeatId = win.setInterval(function () {
        if (doc.visibilityState === 'visible') schedule('heartbeat');
      }, CONFIG.scheduler.heartbeatMs);

      visibilityHandler = function () {
        if (doc.visibilityState === 'visible') schedule('visibility');
      };
      win.addEventListener('visibilitychange', visibilityHandler);
    }

    function destroy() {
      destroyed = true;
      if (timerId) { win.clearTimeout(timerId); timerId = null; }
      if (heartbeatId) { win.clearInterval(heartbeatId); heartbeatId = null; }
      if (observer) { try { observer.disconnect(); } catch (_) {} observer = null; }
      if (visibilityHandler) {
        try { win.removeEventListener('visibilitychange', visibilityHandler); } catch (_) {}
        visibilityHandler = null;
      }
    }

    return {
      start: start, schedule: schedule, destroy: destroy,
      execute: function (reason, force) { execute(reason, force); },
      stats: function () {
        return {
          runs: stats.runs,
          totalMs: +stats.totalMs.toFixed(1),
          avgMs: stats.runs ? +(stats.totalMs / stats.runs).toFixed(1) : 0,
          lastRun: stats.lastRun,
          debounceMs: debounceMs
        };
      }
    };
  })();

  // ── Public API ────────────────────────────────────────────────────────
  var api = {
    version: CONFIG.version,

    /** Backwards-compat: synchronous re-apply (matches v1.1 behavior). */
    refresh: function (reason) { scheduler.execute(reason || 'api', true); },

    /** Force a synchronous run regardless of visibility. */
    applyNow: function (reason) { scheduler.execute(reason || 'api-now', true); },

    /** Schedule a debounced async re-apply — preferred over refresh(). */
    schedule: function (reason) { scheduler.schedule(reason || 'api-async'); },

    isHelperPage: isHelperPage,

    stats: function () { return { scheduler: scheduler.stats(), last: lastSummary }; },

    diagnose: function () {
      return {
        version: CONFIG.version,
        helper: isHelperPage(),
        stickyBars: safeQueryAll(doc, CONFIG.selectors.stickyBar).length,
        mirrors: safeQueryAll(doc, CONFIG.selectors.mirror).length,
        actionBars: safeQueryAll(doc, CONFIG.selectors.actionBar).length,
        stylesInjected: !!doc.getElementById(STYLE_ID),
        stickyClass: html.classList.contains('sdlg-has-portal-sticky'),
        scheduler: scheduler.stats()
      };
    },

    destroy: function () { scheduler.destroy(); emit('destroy'); }
  };

  if (CONFIG.exposeInternals) {
    api._internals = { config: CONFIG, applyAll: applyAll, cleanStickyBars: cleanStickyBars };
  }

  // Graceful upgrade warning
  if (win.SDLGUIConsolidate && win.SDLGUIConsolidate.version &&
      parseInt(win.SDLGUIConsolidate.version, 10) < 2) {
    log.warn('upgrading from v' + win.SDLGUIConsolidate.version +
             ' — stale timers/observers from old version may linger');
  }

  win.SDLGUIConsolidate = api;

  // ── Boot ──────────────────────────────────────────────────────────────
  function boot() {
    try {
      injectStyles();
      try { html.setAttribute('data-sdlg-consolidate', CONFIG.version); } catch (_) {}
      scheduler.start();
      log.info('booted v' + CONFIG.version);
      emit('boot', { version: CONFIG.version });
    } catch (e) { log.error('boot failed', e); }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})(typeof window !== 'undefined' ? window : this);