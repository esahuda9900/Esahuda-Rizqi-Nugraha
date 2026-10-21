/**
 * SDLG Policy Runtime Recovery — V4.0 (Resilient Policy Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V4.0:
 * ✅ XPATH SELECTOR: Ngehapus banner spesifik tanpa scan DOM.
 * ✅ MUTATION OBSERVER: Ganti setInterval 10x jadi event-driven.
 * ✅ DARK MODE READY: Style "DB Verified" dipindah ke class.
 * ✅ SDLGNOTIFY: Notif sukses pas policy berhasil pulih.
 * ✅ ZERO LAYOUT THRASHING: Anti crash React.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__SDLG_POLICY_RUNTIME_FIX_V4__) return;
  window.__SDLG_POLICY_RUNTIME_FIX_V4__ = true;
  window.__SDLG_POLICY_RUNTIME_FIX_V3__ = true; // Backward compat

  var REQUIRED = [
    'CLAIM_SUBMIT_TARGET_10D',
    'CLAIM_SUBMIT_MAX_90D',
    'PHYSICAL_CONCLUSION_30D',
    'SETTLEMENT_6M',
    'MANDATORY_MAINTENANCE_10BD'
  ];
  var COLS = 'rule_code,target_days,threshold_days,deadline_days,calculation';
  var RELOAD_KEY = 'sdlg-policy-runtime-recovered-v4';
  
  var running = false;
  var recovered = false;
  var attempts = 0;
  var MAX_ATTEMPTS = 5;

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES & STYLES
  // ─────────────────────────────────────────────────────────
  function getClient() {
    if (typeof window.getSdlgSupabase === 'function') return window.getSdlgSupabase();
    return window.sdlgSupabase || window.supabaseClient || null;
  }

  function injectStyles() {
    if (document.getElementById('sdlg-policy-recovery-styles')) return;
    var s = document.createElement('style');
    s.id = 'sdlg-policy-recovery-styles';
    s.textContent = `
      .sdlg-policy-verified {
        color: #059669 !important;
        background: #ecfdf5 !important;
        border-color: #a7f3d0 !important;
        font-weight: 700 !important;
      }
      @media (prefers-color-scheme: dark) {
        .sdlg-policy-verified {
          color: #86efac !important;
          background: rgba(22,163,74,0.2) !important;
          border-color: rgba(22,163,74,0.4) !important;
        }
      }
      .sdlg-hidden-policy-banner { display: none !important; }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // 2. APPLY DATA KE WINDOW OBJECT
  // ─────────────────────────────────────────────────────────
  function applyRows(rows) {
    var by = {};
    (rows || []).forEach(function (r) {
      if (r && r.rule_code) by[String(r.rule_code).trim()] = r;
    });
    
    var missing = REQUIRED.filter(function (code) { return !by[code]; });
    if (missing.length) return { ok: false, missing: missing };

    var policy = window.SDLG_POLICY;
    if (!policy || typeof policy !== 'object') {
      window.SDLG_POLICY = policy = {};
    }

    function num(code, field, fallback) {
      var v = Number(by[code] && by[code][field] != null ? by[code][field] : fallback);
      return v || fallback;
    }

    policy.claimSubmitDays = num('CLAIM_SUBMIT_TARGET_10D', 'target_days', policy.claimSubmitDays || 10);
    policy.claimGeneralWindowDays = num('CLAIM_SUBMIT_MAX_90D', 'threshold_days', policy.claimGeneralWindowDays || 90);
    policy.physicalConclusionDays = num('PHYSICAL_CONCLUSION_30D', 'target_days', policy.physicalConclusionDays || 30);
    policy.maintenanceEvidenceBusinessDays = num('MANDATORY_MAINTENANCE_10BD', 'deadline_days', policy.maintenanceEvidenceBusinessDays || 10);
    
    try {
      var calc = by.SETTLEMENT_6M && by.SETTLEMENT_6M.calculation;
      if (calc && typeof calc === 'object' && calc.cycle_months != null) {
        policy.settlementCycleMonths = Number(calc.cycle_months) || policy.settlementCycleMonths || 6;
      }
    } catch (_) {}
    
    policy.source = 'database';
    policy.runtimeStatus = 'verified';
    return { ok: true, missing: [] };
  }

  // ─────────────────────────────────────────────────────────
  // 3. SMART DOM CLEANER (XPath - Super Cepat)
  // ─────────────────────────────────────────────────────────
  function cleanDegradedUI() {
    try {
      // A. Hapus Banner (pakai XPath biar cepet)
      var xpath = "//*[contains(text(), 'Policy Runtime Degraded')]";
      var result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      
      for (var i = 0; i < result.snapshotLength; i++) {
        var el = result.snapshotItem(i);
        // Cari parent yang layak dihapus (biasanya div container banner)
        var wrap = el.closest('div.banner, div.alert, section.alert, .card') || el.parentElement;
        if (wrap && !wrap.classList.contains('sdlg-hidden-policy-banner')) {
          wrap.classList.add('sdlg-hidden-policy-banner'); // Sembunyiin pake CSS (aman buat React)
        }
      }

      // B. Ubah Chip "Degraded" jadi "DB Verified"
      var chips = document.querySelectorAll('.topbar *, [class*="badge"], [class*="chip"], span, button');
      for (var j = 0; j < chips.length; j++) {
        var c = chips[j];
        var ct = (c.textContent || '').trim();
        if (ct === 'Degraded' || ct === 'DEGRADED' || /^Policy:\s*Degraded$/i.test(ct)) {
          c.textContent = ct.indexOf('Policy') === 0 ? 'Policy: DB Verified' : 'DB Verified';
          c.classList.add('sdlg-policy-verified');
        }
      }
    } catch (_) {}
  }

  function isDegradedVisible() {
    try {
      var text = (document.body && document.body.innerText) || '';
      return text.indexOf('Policy Runtime Degraded') !== -1 || /Policy:\s*Degraded/i.test(text);
    } catch (_) { return false; }
  }

  function notifyRecovered() {
    window.dispatchEvent(new CustomEvent('sdlg-policy-recovered', { detail: { source: 'database', at: Date.now() } }));
    if (window.SDLGNotify) {
      window.SDLGNotify.success('Policy Restored', 'Koneksi database pulih. Aturan policy berhasil dimuat.');
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. RECOVERY ENGINE
  // ─────────────────────────────────────────────────────────
  async function recover(reason) {
    if (recovered || running || attempts >= MAX_ATTEMPTS) {
      if (recovered) cleanDegradedUI();
      return;
    }
    
    running = true;
    attempts += 1;
    
    try {
      var client = getClient();
      if (!client) return;

      var data = null;
      
      // Coba lewat helper query
      if (typeof window.SDLGPolicyRulesQuery === 'function') {
        var result = await window.SDLGPolicyRulesQuery(client, COLS, REQUIRED);
        if (result && !result.deferred && !result.error) data = Array.isArray(result.data) ? result.data : [];
      }
      
      // Fallback: Direct read
      if ((!data || !data.length) && client.from) {
        var q = await client.from('service_policy_rules').select(COLS).in('rule_code', REQUIRED);
        if (!q.error && Array.isArray(q.data)) data = q.data;
      }
      
      if (!data || !data.length) return;

      var applied = applyRows(data);
      if (!applied.ok) return;

      recovered = true;
      cleanDegradedUI();
      notifyRecovered();

      // Pasang observer buat nangkep kalau React render ulang banner-nya
      setupAntiDegradedObserver();

      // Fallback reload (cuma sekali per session)
      if (isDegradedVisible()) {
        setTimeout(function () {
          cleanDegradedUI();
          if (!isDegradedVisible()) return;
          try {
            if (!sessionStorage.getItem(RELOAD_KEY)) {
              sessionStorage.setItem(RELOAD_KEY, String(reason || '1'));
              location.reload();
            }
          } catch (_) {}
        }, 1200);
      }
    } catch (_) {
      // non-fatal
    } finally {
      running = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. ANTI-DEGRADED OBSERVER (Ganti setInterval)
  // ─────────────────────────────────────────────────────────
  function setupAntiDegradedObserver() {
    if (window.__SDLG_POLICY_OBS__) return;
    
    var debounce;
    var obs = new MutationObserver(function () {
      if (!isDegradedVisible()) return; // Cepet balik kalau gak ada teks
      
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        cleanDegradedUI();
      }, 100);
    });
    
    obs.observe(document.body, { childList: true, subtree: true });
    window.__SDLG_POLICY_OBS__ = obs;
    
    // Matiin observer setelah 10 detik (biasanya React udah stabil)
    setTimeout(function () {
      obs.disconnect();
      window.__SDLG_POLICY_OBS__ = null;
    }, 10000);
  }

  // ─────────────────────────────────────────────────────────
  // 6. AUTH BINDING
  // ─────────────────────────────────────────────────────────
  function scheduleRecover(reason, delay) {
    setTimeout(function () {
      recover(reason).then(function () {
        if (!recovered && attempts < MAX_ATTEMPTS) {
          scheduleRecover(reason + '-retry', 600);
        }
      });
    }, delay || 200);
  }

  function bindAuth() {
    var client = getClient();
    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== 'function') {
      setTimeout(bindAuth, 300); // Retry kalau client belum siap
      return;
    }

    client.auth.onAuthStateChange(function (event, session) {
      if (!session) {
        recovered = false;
        attempts = 0;
        return;
      }
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') return;
      scheduleRecover(event, event === 'INITIAL_SESSION' ? 400 : 120);
    });

    client.auth.getSession().then(function (res) {
      if (res && res.data && res.data.session) scheduleRecover('eager', 250);
    }).catch(function () {});
  }

  // ─────────────────────────────────────────────────────────
  // 7. BOOT
  // ─────────────────────────────────────────────────────────
  injectStyles();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAuth, { once: true });
  } else {
    bindAuth();
  }

})();