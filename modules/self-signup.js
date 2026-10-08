/**
 * SDLG self-signup + pending approval UX
 * - "Belum punya akun? Buat akun" ONLY on the login screen
 * - Never mounts on authenticated app pages
 * Relative module paths for GitHub Project Pages.
 */
(function () {
  'use strict';

  var MODE_LOGIN = 'login';
  var MODE_SIGNUP = 'signup';
  var mode = MODE_LOGIN;
  var mounted = false;

  function $(sel, root) {
    try { return (root || document).querySelector(sel); } catch (_) { return null; }
  }

  function text(el, v) {
    if (el) el.textContent = v;
  }

  function getSupabase() {
    var c = window.sdlgSupabase || window.supabaseClient || (window.SDLG && window.SDLG.supabase);
    if (c && c.auth) return c;
    if (window.supabase && window.supabase.auth && typeof window.supabase.auth.signUp === 'function' && window.supabase.from) {
      return window.supabase;
    }
    return c || null;
  }

  function hasAppChrome() {
    var t = (document.body && document.body.innerText) || '';
    return /(Master Dashboard|Claims ·|New Claim|SDLG Input|Unit 360|Data Quality)/.test(t);
  }

  function hasLiveSessionToken() {
    try {
      var keys = Object.keys(localStorage || {});
      for (var i = 0; i < keys.length; i++) {
        if (/auth-token|sb-.*-auth/i.test(keys[i])) {
          var raw = localStorage.getItem(keys[i]);
          if (raw && /access_token/.test(raw) && /"expires_at"|expires_at/.test(raw)) {
            return true;
          }
          if (raw && /access_token/.test(raw)) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function isLoginScreenVisible() {
    var login = $('.login-screen, [class*="login-screen"], [data-sdlg-login="1"], .login-layout, .login-card');
    if (login) {
      try {
        var style = window.getComputedStyle ? window.getComputedStyle(login) : null;
        if (style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          return true;
        }
      } catch (_) {
        return true;
      }
    }
    var pwd = $('input[type="password"]');
    if (pwd && !hasAppChrome()) return true;
    if (hasAppChrome()) return false;
    if (pwd) return true;
    if (hasLiveSessionToken()) return false;
    return false;
  }

  function removePanel() {
    var panel = document.getElementById('sdlg-self-signup-panel');
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    mounted = false;
  }

  function findLoginShell() {
    var shell =
      $('.login-screen') ||
      $('[class*="login-screen"]') ||
      $('[data-sdlg-login="1"]') ||
      $('.login-layout') ||
      $('.login-card') ||
      $('[class*="login-layout"]') ||
      $('[class*="login-card"]');
    if (shell) return shell;

    var form = $('form');
    var pwd = $('input[type="password"]');
    var anchor = form || (pwd && pwd.closest ? pwd.closest('form, section, main, div') : null) || pwd;
    if (!anchor) return null;
    var el = anchor;
    for (var i = 0; i < 6 && el; i++) {
      if (el.classList && (el.classList.contains('login-card') || /login/i.test(el.className || ''))) return el;
      if (el.tagName === 'FORM' && el.parentNode) return el.parentNode;
      el = el.parentNode;
    }
    return form ? form.parentNode : (pwd && pwd.parentNode) || null;
  }

  function ensurePanel() {
    if (!isLoginScreenVisible()) {
      removePanel();
      return null;
    }
    var existing = document.getElementById('sdlg-self-signup-panel');
    if (existing) return existing;

    var shell = findLoginShell();
    if (!shell) return null;

    var panel = document.createElement('div');
    panel.id = 'sdlg-self-signup-panel';
    panel.setAttribute('data-sdlg-self-signup', '1');
    panel.style.cssText = 'max-width:420px;margin:16px auto 0;padding:0 4px;font-family:inherit;font-size:13px;line-height:1.45;color:#334155';

    panel.innerHTML = [
      '<div id="sdlg-signup-toggle-wrap" style="text-align:center;margin-bottom:10px">',
      '  <button type="button" id="sdlg-toggle-signup" style="background:none;border:none;color:#2563eb;cursor:pointer;font-size:13px;text-decoration:underline;padding:4px 8px">',
      '    Belum punya akun? Buat akun',
      '  </button>',
      '</div>',
      '<div id="sdlg-signup-form" style="display:none;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#f8fafc">',
      '  <div style="font-weight:700;margin-bottom:6px;color:#0f172a">Buat akun baru</div>',
      '  <div style="font-size:12px;color:#64748b;margin-bottom:12px">',
      '    Setelah daftar, akun menunggu konfirmasi admin. Role default: <b>viewer</b>.',
      '  </div>',
      '  <label style="display:block;font-size:12px;margin-bottom:4px">Email perusahaan</label>',
      '  <input id="sdlg-signup-email" type="email" autocomplete="username" placeholder="nama@perusahaan.com" ',
      '    style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:10px;font:inherit" />',
      '  <label style="display:block;font-size:12px;margin-bottom:4px">Password (min. 12 karakter)</label>',
      '  <input id="sdlg-signup-password" type="password" autocomplete="new-password" placeholder="Minimal 12 karakter" ',
      '    style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:10px;font:inherit" />',
      '  <label style="display:block;font-size:12px;margin-bottom:4px">Ulangi password</label>',
      '  <input id="sdlg-signup-password2" type="password" autocomplete="new-password" placeholder="Ulangi password" ',
      '    style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;font:inherit" />',
      '  <button type="button" id="sdlg-signup-submit" ',
      '    style="width:100%;padding:10px 14px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;font:inherit">',
      '    Daftar',
      '  </button>',
      '  <div id="sdlg-signup-msg" style="margin-top:10px;font-size:12px;white-space:pre-wrap"></div>',
      '  <div style="text-align:center;margin-top:10px">',
      '    <button type="button" id="sdlg-back-login" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:12px;text-decoration:underline">',
      '      Kembali ke login',
      '    </button>',
      '  </div>',
      '</div>',
      '<div id="sdlg-pending-banner" style="display:none;margin-top:12px;padding:12px 14px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px"></div>'
    ].join('');

    var form = shell.querySelector ? shell.querySelector('form') : null;
    if (form && form.parentNode) {
      form.parentNode.insertBefore(panel, form.nextSibling);
    } else if (shell.appendChild) {
      shell.appendChild(panel);
    } else {
      return null;
    }
    return panel;
  }

  function setMode(next) {
    mode = next;
    var form = document.getElementById('sdlg-signup-form');
    var toggle = document.getElementById('sdlg-toggle-signup');
    if (!form) return;
    if (mode === MODE_SIGNUP) {
      form.style.display = 'block';
      if (toggle) toggle.style.display = 'none';
    } else {
      form.style.display = 'none';
      if (toggle) {
        toggle.style.display = 'inline';
        text(toggle, 'Belum punya akun? Buat akun');
      }
    }
  }

  function showMsg(msg, isError) {
    var el = document.getElementById('sdlg-signup-msg');
    if (!el) return;
    el.style.color = isError ? '#b91c1c' : '#166534';
    el.textContent = msg || '';
  }

  function showPending(msg) {
    if (!isLoginScreenVisible()) return;
    ensurePanel();
    var el = document.getElementById('sdlg-pending-banner');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = msg || 'Akun Anda menunggu konfirmasi admin.';
  }

  async function doSignUp() {
    var emailEl = document.getElementById('sdlg-signup-email');
    var passEl = document.getElementById('sdlg-signup-password');
    var pass2El = document.getElementById('sdlg-signup-password2');
    var btn = document.getElementById('sdlg-signup-submit');
    var email = (emailEl && emailEl.value || '').trim();
    var pass = passEl && passEl.value || '';
    var pass2 = pass2El && pass2El.value || '';

    if (!email || email.indexOf('@') < 1) { showMsg('Email tidak valid.', true); return; }
    if (pass.length < 12) { showMsg('Password minimal 12 karakter.', true); return; }
    if (pass !== pass2) { showMsg('Password tidak sama.', true); return; }

    var sb = getSupabase();
    if (!sb || !sb.auth || typeof sb.auth.signUp !== 'function') {
      showMsg('Supabase client belum siap. Refresh halaman lalu coba lagi.', true);
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Mendaftarkan…'; }
    showMsg('Sedang mendaftarkan…', false);

    try {
      var result = await sb.auth.signUp({ email: email, password: pass });
      if (result.error) throw result.error;
      try { if (result.data && result.data.session) await sb.auth.signOut(); } catch (_) {}
      showMsg('Pendaftaran berhasil.\n\nAkun Anda menunggu konfirmasi admin.\nRole default: viewer. Setelah diaktifkan, Anda bisa login normal.', false);
      setMode(MODE_LOGIN);
      showPending('Akun baru menunggu konfirmasi admin. Hubungi administrator PT. Indo Traktor Utama.');
    } catch (err) {
      var m = (err && (err.message || err.error_description)) || String(err);
      if (/signups not allowed|signup.*disabled|not allowed/i.test(m)) {
        m = 'Pendaftaran publik belum diaktifkan di Supabase Auth.\nAdmin: Authentication → Settings → Allow new users to sign up.';
      }
      showMsg(m, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Daftar'; }
    }
  }

  async function enforceActiveRole(sb) {
    try {
      var sessionRes = await sb.auth.getSession();
      var session = sessionRes && sessionRes.data && sessionRes.data.session;
      if (!session || !session.user) { syncPanelVisibility(); return; }
      removePanel();
      var uid = session.user.id;
      var q = await sb.from('app_user_roles').select('role,is_active,display_name').eq('user_id', uid).maybeSingle();
      if (q.error) return;
      var row = q.data;
      if (!row) {
        await new Promise(function (r) { setTimeout(r, 800); });
        q = await sb.from('app_user_roles').select('role,is_active,display_name').eq('user_id', uid).maybeSingle();
        row = q.data;
      }
      if (!row || row.is_active !== true) {
        try { await sb.auth.signOut(); } catch (_) {}
        syncPanelVisibility();
        showPending('Akun Anda belum diaktifkan oleh admin.\nRole akan menjadi viewer setelah dikonfirmasi. Hubungi administrator.');
      }
    } catch (_) {}
  }

  function bind() {
    if (!isLoginScreenVisible()) { removePanel(); return; }
    var panel = ensurePanel();
    if (!panel || mounted) return;
    mounted = true;
    var t = document.getElementById('sdlg-toggle-signup');
    var back = document.getElementById('sdlg-back-login');
    var sub = document.getElementById('sdlg-signup-submit');
    if (t) t.addEventListener('click', function () { setMode(MODE_SIGNUP); showMsg('', false); });
    if (back) back.addEventListener('click', function () { setMode(MODE_LOGIN); showMsg('', false); });
    if (sub) sub.addEventListener('click', function () { doSignUp(); });
  }

  function syncPanelVisibility() {
    if (isLoginScreenVisible()) bind();
    else removePanel();
  }

  function boot() {
    syncPanelVisibility();
    var sb = getSupabase();
    if (sb && sb.auth) {
      enforceActiveRole(sb);
      try {
        sb.auth.onAuthStateChange(function (event) {
          if (event === 'SIGNED_IN') { removePanel(); enforceActiveRole(sb); }
          else if (event === 'SIGNED_OUT') { mounted = false; syncPanelVisibility(); }
        });
      } catch (_) {}
    }
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
    var n = 0;
    var iv = setInterval(function () {
      n += 1;
      syncPanelVisibility();
      if (n > 60) clearInterval(iv);
    }, 250);
  }

  whenReady(boot);
  window.SDLGSelfSignup = { boot: boot, enforceActiveRole: enforceActiveRole, sync: syncPanelVisibility };

  (function loadFeedbackPersonFix() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('script[data-sdlg-fb-person-fix]')) return;
    var s = document.createElement('script');
    s.src = './modules/feedback-person-fix.js';
    s.async = true;
    s.setAttribute('data-sdlg-fb-person-fix', '1');
    (document.head || document.documentElement).appendChild(s);
  })();

  (function loadMachine360() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('script[data-sdlg-machine-360]')) return;
    var s = document.createElement('script');
    s.src = './modules/machine-360.js';
    s.async = true;
    s.setAttribute('data-sdlg-machine-360', '1');
    (document.head || document.documentElement).appendChild(s);
  })();
})();
