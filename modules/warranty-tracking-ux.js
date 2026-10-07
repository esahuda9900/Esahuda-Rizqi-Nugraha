/**
 * SDLG Warranty Tracking UX v1.6.7
 * Progressive enhancement only. No business logic / no data mutation.
 *
 * Design contract (all claims):
 * - Tracking panel = primary operator decision surface
 * - Why Blocked must reflect real gaps (policy review, parts compliance, SLA)
 * - What Happened from Final routing reason (full text, not truncated noise)
 *
 * v1.6.7: escapeHtml entity-safe
 * v1.6.6: accurate blocked/happened from page facts
 * v1.6.5: wait for engine; no sticky race on SPA open
 */
(function () {
  'use strict';

  var STYLE_HREF = '/styles/sdlg-warranty-tracking-v1.css';
  var STYLE_MARKER = 'data-sdlg-tracking-css';
  var PANEL_ID = 'sdlg-tracking-panel';
  var COMMAND_ID = 'sdlg-claim-command';
  var OBSERVER = null;
  var DEBOUNCE_MS = 480;
  var VERSION = '1.6.7';
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
      c.href = '/styles/sdlg-claim-detail-clean-v2.css?v=2';
      c.setAttribute('data-sdlg-claim-detail-clean', '1');
      (document.head || document.documentElement).appendChild(c);
    }
  }

  function textOf(el) {
    if (!el) return '';
    try {
      return String(el.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (_) {
      return '';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&' + 'amp;')
      .replace(/</g, '&' + 'lt;')
      .replace(/>/g, '&' + 'gt;')
      .replace(/"/g, '&' + 'quot;')
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

    if (/no warranty route|non-warrant/i.test(title) || /ROUTE:\s*NON-WARRANTY/i.test(body) || /NON-WARRANTY/i.test(badge)) {
      return 'NON_WARRANTY';
    }
    if (/marketing/i.test(title) || /ROUTE:\s*MARKETING/i.test(body) || /\bMARKETING\b/i.test(badge)) {
      return 'MARKETING';
    }
    if (/review required|pending data|data gap|Operator review required/i.test(title) || /REVIEW REQUIRED|PENDING DATA|Operator review required/i.test(body)) {
      return 'REVIEW';
    }
    if (/\bSDLG\b/i.test(title) || /ROUTE:\s*SDLG/i.test(body)) {
      return 'SDLG';
    }
    if (/Both SDLG and Marketing warranty are expired/i.test(body)) return 'NON_WARRANTY';
    if (/OUT OF WARRANTY/i.test(body) && /Both SDLG and Marketing/i.test(body)) return 'NON_WARRANTY';
    return 'UNKNOWN';
  }

  function extractStage(page) {
    var statusBadge = page.querySelector(
      '.page.claim-detail-page [class*="status"] .status-badge, .claim-detail-page .status-badge, [data-claim-status]'
    );
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

    var headerStage = body.match(/\bSTAGE\b\s+(Draft|SDLG Audit|Approved|Rejected|Paid|Billing|Ready to Claim|Submitted to SDLG|Claimed to SDLG|On Hold)/i);
    if (headerStage) return headerStage[1];

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

    if (/draft|ready to claim/i.test(s)) {
      return tech ? tech + (branch ? ' · ' + branch : '') : branch ? branch : 'Branch / TS';
    }
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

    var hardSelectors = ['.ui-banner.danger', '.ui-inline-error', '.rejection-reason', '[data-rejection]'];
    for (var i = 0; i < hardSelectors.length; i++) {
      var el = page.querySelector(hardSelectors[i]);
      if (!el) continue;
      var ht = textOf(el);
      if (ht && ht.length > 3 && ht.length < 120) blockers.push(ht.slice(0, 90));
    }
    if (/^reject/i.test(s)) blockers.push('Claim Rejected — lengkapi reason + evidence');

    if (routeClass === 'REVIEW' || /ROUTE:\s*REVIEW REQUIRED|Operator review required|Policy review required/i.test(body)) {
      blockers.push('Policy review required (wear/exclusion / data gap)');
    }
    if (/PARTS COMPLIANCE/i.test(body) && /Not verified|NO SOURCE PROOF/i.test(body)) {
      if (!/paid|completed/i.test(s)) {
        blockers.push('Parts compliance belum terverifikasi (no source proof)');
      }
    }
    if (/Policy risk:\s*RED/i.test(body)) {
      blockers.push('Policy risk RED — cek SLA / compliance');
    }
    if (/LATE\s*\/\s*MONITORING|OPEN\s*\/\s*LATE/i.test(body) && /SUBMISSION SLA/i.test(body)) {
      blockers.push('Submission SLA late / monitoring');
    }

    var aging = body.match(/Status Aging:\s*(\d+)\s*hari/i);
    if (aging && parseInt(aging[1], 10) >= 7 && /sdlg audit/i.test(s)) {
      blockers.push('SDLG Audit aging ' + aging[1] + ' hari — follow up keputusan');
    }

    if (routeClass === 'NON_WARRANTY' && /sdlg audit|submitted to sdlg|claimed to sdlg/i.test(s)) {
      blockers.push('Route Non-Warranty — claim masih di antrean SDLG');
    }

    var seen = {};
    var out = [];
    for (var j = 0; j < blockers.length; j++) {
      var key = blockers[j].toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(blockers[j]);
    }
    return out.slice(0, 3).join(' · ');
  }

  function extractNext(page, stage, blocked, routeClass) {
    var s = String(stage || '').toLowerCase();
    var nextStrong = page.querySelector('.sdlg-route-summary__next strong');
    var engineNext = nextStrong ? textOf(nextStrong) : '';
    if (engineNext && !/continue the sdlg workflow|open claim and verify/i.test(engineNext)) {
      return engineNext.slice(0, 160);
    }

    if (routeClass === 'NON_WARRANTY') {
      if (/sdlg audit|submitted to sdlg|claimed to sdlg/i.test(s)) {
        return 'Route Non-Warranty — jangan andalkan principal; konfirmasi handling + inform Branch (claim masih di antrean SDLG)';
      }
      return 'Confirm non-warranty handling · inform Branch + simpan reason & evidence';
    }
    if (routeClass === 'MARKETING') {
      return 'Lanjut Marketing / internal warranty handling sesuai policy perusahaan';
    }
    if (routeClass === 'REVIEW') {
      if (/sdlg audit|submitted to sdlg|claimed to sdlg/i.test(s)) {
        return 'Selesaikan policy review (wear/exclusion) + lengkapi source proof sebelum andalkan keputusan principal';
      }
      return 'Lengkapi evidence / policy gap (wear exclusion atau data master) · Review Required';
    }

    if (/^draft$/i.test(s)) return 'Lengkapi evidence & report → kirim ke Technical Support / Admin';
    if (/ready to claim/i.test(s)) return 'Warranty Admin: submit claim ke SDLG (Dealer Claim No)';
    if (/submitted to warranty/i.test(s)) return 'Warranty Admin: cek kelengkapan → submit ke SDLG';
    if (/submitted to sdlg|claimed to sdlg/i.test(s)) return 'Pantau masuk antrean SDLG Audit · pastikan Dealer Claim No benar';
    if (/sdlg audit/i.test(s)) {
      if (blocked) return 'Follow up audit SDLG + selesaikan blocker · catat Approved/Rejected & Settlement';
      return 'Pantau keputusan SDLG (Approved/Rejected) · catat flag Settlement terpisah';
    }
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
    var body = pageText(page);
    var fr = body.match(/Final routing reason:\s*(.{10,220}?)(?:\s*(?:Claim Status|STATUS HISTORY|Failed part|FINAL ROUTE)|$)/i);
    if (fr) return fr[1].replace(/\s+/g, ' ').trim().slice(0, 220);
    var pr = body.match(/Policy review required:\s*(.{10,220}?)(?:\s*(?:Final routing|Claim Status)|$)/i);
    if (pr) return pr[1].replace(/\s+/g, ' ').trim().slice(0, 220);

    if (routeClass === 'NON_WARRANTY') {
      return 'Both SDLG and Marketing warranty are expired or the part is not covered.';
    }
    if (routeClass === 'MARKETING') {
      return 'SDLG out of warranty — Marketing / internal coverage still applicable.';
    }
    if (routeClass === 'REVIEW') {
      return 'Policy review required — wear/exclusion or unit/part data needs operator decision.';
    }
    if (routeClass === 'SDLG') {
      return 'Within SDLG principal warranty coverage.';
    }
    return '';
  }

  function extractHandoff(stage, routeClass) {
    var s = String(stage || '').toLowerCase();
    if (routeClass === 'NON_WARRANTY') return 'Handoff → Branch (inform customer) + arsip reason';
    if (routeClass === 'MARKETING') return 'Handoff → Warranty Admin / internal Marketing process';
    if (routeClass === 'REVIEW') {
      if (/sdlg audit|claimed to sdlg|submitted to sdlg/i.test(s)) {
        return 'Handoff → Warranty Admin + policy owner (wear review) · pantau SDLG';
      }
      return 'Handoff → TS / Admin lengkapi evidence & data master';
    }
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
        '<span class="sdlg-tracking-panel__value sdlg-tracking-panel__value--owner">' +
          escapeHtml(data.owner) + '</span></div>' +
      '<div class="sdlg-tracking-panel__item">' +
        '<span class="sdlg-tracking-panel__label">Current Stage</span>' +
        '<span class="sdlg-tracking-panel__value">' + escapeHtml(data.stage) + '</span></div>' +
      '<div class="sdlg-tracking-panel__item">' +
        '<span class="sdlg-tracking-panel__label">What Happened</span>' +
        '<span class="sdlg-tracking-panel__value' + (data.happened ? '' : ' sdlg-tracking-panel__value--muted') + '">' +
          escapeHtml(data.happened || '—') + '</span></div>' +
      '<div class="sdlg-tracking-panel__item">' +
        '<span class="sdlg-tracking-panel__label">Why Blocked</span>' +
        '<span class="sdlg-tracking-panel__value' + (data.blocked ? ' sdlg-tracking-panel__value--blocked' : ' sdlg-tracking-panel__value--muted') + '">' +
          escapeHtml(data.blocked || 'Tidak ada blokir aktif') + '</span></div>' +
      '<div class="sdlg-tracking-panel__item sdlg-tracking-panel__item--next">' +
        '<span class="sdlg-tracking-panel__label">Next Action</span>' +
        '<span class="sdlg-tracking-panel__value sdlg-tracking-panel__value--next">' +
          escapeHtml(data.next) + '</span></div>' +
      '<div class="sdlg-tracking-panel__item sdlg-tracking-panel__item--handoff">' +
        '<span class="sdlg-tracking-panel__label">Evidence / Handoff</span>' +
        '<span class="sdlg-tracking-panel__value sdlg-tracking-panel__value--muted">' +
          escapeHtml(data.handoff || 'Lihat timeline di bawah') + '</span></div>'
    );
  }

  function extractClaimIdentity(page) {
    var hash = '';
    try {
      hash = String(window.location.hash || '');
    } catch (_) {}
    var claimMatch = hash.match(/#claim\/([^/?#]+)/i);
    var claimId = claimMatch ? decodeURIComponent(claimMatch[1]) : '';
    if (!claimId) {
      var body = pageText(page);
      var cm = body.match(/\b\d{4}-\d{4}-SDLG-PFR\b/i);
      claimId = cm ? cm[0] : 'Claim';
    }
    var model = findLabelValue(page, [/^\s*model\s*$/i]);
    var serial = findLabelValue(page, [/^\s*serial\s*(?:no\.)?\s*$/i, /^\s*serial\s*no\s*$/i]);
    var customer = findLabelValue(page, [/^\s*customer\s*$/i]);
    var branch = findLabelValue(page, [/^\s*branch\s*$/i]);
    var ageMatch = pageText(page).match(/Status Aging:\s*(\d+)\s*hari/i);
    if (!ageMatch) {
      var ageHeader = pageText(page).match(/\bAGE\b\s+(\d+\s*hari)/i);
      if (ageHeader) ageMatch = ageHeader;
    }
    var age = ageMatch ? (ageMatch[1].indexOf('hari') >= 0 ? ageMatch[1] : ageMatch[1] + ' hari') : '—';
    return { claimId: claimId, model: model || '—', serial: serial || '—', customer: customer || '—', branch: branch || '—', age: age };
  }

  function ensureCommandBar(page, data, tracking) {
    var existing = document.getElementById(COMMAND_ID);
    if (existing && !existing.isConnected) existing = null;

    if (!existing) {
      existing = document.createElement('div');
      existing.id = COMMAND_ID;
      existing.className = 'sdlg-claim-command';
      existing.setAttribute('data-sdlg-claim-command', '1');
    }

    if (existing.parentNode !== page || page.firstElementChild !== existing) {
      if (existing.parentNode) {
        try { existing.parentNode.removeChild(existing); } catch (_) {}
      }
      if (page.firstChild) page.insertBefore(existing, page.firstChild);
      else page.appendChild(existing);
    }

    var payload = { identity: data, tracking: tracking };
    var signature = JSON.stringify(payload);
    if (existing.getAttribute('data-signature') !== signature) {
      existing.setAttribute('data-signature', signature);
      existing.innerHTML =
        '<div class="sdlg-claim-command__identity">' +
          '<div class="sdlg-claim-command__eyebrow">CLAIM</div>' +
          '<div class="sdlg-claim-command__title">' + escapeHtml(data.claimId) + '</div>' +
          '<div class="sdlg-claim-command__sub">' + escapeHtml([data.model, data.serial].filter(Boolean).join(' · ')) + '</div>' +
        '</div>' +
        '<div class="sdlg-claim-command__context">' +
          '<div><span>Customer</span><strong>' + escapeHtml(data.customer) + '</strong></div>' +
          '<div><span>Branch</span><strong>' + escapeHtml(data.branch) + '</strong></div>' +
          '<div><span>Stage</span><strong>' + escapeHtml(tracking.stage || '—') + '</strong></div>' +
          '<div><span>Age</span><strong>' + escapeHtml(data.age) + '</strong></div>' +
        '</div>';
    }
    return existing;
  }

  function markDetailSurfaces(page) {
    if (!page) return;
    page.classList.add('sdlg-clean-detail-v2');
    page.classList.add('sdlg-tracking-active');
    var legacy = page.querySelector('.claim-decision-summary');
    if (legacy) legacy.classList.add('sdlg-legacy-decision');
    var nodes = page.querySelectorAll(':scope > div, :scope > section');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.id === PANEL_ID || node.id === COMMAND_ID) continue;
      var nt = textOf(node);
      if (/^CURRENT DECISION\b/i.test(nt) || (/Yard Failure/i.test(nt) && /Next action/i.test(nt) && nt.length < 220)) {
        node.classList.add('sdlg-legacy-decision');
      }
    }
  }

  function findEngineBlock(page) {
    var engine = page.querySelector('.sdlg-route-summary');
    if (engine) return engine;
    var candidates = page.querySelectorAll(':scope > div, :scope > section');
    for (var j = 0; j < Math.min(candidates.length, 14); j++) {
      var ct = textOf(candidates[j]);
      if (/Warranty Engine|Warranty Assessment|ROUTE:|Policy Decision|FINAL ROUTE/i.test(ct)) {
        return candidates[j];
      }
    }
    return null;
  }

  function ensureTrackingPanel(page, data, commandBar) {
    var existing = document.getElementById(PANEL_ID);
    if (existing && !existing.isConnected) {
      try {
        if (existing.parentNode) existing.parentNode.removeChild(existing);
      } catch (_) {}
      existing = null;
    }

    var html = buildPanelHtml(data);
    var signature = JSON.stringify(data);

    if (!existing) {
      existing = document.createElement('div');
      existing.id = PANEL_ID;
      existing.className = 'sdlg-tracking-panel';
      existing.setAttribute('data-sdlg-tracking', '1');
    }

    if (existing.getAttribute('data-signature') !== signature) {
      existing.innerHTML = html;
      existing.setAttribute('data-signature', signature);
    }

    var correctlyPlaced = false;
    if (commandBar && commandBar.isConnected && commandBar.parentNode === page) {
      correctlyPlaced = commandBar.nextElementSibling === existing;
    } else {
      var engine = findEngineBlock(page);
      if (engine && existing.nextElementSibling === engine) correctlyPlaced = true;
      if (!commandBar && page.firstElementChild === existing) correctlyPlaced = true;
    }

    if (!correctlyPlaced) {
      if (existing.parentNode) {
        try { existing.parentNode.removeChild(existing); } catch (_) {}
      }
      if (commandBar && commandBar.isConnected && commandBar.parentNode === page) {
        if (commandBar.nextSibling) page.insertBefore(existing, commandBar.nextSibling);
        else page.appendChild(existing);
      } else {
        var eng = findEngineBlock(page);
        if (eng && eng.parentNode) eng.parentNode.insertBefore(existing, eng);
        else if (page.firstChild) page.insertBefore(existing, page.firstChild);
        else page.appendChild(existing);
      }
    }
    return existing;
  }

  function enhanceClaimDetail() {
    var page = document.querySelector('.page.claim-detail-page');
    if (!page) return;

    var ready = page.querySelector('.sdlg-route-summary, .card.card-pad')
      || /Warranty Assessment|FINAL ROUTE|ROUTE:/i.test(page.textContent || '');
    if (!ready) {
      clearTimeout(window.__sdlgTrackWait);
      window.__sdlgTrackWait = setTimeout(run, 200);
      return;
    }

    markDetailSurfaces(page);

    var stage = extractStage(page);
    var routeClass = detectRouteClass(page);
    var blocked = extractBlocked(page, stage, routeClass);
    var data = {
      owner: extractOwner(page, stage),
      stage: stage,
      happened: extractHappened(page, routeClass),
      blocked: blocked,
      next: extractNext(page, stage, blocked, routeClass),
      handoff: extractHandoff(stage, routeClass)
    };

    var identity = extractClaimIdentity(page);
    var commandBar = ensureCommandBar(page, identity, data);
    ensureTrackingPanel(page, data, commandBar);
  }

  function enhanceClaimsList() {
    var rows = document.querySelectorAll('.claims-list .claim-row, .claims-table-shell tbody tr');
    if (!rows.length) return;
    var max = Math.min(rows.length, 80);
    for (var i = 0; i < max; i++) {
      var row = rows[i];
      if (row.querySelector('.claim-track-chips')) continue;
      if (row.closest('thead')) continue;
      var chips = document.createElement('div');
      chips.className = 'claim-track-chips';
      var statusBadge = row.querySelector('.status-badge, [class*="badge"], [class*="pill"]');
      if (statusBadge) {
        var chip = document.createElement('span');
        chip.className = 'claim-track-chip claim-track-chip--stage';
        chip.textContent = textOf(statusBadge).slice(0, 28);
        chips.appendChild(chip);
      }
      if (/reject/i.test(textOf(row))) {
        var b = document.createElement('span');
        b.className = 'claim-track-chip claim-track-chip--blocked';
        b.textContent = 'Rejected';
        chips.appendChild(b);
      }
      if (chips.childNodes.length) {
        var cell = row.querySelector('td') || row;
        cell.appendChild(chips);
      }
    }
  }

  function run() {
    try {
      if (typeof document !== 'undefined' && document.hidden) return;
      var now = Date.now();
      if (now - lastRunAt < 100) return;
      lastRunAt = now;
      var onDetail = !!document.querySelector('.page.claim-detail-page');
      var onList = !!document.querySelector('.claims-list, .claims-table-shell');
      if (!onDetail && !onList) return;
      injectCss();
      if (onDetail) enhanceClaimDetail();
      if (onList) enhanceClaimsList();
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[SDLGTrackingUX]', err);
    }
  }

  function startObserver() {
    if (OBSERVER) return;
    var target = document.body || document.documentElement;
    OBSERVER = new MutationObserver(function () {
      clearTimeout(window.__sdlgTrackTimer);
      window.__sdlgTrackTimer = setTimeout(run, DEBOUNCE_MS);
    });
    OBSERVER.observe(target, { childList: true, subtree: true });
  }

  function boot() {
    injectCss();
    run();
    startObserver();
    setTimeout(run, 400);
    setTimeout(run, 1000);
    setTimeout(run, 2200);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) setTimeout(run, 150);
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && (t.closest('.nav-btn') || t.closest('[data-tab]') || t.closest('a') || t.closest('.claim-row') || t.closest('tr'))) {
        setTimeout(run, 120);
        setTimeout(run, 350);
        setTimeout(run, 700);
        setTimeout(run, 1200);
        setTimeout(run, 2000);
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SDLGTrackingUX = { refresh: run, version: VERSION };
})();
