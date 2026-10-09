/**
 * SDLG Input empty-state guard v1.0
 * If SDLG Input is active but neither form nor claim picker is visible, show recovery UI.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_INPUT_EMPTY_GUARD_V1__) return;
  root.__SDLG_INPUT_EMPTY_GUARD_V1__ = true;

  function isSdlgInputTab() {
    try {
      var h = String(location.hash || '');
      if (/#\/?sdlg-input|#\/?sdlginput/i.test(h)) return true;
    } catch (_) {}
    try {
      var t = localStorage.getItem('sdlg-warranty:last-tab:v1:guest');
      if (t === 'sdlginput') return true;
    } catch (_) {}
    var page = document.querySelector('.page');
    if (page && /SDLG Input Helper|Warranty Claim Input Helper|SDLG DEALER PORTAL/i.test(page.textContent || '')) {
      // only if nav also suggests input — avoid false positive on other pages
      if (/#\/?sdlg-input|#\/?sdlginput/i.test(String(location.hash || ''))) return true;
    }
    return /#\/?sdlg-input|#\/?sdlginput/i.test(String(location.hash || ''));
  }

  function hasHelperContent() {
    if (document.querySelector('[data-sdlg-input-helper] [data-sdlg-field], [data-sdlg-input-helper] [data-sdlg-copy]')) return true;
    if (document.querySelector('.page input[placeholder*="Cari Claim"], .page select[size]')) return true;
    if (document.querySelector('.page #sdlg_serviceType, .page [data-label="Service Type"]')) return true;
    var page = document.querySelector('.page');
    if (!page) return false;
    var title = page.querySelector('.page-title');
    if (title && /Input Helper/i.test(title.textContent || '')) {
      if (page.querySelector('select, input[type="text"], textarea, [data-sdlg-field]')) return true;
    }
    return false;
  }

  function removeGuard() {
    var g = document.getElementById('sdlg-input-empty-guard');
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }

  function injectGuard() {
    if (!isSdlgInputTab()) { removeGuard(); return; }
    if (hasHelperContent()) { removeGuard(); return; }

    var page = document.querySelector('.page') || document.querySelector('#root') || document.body;
    if (!page) return;
    if (document.getElementById('sdlg-input-empty-guard')) return;

    var claimId = '';
    try {
      claimId = localStorage.getItem('sdlg-warranty:last-sdlginput-claim:v1') ||
        localStorage.getItem('sdlg-warranty:last-claim:v1') || '';
    } catch (_) {}

    var box = document.createElement('div');
    box.id = 'sdlg-input-empty-guard';
    box.setAttribute('role', 'status');
    box.style.cssText =
      'max-width:640px;margin:24px auto;padding:20px 22px;border:1px solid #cbd5e1;border-radius:12px;' +
      'background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.06);font-family:system-ui,sans-serif';
    box.innerHTML =
      '<div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px">SDLG Dealer Portal</div>' +
      '<div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:8px">SDLG Input Helper</div>' +
      '<p style="font-size:13px;color:#475569;line-height:1.5;margin:0 0 14px">' +
      (claimId
        ? ('Claim <b style="font-family:monospace">' + String(claimId).replace(/[<>&]/g, '') + '</b> belum termuat. Buka tab <b>Claims</b>, klik klaim itu, lalu tekan <b>SDLG Input</b> lagi.')
        : 'Belum ada claim yang dipilih. Buka tab <b>Claims</b> → klik satu klaim → tombol <b>SDLG Input</b>.') +
      '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<button type="button" data-go-claims style="border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer;background:#1e40af;color:#fff">Buka Claims</button>' +
      '<button type="button" data-reload style="border:1px solid #cbd5e1;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer;background:#fff;color:#0f172a">Muat ulang</button>' +
      '</div>';
    page.appendChild(box);

    var go = box.querySelector('[data-go-claims]');
    if (go) {
      go.addEventListener('click', function () {
        try {
          if (root.SDLGHashRouter && root.SDLGHashRouter.navigate) root.SDLGHashRouter.navigate('claims');
          else location.hash = '#/claims';
        } catch (_) { location.hash = '#/claims'; }
        document.querySelectorAll('button, a').forEach(function (el) {
          if (/^Claims/i.test(String(el.textContent || '').trim())) el.click();
        });
      });
    }
    var rel = box.querySelector('[data-reload]');
    if (rel) rel.addEventListener('click', function () { location.reload(); });
  }

  function tick() {
    try { injectGuard(); } catch (e) { console.warn('[SDLG input-empty-guard]', e); }
  }

  function boot() {
    tick();
    setInterval(tick, 1500);
    root.addEventListener('hashchange', function () { setTimeout(tick, 200); });
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(tick, 400);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window);
