/**
 * SDLG UI Consolidate v1.1
 * - Kill D365 Portal Mirror (Warranty Claim Form)
 * - Only ONE sticky taskbar on Input Helper
 * - Page padding so sticky never covers content
 */
(function (root) {
  'use strict';
  if (root.__SDLG_UI_CONSOLIDATE_V11__) return;
  root.__SDLG_UI_CONSOLIDATE_V11__ = true;

  function isHelperPage() {
    try {
      if (root.SDLGHashRouter && root.SDLGHashRouter.showBottomTaskbar && !root.SDLGHashRouter.showBottomTaskbar()) {
        return false;
      }
    } catch (_) {}
    var page = document.querySelector('.page[data-sdlg-input-helper], [data-sdlg-input-helper].page, .page');
    if (!page) return false;
    var title = '';
    try { title = String((page.querySelector('.page-title') || {}).textContent || ''); } catch (_) {}
    if (/Warranty Claim Input Helper|SDLG Input Helper/i.test(title)) return true;
    if (page.querySelector('[data-sdlg-copy-all]')) return true;
    if (/#\/?sdlg-input|#\/?sdlginput|#\/?claim\/[^/]+\/input/i.test(String(location.hash || ''))) return true;
    return false;
  }

  function removeDuplicateStickyBars() {
    var bars = document.querySelectorAll('#sdlg-portal-sticky-bar, .sdlg-portal-sticky-bar, [data-sdlg-sticky-bar]');
    if (!bars.length) {
      document.documentElement.classList.remove('sdlg-has-portal-sticky');
      return;
    }
    if (!isHelperPage()) {
      bars.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
      document.documentElement.classList.remove('sdlg-has-portal-sticky');
      return;
    }
    for (var i = 1; i < bars.length; i++) {
      if (bars[i].parentNode) bars[i].parentNode.removeChild(bars[i]);
    }
    var keep = document.getElementById('sdlg-portal-sticky-bar') || document.querySelector('.sdlg-portal-sticky-bar');
    if (keep) {
      keep.id = 'sdlg-portal-sticky-bar';
      keep.classList.add('sdlg-portal-sticky-bar');
      document.documentElement.classList.add('sdlg-has-portal-sticky');
      keep.style.position = 'fixed';
      keep.style.bottom = '0';
      keep.style.left = '0';
      keep.style.right = '0';
      keep.style.zIndex = '99990';
    }
  }

  function removeDuplicateForms() {
    document.querySelectorAll('[data-sdlg-dynamics-mirror], #sdlg-portal-mirror-panel').forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });

    document.querySelectorAll('.page-title, h1, h2, h3, [class*="title"]').forEach(function (el) {
      var t = String(el.textContent || '').trim();
      if (!/^Warranty Claim Form$/i.test(t)) return;
      var section = el.closest('section, .card, [class*="card"], form, .page > div') || el.parentElement;
      if (section && section.parentNode) {
        var page = document.querySelector('.page');
        if (page && page.querySelectorAll('[data-sdlg-copy-all], [data-sdlg-field]').length > 5) {
          section.parentNode.removeChild(section);
        }
      }
    });

    document.querySelectorAll('[id*="action-bar"], [class*="action-bar"], [class*="taskbar"]').forEach(function (el) {
      if (el.id === 'sdlg-portal-sticky-bar') return;
      if (el.closest('#sdlg-portal-sticky-bar')) return;
      var txt = String(el.textContent || '');
      if (/Copy Home Fields|Copy Replacement|Buka SDLG Portal/i.test(txt)) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    });
  }

  function ensurePagePadding() {
    var page = document.querySelector('.page[data-sdlg-input-helper], .page');
    if (!page) return;
    if (isHelperPage() && document.getElementById('sdlg-portal-sticky-bar')) {
      page.style.paddingBottom = '72px';
    } else {
      if (page.style.paddingBottom === '72px') page.style.paddingBottom = '';
    }
  }

  function enhance() {
    try {
      removeDuplicateForms();
      removeDuplicateStickyBars();
      ensurePagePadding();
    } catch (e) {
      console.warn('[SDLG ui-consolidate]', e);
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(enhance, 300);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SDLGUIConsolidate = { version: '1.1.0', refresh: enhance };
})(window);
