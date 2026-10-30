/**
 * sdlg-hash-router v1.0 — minimal real hash router (tab navigation)
 * Works with sdlg-hash-tab-bridge; safe on login page (no aggressive observers).
 * Routes: #/overview #/claims #/claim/:id #/new-claim #/sdlg-input #/master-data
 */
(function (root) {
  'use strict';
  if (root.__SDLG_HASH_ROUTER_V1__) return;
  root.__SDLG_HASH_ROUTER_V1__ = true;

  var TAB_PATH = {
    dashboard: '/overview',
    list: '/claims',
    paste: '/new-claim',
    sdlginput: '/sdlg-input',
    masters: '/master-data',
    quality: '/data-quality',
    unit360: '/unit360'
  };

  var PATH_TAB = {
    overview: 'dashboard',
    dashboard: 'dashboard',
    claims: 'list',
    list: 'list',
    'new-claim': 'paste',
    paste: 'paste',
    'sdlg-input': 'sdlginput',
    sdlginput: 'sdlginput',
    'master-data': 'masters',
    master: 'masters',
    masters: 'masters',
    'data-quality': 'quality',
    quality: 'quality',
    unit360: 'unit360',
    unit: 'unit360'
  };

  function debugLog() {
    try {
      if (!isDebug()) return;
      console.info.apply(console, ['[SDLG hash-router]'].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function isDebug() {
    try {
      if (/[?&]debug=1(?:&|$)/.test(String(root.location && root.location.search))) return true;
      if (root.localStorage && root.localStorage.getItem('sdlg-debug') === '1') return true;
    } catch (_) {}
    return false;
  }

  function onLoginPage() {
    try {
      return !!(root.document && root.document.querySelector('main.login-screen, .login-screen, body > .card form#f'));
    } catch (_) {
      return false;
    }
  }

  function rawHash() {
    return String((root.location && root.location.hash) || '');
  }

  function normalizePath(hash) {
    var h = String(hash == null ? rawHash() : hash).replace(/^#/, '');
    if (h.charAt(0) !== '/') h = '/' + h;
    return h.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  function parse(hash) {
    var path = normalizePath(hash);
    var parts = path.replace(/^\//, '').split('/').filter(Boolean);
    var head = (parts[0] || 'claims').toLowerCase();
    var detailId = null;
    var tab = 'list';

    if (head === 'claim' && parts[1]) {
      tab = 'list';
      detailId = decodeURIComponent(parts[1]);
    } else if (head === 'claims' && parts[1] && !/^\d{4}$/.test(parts[1])) {
      tab = 'list';
      detailId = decodeURIComponent(parts[1]);
    } else if (PATH_TAB[head]) {
      tab = PATH_TAB[head];
    }

    return {
      path: path,
      tab: tab,
      detailId: detailId,
      segments: parts
    };
  }

  function buildHash(target) {
    if (target == null) return '#/claims';
    if (typeof target === 'string') {
      var s = target.trim();
      if (!s) return '#/claims';
      if (s.charAt(0) === '#') return s;
      if (s.charAt(0) === '/') return '#' + s;
      if (TAB_PATH[s]) return '#' + TAB_PATH[s];
      return '#/' + s.replace(/^\//, '');
    }
    if (typeof target === 'object') {
      if (target.detailId) {
        return '#/claim/' + encodeURIComponent(String(target.detailId));
      }
      if (target.tab && TAB_PATH[target.tab]) return '#' + TAB_PATH[target.tab];
      if (target.path) return buildHash(String(target.path));
    }
    return '#/claims';
  }

  function navigate(target, opts) {
    opts = opts || {};
    if (onLoginPage() && !opts.force) {
      debugLog('navigate skipped on login page');
      return parse();
    }
    var next = buildHash(target);
    var cur = rawHash() || '#';
    if (cur === next || cur === next.replace(/^#/, '#')) {
      return parse(next);
    }
    try {
      if (opts.replace !== false && root.history && root.history.replaceState) {
        root.history.replaceState(null, '', (root.location.pathname || '') + (root.location.search || '') + next);
        try {
          root.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (_) {
          try {
            root.dispatchEvent(new Event('hashchange'));
          } catch (__) {}
        }
      } else {
        root.location.hash = next.replace(/^#/, '');
      }
    } catch (err) {
      debugLog('navigate error', err && err.message);
      try {
        root.location.hash = next.replace(/^#/, '');
      } catch (_) {}
    }
    var state = parse(next);
    emit(state);
    return state;
  }

  var listeners = [];

  function emit(state) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](state);
      } catch (_) {}
    }
    try {
      root.dispatchEvent(
        new CustomEvent('sdlg-route-change', { detail: state })
      );
    } catch (_) {}
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    listeners.push(cb);
    return function unsubscribe() {
      listeners = listeners.filter(function (fn) {
        return fn !== cb;
      });
    };
  }

  function onHashChange() {
    if (onLoginPage()) return;
    emit(parse());
  }

  function boot() {
    root.addEventListener('hashchange', onHashChange);
    debugLog('ready', parse());
  }

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  root.SDLGHashRouter = {
    version: '1.0.0-minimal',
    parse: parse,
    navigate: navigate,
    current: function () {
      return parse();
    },
    onChange: onChange,
    tabPath: TAB_PATH,
    isDebug: isDebug
  };
})(typeof window !== 'undefined' ? window : globalThis);
