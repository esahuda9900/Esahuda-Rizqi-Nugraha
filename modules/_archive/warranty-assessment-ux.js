/**
 * SDLG Warranty Assessment UX v1.4 — fallback only when Tracking UX is unavailable
 *
 * Instant decision-first shell on claim detail; hydrate from Live DB UI when ready.
 * Progressive enhancement only — no engine/DB writes.
 *
 * v1.4 (2026-10-09):
 * - Fix stuck LOADING badge: resolve OUT OF WARRANTY / IN WARRANTY without requiring matrix keywords
 * - Only show LOADING when status not yet ready
 * v1.3 (2026-10-02):
 * - Treat detached Tracking panel as absent (isConnected)
 * - Slightly longer debounce to reduce race with Tracking UX + React
 * - Fix HTML escape
 * - If Tracking module global exists and panel is mid-mount, stay silent
 */
(function () {
  'use strict';

  var PANEL_ID = 'sdlg-warranty-assessment-shell';
  var DEBOUNCE_MS = 480;
  var OBSERVER = null;
  var VERSION = '1.4';

  function textOf(el) {
    if (!el) return '';
    try {
      return String(el.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (_) {
      return '';
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function claimDetailPage() {
    return document.querySelector('.page.claim-detail-page');
  }

  function liveTrackingPanel() {
    var el = document.getElementById('sdlg-tracking-panel');
    if (el && el.isConnected) return el;
    return null;
  }

  function trackingPreferred() {
    if (typeof window !== 'undefined' && window.SDLGTrackingUX) return true;
    return !!liveTrackingPanel();
  }

  function extractStage(page) {
    var tracking = liveTrackingPanel();
    if (tracking) {
      var labels = tracking.querySelectorAll('.sdlg-tracking-panel__label');
      for (var i = 0; i < labels.length; i++) {
        if (/current stage/i.test(textOf(labels[i]))) {
          var val = labels[i].parentElement && labels[i].parentElement.querySelector('.sdlg-tracking-panel__value');
          if (val) return textOf(val).slice(0, 48);
        }
      }
    }
    var badge = page.querySelector('.status-badge, [data-claim-status]');
    if (badge) {
      var t = textOf(badge);
      if (t && !/non-warrant|route/i.test(t)) return t.slice(0, 48);
    }
    var body = textOf(page);
    var m = body.match(/Status terakhir:\s*([^|]{2,40})/i);
    if (m) return m[1].trim();
    return '—';
  }

  function findPolicyCard(page) {
    var cards = page.querySelectorAll('.card.card-pad, .card');
    for (var i = 0; i < cards.length; i++) {
      var t = textOf(cards[i]);
      if (/Policy Decision|WARRANTY COVERAGE|Memuat keputusan policy/i.test(t)) return cards[i];
    }
    return null;
  }

  function extractFromPolicyCard(page) {
    var out = {
      coverage: '',
      component: '',
      risk: '',
      family: '',
      ready: false,
      loading: false
    };
    var card = findPolicyCard(page);
    if (!card) return out;
    var t = textOf(card);
    if (/Memuat keputusan policy/i.test(t) && t.length < 160) {
      out.loading = true;
      return out;
    }
    out.ready = true;
    if (/\bCovered\b/i.test(t)) out.coverage = 'Covered';
    else if (/DATA GAP/i.test(t)) out.coverage = 'DATA GAP';
    else if (/Not Covered|Out of Warranty|OOW/i.test(t)) out.coverage = 'Not Covered';

    var scope = t.match(/Component scope:\s*([^·\n]{2,80})/i);
    if (scope) out.component = scope[1].trim();

    var risk = t.match(/Policy risk:\s*([A-Z]+)/i);
    if (risk) out.risk = risk[1];

    var fam = t.match(/WARRANTY COVERAGE\s+\S+\s+([A-Za-z0-9._-]{2,40})/);
    if (fam) out.family = fam[1];

    return out;
  }

  function extractFromMatrix(page) {
    var out = {
      inWarranty: '',
      category: '',
      limit: '',
      expiry: '',
      ready: false,
      loading: false
    };
    var body = textOf(page);

    if (/\bIN WARRANTY\b/i.test(body)) {
      out.inWarranty = 'IN WARRANTY';
      out.ready = true;
    } else if (/OUT OF WARRANTY|\bOOW\b|Out of Warranty/i.test(body)) {
      out.inWarranty = 'OUT OF WARRANTY';
      out.ready = true;
    }

    // Only show loading when status not yet resolved
    if (!out.ready && /Memuat|Loading/i.test(body) && /matrix|Warranty Policy|policy/i.test(body)) {
      out.loading = true;
    }

    var cat = body.match(/Claim component policy:\s*([^·\n]{3,100})/i);
    if (cat) out.category = cat[1].trim().slice(0, 120);

    var lim = body.match(/(\d+\s*mo\s*\/\s*\d+\s*(?:h(?:m|r)?|HM))/i);
    if (lim) out.limit = lim[1];

    var exp = body.match(/Effective expiry\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    if (exp) out.expiry = exp[1];

    return out;
  }

  function extractHappened(page) {
    var tracking = liveTrackingPanel();
    if (tracking) {
      var labels = tracking.querySelectorAll('.sdlg-tracking-panel__label');
      for (var i = 0; i < labels.length; i++) {
        if (/what happened/i.test(textOf(labels[i]))) {
          var val = labels[i].parentElement && labels[i].parentElement.querySelector('.sdlg-tracking-panel__value');
          if (val) return textOf(val).slice(0, 140);
        }
      }
    }
    return '';
  }

  function nextAction(stage, policy, matrix) {
    if (matrix.inWarranty === 'OUT OF WARRANTY' || /not covered/i.test(policy.coverage)) {
      return 'Not covered — reject & inform Branch; simpan reason + evidence';
    }
    if (policy.coverage === 'DATA GAP' || (policy.loading && !matrix.ready)) {
      return 'Lengkapi unit / part / failure date + HM agar policy resolve';
    }
    var s = String(stage || '').toLowerCase();
    if (/draft/i.test(s)) return 'Continue SDLG workflow — lengkapi report & kirim ke TS/Admin';
    if (/ready to claim/i.test(s)) return 'Submit claim ke SDLG (Dealer Claim No)';
    if (/sdlg audit/i.test(s)) return 'Pantau audit SDLG · catat Approved/Rejected & Settlement';
    if (/reject/i.test(s)) return 'Catat rejection reason + siapkan dispute bila perlu';
    if (/approved|billing|paid/i.test(s)) return 'Proses settlement / invoice / rekonsiliasi sesuai stage';
    if (matrix.inWarranty === 'IN WARRANTY' || /covered/i.test(policy.coverage)) {
      return 'Within warranty — lanjut Approval Code / Warranty WO sesuai stage';
    }
    return 'Lanjutkan sesuai stage · cek Policy Decision & matrix di bawah';
  }

  function routeLabel(policy, matrix) {
    if (matrix.inWarranty === 'IN WARRANTY' || /covered/i.test(policy.coverage)) return 'SDLG';
    if (matrix.inWarranty === 'OUT OF WARRANTY' || /not covered/i.test(policy.coverage)) return 'NON-WARRANTABLE';
    if (policy.coverage === 'DATA GAP') return 'PENDING DATA';
    if (policy.loading || matrix.loading) return '…';
    return '—';
  }

  function statusBadge(policy, matrix) {
    if (matrix.inWarranty === 'IN WARRANTY' || /^covered$/i.test(policy.coverage)) {
      return { text: 'IN WARRANTY', kind: 'is-ok' };
    }
    if (matrix.inWarranty === 'OUT OF WARRANTY' || /not covered/i.test(policy.coverage)) {
      return { text: 'OUT OF WARRANTY', kind: 'is-bad' };
    }
    if (policy.coverage === 'DATA GAP') return { text: 'DATA GAP', kind: 'is-wait' };
    // Only show LOADING while actively loading AND no resolved status
    if ((policy.loading || matrix.loading) && !matrix.ready && !policy.ready) {
      return { text: 'LOADING', kind: 'is-wait' };
    }
    if (policy.ready || matrix.ready) return { text: 'REVIEW', kind: 'is-wait' };
    return { text: '—', kind: 'is-wait' };
  }

  function buildHtml(model) {
    var badge = statusBadge(model.policy, model.matrix);
    var detailParts = [];
    if (model.matrix.category) detailParts.push(model.matrix.category);
    if (model.matrix.limit) detailParts.push('Limit ' + model.matrix.limit);
    if (model.matrix.expiry) detailParts.push('Expiry ' + model.matrix.expiry);
    if (model.policy.component) detailParts.push(model.policy.component);
    if (model.policy.risk) detailParts.push('Risk ' + model.policy.risk);
    if (model.happened) detailParts.push(model.happened);
    var detail =
      detailParts.join(' · ') ||
      (model.policy.ready || model.matrix.ready
        ? 'Lihat Policy Decision & unit policy matrix di bawah'
        : 'Memuat claim_warranty_policy_v + matrix dari Live DB…');

    return (
      '<div class="sdlg-wa-shell__head">' +
        '<div>' +
          '<div class="sdlg-wa-shell__eyebrow">Warranty Engine · Live DB</div>' +
          '<div class="sdlg-wa-shell__title">Warranty Assessment</div>' +
        '</div>' +
        '<div class="sdlg-wa-shell__badge sdlg-wa-shell__badge--' +
        badge.kind +
        '">' +
        esc(badge.text) +
        '</div>' +
      '</div>' +
      '<div class="sdlg-wa-shell__grid">' +
        '<div class="sdlg-wa-shell__cell">' +
          '<span class="sdlg-wa-shell__label">ROUTE</span>' +
          '<span class="sdlg-wa-shell__value">' +
          esc(model.route) +
          '</span></div>' +
        '<div class="sdlg-wa-shell__cell">' +
          '<span class="sdlg-wa-shell__label">STAGE</span>' +
          '<span class="sdlg-wa-shell__value">' +
          esc(model.stage) +
          '</span></div>' +
        '<div class="sdlg-wa-shell__cell sdlg-wa-shell__cell--wide">' +
          '<span class="sdlg-wa-shell__label">NEXT ACTION</span>' +
          '<span class="sdlg-wa-shell__value sdlg-wa-shell__value--next">' +
          esc(model.next) +
          '</span></div>' +
        '<div class="sdlg-wa-shell__cell sdlg-wa-shell__cell--wide">' +
          '<span class="sdlg-wa-shell__label">DETAIL</span>' +
          '<span class="sdlg-wa-shell__value sdlg-wa-shell__value--muted">' +
          esc(detail) +
          '</span></div>' +
      '</div>'
    );
  }

  function ensureStyles() {
    if (document.getElementById('sdlg-wa-shell-style')) return;
    var style = document.createElement('style');
    style.id = 'sdlg-wa-shell-style';
    style.textContent =
      '#' +
      PANEL_ID +
      '{margin:0 0 14px;padding:14px 16px;border-radius:12px;border:1px solid #e2e8f0;background:linear-gradient(180deg,#fff 0%,#f8fafc 100%);box-shadow:0 1px 2px rgba(15,23,42,.04)}' +
      '.sdlg-wa-shell__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}' +
      '.sdlg-wa-shell__eyebrow{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b}' +
      '.sdlg-wa-shell__title{font-size:16px;font-weight:800;color:#0f172a;margin-top:2px}' +
      '.sdlg-wa-shell__badge{font-size:11px;font-weight:800;padding:6px 10px;border-radius:999px;border:1px solid #e2e8f0}' +
      '.sdlg-wa-shell__badge--is-ok{background:#f0fdf4;color:#166534;border-color:#bbf7d0}' +
      '.sdlg-wa-shell__badge--is-bad{background:#fef2f2;color:#991b1b;border-color:#fecaca}' +
      '.sdlg-wa-shell__badge--is-wait{background:#fffbeb;color:#b45309;border-color:#fde68a}' +
      '.sdlg-wa-shell__grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.sdlg-wa-shell__cell{padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #e2e8f0}' +
      '.sdlg-wa-shell__cell--wide{grid-column:1 / -1}' +
      '.sdlg-wa-shell__label{display:block;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin-bottom:4px}' +
      '.sdlg-wa-shell__value{display:block;font-size:13px;font-weight:700;color:#0f172a;line-height:1.35}' +
      '.sdlg-wa-shell__value--next{color:#1d4ed8}' +
      '.sdlg-wa-shell__value--muted{font-weight:500;color:#475569}' +
      '@media (max-width:640px){.sdlg-wa-shell__grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function buildModel(page) {
    var policy = extractFromPolicyCard(page);
    var matrix = extractFromMatrix(page);
    return {
      stage: extractStage(page),
      policy: policy,
      matrix: matrix,
      happened: extractHappened(page),
      route: routeLabel(policy, matrix),
      next: nextAction(extractStage(page), policy, matrix)
    };
  }

  function render() {
    if (trackingPreferred()) {
      var existing = document.getElementById(PANEL_ID);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var page = claimDetailPage();
    if (!page) return;
    ensureStyles();
    var model = buildModel(page);
    var panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.setAttribute('data-sdlg-wa-shell', VERSION);
      var anchor = page.querySelector('.card, .card.card-pad, h1, h2');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(panel, anchor);
      } else {
        page.insertBefore(panel, page.firstChild);
      }
    }
    panel.innerHTML = buildHtml(model);
  }

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      try {
        render();
      } catch (e) {
        console.warn('[SDLG WA UX]', e);
      }
    }, DEBOUNCE_MS);
  }

  function boot() {
    schedule();
    if (OBSERVER) return;
    if (typeof MutationObserver === 'undefined') return;
    OBSERVER = new MutationObserver(function () {
      schedule();
    });
    OBSERVER.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGWarrantyAssessmentUX = { version: VERSION, render: render };
})();
