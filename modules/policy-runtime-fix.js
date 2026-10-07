/**
 * Policy runtime recovery v3 — fixes false DEGRADED after auth race.
 *
 * React loadPolicyRuntime may run before session hydrates and stick on DEGRADED.
 * This module recovers after auth events: applies DB rules into window.SDLG_POLICY,
 * clears degraded UI (banner + topbar chip), and dispatches sdlg-policy-recovered.
 * Soft reload is last resort only (once per session) when React state still shows degraded.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__SDLG_POLICY_RUNTIME_FIX_V3__) return;
  window.__SDLG_POLICY_RUNTIME_FIX_V3__ = true;
  // Allow re-bind if an older v2 flag was set in the same page load.
  window.__SDLG_POLICY_RUNTIME_FIX_V2__ = true;

  var REQUIRED = [
    'CLAIM_SUBMIT_TARGET_10D',
    'CLAIM_SUBMIT_MAX_90D',
    'PHYSICAL_CONCLUSION_30D',
    'SETTLEMENT_6M',
    'MANDATORY_MAINTENANCE_10BD'
  ];
  var COLS = 'rule_code,target_days,threshold_days,deadline_days,calculation';
  var RELOAD_KEY = 'sdlg-policy-runtime-recovered-v3';
  var running = false;
  var recovered = false;
  var attempts = 0;
  var MAX_ATTEMPTS = 8;

  function getClient() {
    return window.sdlgSupabase || window.supabaseClient || window.supabase || null;
  }

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
    policy.maintenanceEvidenceBusinessDays = num(
      'MANDATORY_MAINTENANCE_10BD',
      'deadline_days',
      policy.maintenanceEvidenceBusinessDays || 10
    );
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

  function clearDegradedUi() {
    try {
      // Banner / alert containing Policy Runtime Degraded
      var nodes = document.querySelectorAll('div, section, aside, p, span');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var t = (el.textContent || '').trim();
        if (!t || t.length > 600) continue;
        if (t.indexOf('Policy Runtime Degraded') === -1) continue;
        // Prefer removing the outermost banner-like ancestor
        var wrap = el;
        for (var up = 0; up < 4 && wrap.parentElement; up++) {
          var parentText = (wrap.parentElement.textContent || '').trim();
          if (parentText.indexOf('Policy Runtime Degraded') !== -1 && parentText.length < 800) {
            wrap = wrap.parentElement;
          } else break;
        }
        if (wrap && wrap.parentElement) {
          wrap.parentElement.removeChild(wrap);
        }
      }

      // Topbar / chip: "Policy: Degraded" or standalone Degraded
      var chips = document.querySelectorAll('.topbar *, [class*="badge"], [class*="chip"], span, button');
      for (var j = 0; j < chips.length; j++) {
        var c = chips[j];
        var ct = (c.textContent || '').trim();
        if (ct === 'Degraded' || ct === 'DEGRADED' || /^Policy:\s*Degraded$/i.test(ct)) {
          c.textContent = ct.indexOf('Policy') === 0 ? 'Policy: DB Verified' : 'DB Verified';
          try {
            c.style.color = '#059669';
            c.style.background = '#ecfdf5';
          } catch (_) {}
        }
        // Title fragment in topbar: "Policy: Degraded"
        if (/Policy:\s*Degraded/i.test(ct) && ct.length < 80) {
          c.textContent = ct.replace(/Policy:\s*Degraded/i, 'Policy: DB Verified');
        }
      }
    } catch (_) {}
  }

  function isDegradedVisible() {
    try {
      var text = (document.body && document.body.innerText) || '';
      return text.indexOf('Policy Runtime Degraded') !== -1 || /Policy:\s*Degraded/i.test(text);
    } catch (_) {
      return false;
    }
  }

  function notifyRecovered() {
    try {
      window.dispatchEvent(
        new CustomEvent('sdlg-policy-recovered', {
          detail: { source: 'database', at: Date.now() }
        })
      );
    } catch (_) {}
  }

  async function recover(reason) {
    if (recovered) {
      clearDegradedUi();
      return;
    }
    if (running) return;
    if (attempts >= MAX_ATTEMPTS) return;
    running = true;
    attempts += 1;
    try {
      var client = getClient();
      if (!client) return;

      var data = null;
      if (typeof window.SDLGPolicyRulesQuery === 'function') {
        var result = await window.SDLGPolicyRulesQuery(client, COLS, REQUIRED);
        if (result && !result.deferred && !result.error) {
          data = Array.isArray(result.data) ? result.data : [];
        }
      }
      // Fallback: direct table read when helper not ready yet
      if ((!data || !data.length) && client.from) {
        try {
          var q = await client
            .from('service_policy_rules')
            .select(COLS)
            .in('rule_code', REQUIRED);
          if (!q.error && Array.isArray(q.data)) data = q.data;
        } catch (_) {}
      }
      if (!data || !data.length) return;

      var applied = applyRows(data);
      if (!applied.ok) return;

      recovered = true;
      clearDegradedUi();
      notifyRecovered();

      // Keep clearing if React re-renders the banner briefly
      var sweeps = 0;
      var sweepIv = setInterval(function () {
        clearDegradedUi();
        sweeps += 1;
        if (sweeps >= 10 || !isDegradedVisible()) clearInterval(sweepIv);
      }, 400);

      // Last resort: one soft reload only if banner still stuck after recovery
      if (isDegradedVisible()) {
        setTimeout(function () {
          clearDegradedUi();
          if (!isDegradedVisible()) return;
          try {
            if (!sessionStorage.getItem(RELOAD_KEY)) {
              sessionStorage.setItem(RELOAD_KEY, String(reason || '1'));
              location.reload();
            }
          } catch (_) {}
        }, 1200);
      } else {
        try {
          sessionStorage.removeItem(RELOAD_KEY);
        } catch (_) {}
      }
    } catch (_) {
      // non-fatal — leave fallback policy
    } finally {
      running = false;
    }
  }

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
      setTimeout(bindAuth, 300);
      return;
    }

    client.auth.onAuthStateChange(function (event, session) {
      if (!session) {
        recovered = false;
        attempts = 0;
        return;
      }
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') return;
      var delay = event === 'INITIAL_SESSION' ? 400 : 120;
      scheduleRecover(event, delay);
    });

    client.auth
      .getSession()
      .then(function (res) {
        var session = res && res.data ? res.data.session : null;
        if (session) scheduleRecover('eager', 250);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAuth, { once: true });
  } else {
    bindAuth();
  }
})();
