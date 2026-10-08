/**
 * SDLG Warranty Tracking UX v1.6.8
 * Progressive enhancement only. No business logic / no data mutation.
 * Relative style paths for GitHub Project Pages.
 */
(function () {
  'use strict';

  var STYLE_HREF = './styles/sdlg-warranty-tracking-v1.css';
  var STYLE_MARKER = 'data-sdlg-tracking-css';
  var PANEL_ID = 'sdlg-tracking-panel';
  var COMMAND_ID = 'sdlg-claim-command';
  var OBSERVER = null;
  var DEBOUNCE_MS = 480;
  var VERSION = '1.6.8';
  var lastRunAt = 0;

  function injectCss() {
    if (typeof document === 'undefined') return;
    var existing = document.querySelector('link[' + STYLE_MARKER + ']');
    var href = STYLE_HREF + '?v=' + encodeURIComponent(VERSION);
    if (existing && existing.getAttribute('href') !== href) {
      try { existing.parentNode.removeChild(existing); } catch (_) {}
      existing = null;
    }
    if (!existing) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute(STYLE_MARKER, '1');
      (document.head || document.documentElement).appendChild(link);
    }
    if (!document.querySelector('link[data-sdlg-claim-detail-clean]')) {
      var c = document.createElement('link');
      c.rel = 'stylesheet';
      c.href = './styles/sdlg-claim-detail-clean-v2.css?v=3';
      c.setAttribute('data-sdlg-claim-detail-clean', '1');
      (document.head || document.documentElement).appendChild(c);
    }
  }

  function textOf(el) {
    if (!el) return '';
    try { return String(el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (_) { return ''; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pageText(page) {
    try {
      var clone = page.cloneNode(true);
      var self = clone.querySelector('#' + PANEL_ID);
      if (self) self.remove();
      var cmd = clone.querySelector('#' + COMMAND_ID);
      if (cmd) cmd.remove();
      return textOf(clone);
    } catch (_) {
      return textOf(page);
    }
  }

  function findLabelValue(root, labelPatterns) {
    if (!root) return '';
    var nodes = root.querySelectorAll('div, span, p, td, th, label, strong, b, dt, dd');
    for (var i = 0; i < Math.min(nodes.length, 600); i++) {
      var t = textOf(nodes[i]);
      if (!t || t.length > 110) continue;
      for (var p = 0; p < labelPatterns.length; p++) {
        if (!labelPatterns[p].test(t)) continue;
        var m = t.match(/[:：]\s*(.+)$/);
        if (m && m[1] && m[1].length > 1 && m[1].length < 70) return m[1].trim();
        var next = nodes[i].nextElementSibling;
        if (next) {
          var nv = textOf(next);
          if (nv && nv.length > 1 && nv.length < 70) return nv;
        }
        var parent = nodes[i].parentElement;
        if (parent) {
          var kids = parent.children;
          for (var k = 0; k < kids.length; k++) {
            if (kids[k] === nodes[i] && kids[k + 1]) {
              var kv = textOf(kids[k + 1]);
              if (kv && kv.length > 1 && kv.length < 70) return kv;
            }
          }
        }
      }
    }
    return '';
  }

  function detectRouteClass(page) {
    var body = pageText(page);
    var routeTitle = page.querySelector('.sdlg-route-summary__title');
    var title = routeTitle ? textOf(routeTitle) : '';
    var badge = '';
    var routeBadge = page.querySelector('[class*="route"] [class*="badge"], .sdlg-route-summary [class*="badge"]');
    if (routeBadge) badge = textOf(routeBadge);
    if (/no warranty route|non-warrant/i.test(title) || /ROUTE:\s*NON-WARRANTY/i.test(body) || /NON-WARRANTY/i.test(badge)) return 'NON_WARRANTY';
    if (/marketing/i.test(title) || /ROUTE:\s*MARKETING/i.test(body) || /\bMARKETING\b/i.test(badge)) return 'MARKETING';
    if (/review required|pending data|data gap|Operator review required/i.test(title) || /REVIEW REQUIRED|PENDING DATA|Operator review required/i.test(body)) return 'REVIEW';
    if (/\bSDLG\b/i.test(title) || /ROUTE:\s*SDLG/i.test(body)) return 'SDLG';
    if (/Both SDLG and Marketing warranty are expired/i.test(body)) return 'NON_WARRANTY';
    if (/OUT OF WARRANTY/i.test(body) && /Both SDLG and Marketing/i.test(body)) return 'NON_WARRANTY';
    return 'UNKNOWN';
  }

  function extractStage(page) {
    var statusBadge = page.querySelector('.page.claim-detail-page [class*="status"] .status-badge, .claim-detail-page .status-badge, [data-claim-status]');
    if (statusBadge) {
      var sb = textOf(statusBadge);
      if (sb && !/non-warrant|no warranty|route/i.test(sb)) return sb.slice(0, 48);
    }
    var statusLast = findLabelValue(page, [/status\s*terakhir/i, /current\s*status/i, /claim\s*status/i]);
    if (statusLast && !/non-warrant|no warranty route/i.test(statusLast)) return statusLast.slice(0, 48);
    var body = pageText(page);
    var pairs = [
      [/Status terakhir:\s*SDLG Audit/i, 'SDLG Audit'],
      [/Status terakhir:\s*Draft/i, 'Draft'],
      [/Status terakhir:\s*Approved/i, 'Approved'],
      [/Status terakhir:\s*Rejected/i, 'Rejected'],
      [/Status terakhir:\s*Claimed to SDLG/i, 'Claimed to SDLG'],
      [/Status terakhir:\s*Submitted to SDLG/i, 'Submitted to SDLG'],
      [/Status terakhir:\s*Submitted to Warranty/i, 'Submitted to Warranty'],
      [/Status terakhir:\s*Ready to Claim/i, 'Ready to Claim'],
      [/Status terakhir:\s*Paid/i, 'Paid'],
      [/Status terakhir:\s*Billing/i, 'Billing'],
      [/Status terakhir:\s*On Hold/i, 'On Hold'],
      [/Status terakhir:\s*Completed/i, 'Completed']
    ];
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0].test(body)) return pairs[i][1];
    }
    var currentLabel = page.querySelector('.status-step.current .status-step-label');
    if (currentLabel) {
      var t = textOf(currentLabel);
      if (t && !/non-warrant|route/i.test(t)) return t.slice(0, 48);
    }
    return '—';
  }

  function extractTechnician(page) {
    return findLabelValue(page, [/^\s*technician\s*$/i, /technician\s*[:：]/i, /feedback\s*person/i, /teknisi/i]) || '';
  }

  function extractOwner(page, stage) {
    var s = String(stage || '').toLowerCase();
    var tech = extractTechnician(page);
    var branch = findLabelValue(page, [/^\s*branch\s*$/i, /\bcabang\b/i]);
    if (/draft|ready to claim/i.test(s)) return tech ? tech + (branch ? ' · ' + branch : '') : branch ? branch : 'Branch / TS';
    if (/submitted to warranty/i.test(s)) return 'Warranty Admin';
    if (/submitted to sdlg|claimed to sdlg|sdlg audit/i.test(s)) return 'Warranty Admin · antrean SDLG';
    if (/^approved$/i.test(s) || /billing/i.test(s)) return 'Warranty Admin / Finance';
    if (/^paid$|^completed$/i.test(s)) return 'Closed · Finance';
    if (/reject/i.test(s)) return 'Warranty Admin · dispute';
    if (/on hold/i.test(s)) return 'Warranty Admin';
    if (tech) return tech + (branch ? ' · ' + branch : '');
    if (branch) return branch;
    return '—';
  }

  function extractBlocked(page, stage, routeClass) {
    var s = String(stage || '').toLowerCase();
    var body = pageText(page);
    var blockers = [];
    if (/^reject/i.test(s)) blockers.push('Claim Rejected — lengkapi reason + evidence');
    if (routeClass === 'REVIEW' || /ROUTE:\s*REVIEW REQUIRED|Operator review required|Policy review required/i.test(body)) {
      blockers.push('Policy review required (wear/exclusion / data gap)');
    }
    if (/PARTS COMPLIANCE/i.test(body) && /Not verified|NO SOURCE PROOF/i.test(body) && !/paid|completed/i.test(s)) {
      blockers.push('Parts compliance belum terverifikasi (no source proof)');
    }
    if (/Policy risk:\s*RED/i.test(body)) blockers.push('Policy risk RED — cek SLA / compliance');
    if (/LATE\s*\/\s*MONITORING|OPEN\s*\/\s*LATE/i.test(body) && /SUBMISSION SLA/i.test(body)) {
      blockers.push('Submission SLA late / monitoring');
    }
    if (routeClass === 'NON_WARRANTY' && /sdlg audit|submitted to sdlg|claimed to sdlg/i.test(s)) {
      blockers.push('Route Non-Warranty — claim masih di antrean SDLG');
    }
    return blockers.slice(0, 3).join(' · ');
  }

  function extractNext(page, stage, blocked, routeClass) {
    var s = String(stage || '').toLowerCase();
    if (routeClass === 'NON_WARRANTY') return 'Confirm non-warranty handling · inform Branch + simpan reason & evidence';
    if (routeClass === 'MARKETING') return 'Lanjut Marketing / internal warranty handling sesuai policy perusahaan';
    if (routeClass === 'REVIEW') return 'Lengkapi evidence / policy gap · Review Required';
    if (/^draft$/i.test(s)) return 'Lengkapi evidence & report → kirim ke Technical Support / Admin';
    if (/ready to claim/i.test(s)) return 'Warranty Admin: submit claim ke SDLG (Dealer Claim No)';
    if (/submitted to warranty/i.test(s)) return 'Warranty Admin: cek kelengkapan → submit ke SDLG';
    if (/submitted to sdlg|claimed to sdlg/i.test(s)) return 'Pantau masuk antrean SDLG Audit · pastikan Dealer Claim No benar';
    if (/sdlg audit/i.test(s)) return blocked ? 'Follow up audit SDLG + selesaikan blocker' : 'Pantau keputusan SDLG (Approved/Rejected)';
    if (/^approved$/i.test(s)) return 'Cek Settlement Yes/No → siapkan agreement / invoice bila Yes';
    if (/billing/i.test(s)) return 'Finance: proses invoice & penagihan sesuai agreement';
    if (/^paid$/i.test(s)) return 'Rekonsiliasi payout vs cost WO → close claim';
    if (/reject/i.test(s)) return 'Catat rejection reason + evidence · siapkan argument/dispute bila perlu';
    if (/on hold/i.test(s)) return 'Klarifikasi hold reason · tentukan next owner';
    if (/completed/i.test(s)) return 'Claim selesai — arsipkan evidence';
    if (routeClass === 'SDLG') return 'Within SDLG warranty — lanjut Approval Code / Warranty WO sesuai stage';
    return 'Lanjutkan sesuai stage: ' + (stage || '—');
  }

  function extractHappened(page, routeClass) {
    var reason = page.querySelector('.sdlg-route-summary__reason');
    if (reason) {
      var rt = textOf(reason);
      if (rt) return rt.slice(0, 220);
    }
    if (routeClass === 'NON_WARRANTY') return 'Both SDLG and Marketing warranty are expired or the part is not covered.';
    if (routeClass === 'MARKETING') return 'SDLG out of warranty — Marketing / internal coverage still applicable.';
    if (routeClass === 'REVIEW') return 'Policy review required — wear/exclusion or unit/part data needs operator decision.';
    if (routeClass === 'SDLG') return 'Within SDLG principal warranty coverage.';
    return '';
  }

  function extractHandoff(stage, routeClass) {
    var s = String(stage || '').toLowerCase();
    if (routeClass === 'NON_WARRANTY') return 'Handoff → Branch (inform customer) + arsip reason';
    if (routeClass === 'MARKETING') return 'Handoff → Warranty Admin / internal Marketing process';
    if (routeClass === 'REVIEW') return 'Handoff → TS / Admin lengkapi evidence & data master';
    if (/draft|ready to claim/i.test(s)) return 'Handoff → Technical Support / Warranty Admin';
    if (/submitted to warranty/i.test(s)) return 'Handoff → Warranty Admin submit SDLG';
    if (/submitted to sdlg|claimed to sdlg|sdlg audit/i.test(s)) return 'Handoff → SDLG auditor (pantau hasil)';
    if (/approved|billing/i.test(s)) return 'Handoff → Finance / Settlement';
    if (/reject/i.test(s)) return 'Handoff → Branch/TS + Admin (dispute pack)';
    if (/paid|completed/i.test(s)) return 'Handoff → arsip / closed';
    return 'Lihat timeline & dokumen di bawah';
  }

  function buildPanelHtml(data) {
    return (
      '<div class="sdlg-tracking-panel__item">' +
        '<span class="sdlg-tracking-panel__label">Current Owner</span>' +
        '<span class="sdlg-tracking-panel__value sdlg-tracking-panel__value--owner">' + escapeHtml(data.owner) + '</span></div>' +
      '<div class="sdlg-tracking-panel__item">' +
        '<span class="sdlg-tracking-panel__label">Current Stage</span>' +
        '<span class="sdlg-tracking-panel__value">' + escapeHtml(data.stage) + '</span></div>' +
      '<div class="sdlg-tracking-panel__item">' +
        '<span class="sdlg-tracking-panel__label">What Happened</span>' +
        '<span class="sdlg-tracking-panel__value' + (data.happened ? '' : ' sdlg-tracking-panel__value--muted') + '">' + escapeHtml(data.happened || '—') + '</span></div>' +
      '<div class="sdlg-tracking-panel__item">' +
        '<span class="sdlg-tracking-panel__label">Why Blocked</span>' +
        '<span class="sdlg-tracking-panel__value' + (data.blocked ? ' sdlg-tracking-panel__value--blocked' : ' sdlg-tracking-panel__value--muted') + '">' + escapeHtml(data.blocked || 'Tidak ada blokir aktif') + '</span></div>' +
      '<div class="sdlg-tracking-panel__item sdlg-tracking-panel__item--next">' +
        '<span class="sdlg-tracking-panel__label">Next Action</span>' +
        '<span class="sdlg-tracking-panel__value sdlg-tracking-panel__value--next">' + escapeHtml(data.next) + '</span></div>' +
      '<div class="sdlg-tracking-panel__item sdlg-tracking-panel__item--handoff">' +
        '<span class="sdlg-tracking-panel__label">Evidence / Handoff</span>' +
        '<span class="sdlg-tracking-panel__value sdlg-tracking-panel__value--muted">' + escapeHtml(data.handoff || 'Lihat timeline di bawah') + '</span></div>'
    );
  }

  function run(page) {
    if (!page) return;
    injectCss();
    var stage = extractStage(page);
    var routeClass = detectRouteClass(page);
    var data = {
      owner: extractOwner(page, stage),
      stage: stage,
      happened: extractHappened(page, routeClass),
      blocked: extractBlocked(page, stage, routeClass),
      next: extractNext(page, stage, null, routeClass),
      handoff: extractHandoff(stage, routeClass)
    };
    data.next = extractNext(page, stage, data.blocked, routeClass);

    var panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'sdlg-tracking-panel card card-pad';
      panel.setAttribute('data-sdlg-tracking', '1');
      var insertAt = page.querySelector('.sdlg-route-summary') || page.firstChild;
      if (insertAt && insertAt.parentNode === page) page.insertBefore(panel, insertAt.nextSibling || insertAt);
      else page.insertBefore(panel, page.firstChild);
    }
    panel.innerHTML =
      '<div class="sdlg-tracking-panel__head"><div class="sdlg-tracking-panel__title">Claim Tracking</div>' +
      '<div class="sdlg-tracking-panel__ver">v' + VERSION + '</div></div>' +
      '<div class="sdlg-tracking-panel__grid">' + buildPanelHtml(data) + '</div>';
  }

  function findPage() {
    return document.querySelector('.page.claim-detail-page, [data-sdlg-claim-detail="1"]');
  }

  function tick() {
    var now = Date.now();
    if (now - lastRunAt < DEBOUNCE_MS) return;
    lastRunAt = now;
    var page = findPage();
    if (page) run(page);
  }

  function boot() {
    injectCss();
    tick();
    if (typeof MutationObserver !== 'undefined') {
      OBSERVER = new MutationObserver(function () {
        clearTimeout(window.__sdlgTrackingTimer);
        window.__sdlgTrackingTimer = setTimeout(tick, 160);
      });
      OBSERVER.observe(document.documentElement, { childList: true, subtree: true });
    }
    setInterval(tick, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SDLGWarrantyTrackingUX = { version: VERSION, refresh: tick };
})();
