(function () {
  'use strict';

  // Canonical portal helper: always prefer Supabase claim + warranty RPC over stale UI defaults.
  // v1.2.0 — Repair Date mapping, empty-field fill, Feedback Person name-only (no Technician prefix),
  // amounts + mileage, safer re-apply when UI left blanks.

  var CLAIM_SELECT = [
    'claim_id','model','serial_no','customer','repair_method','technical_personnel',
    'causing_part_no','causing_part_desc','failure_part_location','fault_description',
    'cause_analyze','comment','parts','hm_failure','hm_completion','sales_date',
    'failure_date','dealer_repair_date','completion_date','dealer_claim_date',
    'labour_amount','mileage_amount','other_amount','total_amount','mileage_km',
    'service_type','work_location','branch_name'
  ].join(',');

  var scheduled = false;
  var lastAppliedKey = '';
  var runSequence = 0;

  function clean(v) { return v == null ? '' : String(v).trim(); }
  function displayStatus(v) { return clean(v).replace(/_/g, ' '); }
  function escapeHtml(v) {
    return clean(v).replace(/[&<>"']/g, function (ch) {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });
  }

  function normalizeLabel(text) {
    return clean(text).toLowerCase().replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ');
  }

  function isBlankUi(v) {
    var s = clean(v);
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || /^xxx+$/i.test(s) || /^unknown$/i.test(s) || /^kosong$/i.test(s);
  }

  /** Format ISO / DB date to DD/MM/YYYY for portal copy. */
  function formatPortalDate(v) {
    var s = clean(v);
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      var d = m[1].padStart(2, '0');
      var mo = m[2].padStart(2, '0');
      var y = m[3].length === 2 ? (Number(m[3]) <= 49 ? '20' + m[3] : '19' + m[3]) : m[3];
      return d + '/' + mo + '/' + y;
    }
    return s;
  }

  function shortenComplaint(text) {
    var s = clean(text).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    if (!s) return '';
    var lower = s.toLowerCase();
    if (/abnormal\s+noise/.test(lower) && (/won'?t\s+run|will\s+not\s+run|cannot\s+run|can'?t\s+run/.test(lower)) && /transmission/.test(lower)) {
      return 'Machine wont run and noise transmission';
    }
    if (s.length <= 48) return s;
    s = s.replace(/^(the|a|an)\s+/i, '');
    var clause = s.split(/[.;]/)[0] || s;
    if (clause.length <= 56) return clause.trim();
    return clause.slice(0, 53).replace(/\s+\S*$/, '').trim() + '\u2026';
  }

  function wholeMachineLabel(resolver) {
    if (!resolver) return '';
    var st = clean(resolver.machine_status).toUpperCase();
    var overall = clean(resolver.overall_status).toUpperCase();
    var tier = clean(resolver.warranty_tier_used);
    if (overall === 'ELIGIBLE' || clean(resolver.component_status).toUpperCase() === 'IN_WARRANTY') {
      var base = 'In Warranty';
      if (/contract/i.test(tier)) return base + ' \u2014 Contract Customer';
      if (/standard/i.test(tier)) return base + ' \u2014 Standard';
      return base;
    }
    if (st === 'OUT_OF_WARRANTY' || overall === 'NOT_ELIGIBLE') return 'Out of Warranty';
    if (st === 'MIXED_POLICY') return 'Mixed Policy \u2014 see matrix';
    if (st === 'IN_WARRANTY') return 'In Warranty';
    if (st === 'UNKNOWN') return 'Unknown \u2014 check policy scope';
    return displayStatus(resolver.machine_status) || '';
  }

  /** Name only for portal Feedback Person (no Technician prefix). */
  function feedbackPersonValue(claim) {
    var name = clean(claim && claim.technical_personnel);
    if (!name || /^unknown$/i.test(name)) return '';
    name = name.replace(/^technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
    return name;
  }

  /** Prefer dealer_repair_date, then completion_date, then repair_date aliases. */
  function repairDateValue(claim) {
    if (!claim) return '';
    return formatPortalDate(
      claim.dealer_repair_date || claim.completion_date || claim.repair_date || ''
    );
  }

  function findClaimId() {
    var text = document.body ? document.body.innerText : '';
    var m = text.match(/\b\d{4}-\d{4}-SDLG-PFR\b/);
    return m ? m[0] : '';
  }

  function findSupabaseClient() {
    var direct = [
      window.supabaseClient, window.sdlgSupabase, window.sb, window.db,
      window.SDLGSupabase, window.SDLG_DB, window.SDLGDatabase,
      window.__SUPABASE_CLIENT, window.__SDLG_SUPABASE_CLIENT
    ];
    for (var i = 0; i < direct.length; i += 1) {
      var candidate = direct[i];
      if (candidate && typeof candidate.from === 'function' && typeof candidate.rpc === 'function') return candidate;
    }
    try {
      var keys = Object.getOwnPropertyNames(window);
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (/^(location|top|parent|frames|self|window|document|localStorage|sessionStorage|crypto|navigator)$/i.test(key)) continue;
        var cand = null;
        try { cand = Object.getOwnPropertyDescriptor(window, key).value; } catch (e) { cand = null; }
        if (cand && typeof cand.from === 'function' && typeof cand.rpc === 'function') return cand;
      }
    } catch (e) {}
    return null;
  }

  async function loadClaim(claimId) {
    var client = findSupabaseClient();
    if (!client) throw new Error('Supabase client unavailable');
    var result = await client.from('claims').select(CLAIM_SELECT).eq('claim_id', claimId).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function loadResolver(claimId) {
    var client = findSupabaseClient();
    if (!client || typeof client.rpc !== 'function') throw new Error('Supabase RPC client unavailable');
    var result = await client.rpc('sdlg_warranty_resolve_claim', { p_claim_id: claimId });
    if (result.error) throw result.error;
    return result.data || null;
  }

  function findFieldControl(labelText) {
    var wanted = normalizeLabel(labelText);
    var labels = Array.from(document.querySelectorAll('label'));
    var exact = labels.find(function (el) { return normalizeLabel(el.textContent) === wanted; });
    var candidates = exact ? [exact] : labels.filter(function (el) {
      return normalizeLabel(el.textContent).indexOf(wanted) >= 0;
    });
    for (var c = 0; c < candidates.length; c += 1) {
      var label = candidates[c];
      var forId = label.getAttribute('for');
      if (forId) {
        var direct = document.getElementById(forId);
        if (direct) return direct;
      }
      var parent = label;
      for (var i = 0; i < 5 && parent; i += 1, parent = parent.parentElement) {
        var control = parent.querySelector('input, select, textarea');
        if (control) return control;
      }
    }
    var byData = document.querySelector('[data-label="' + labelText.replace(/"/g, '') + '"], [data-sdlg-field][data-label*="' + wanted.split(' ')[0] + '"]');
    if (byData && (byData.matches('input,select,textarea') || byData.getAttribute('data-sdlg-field') != null)) {
      return byData.matches('input,select,textarea') ? byData : byData;
    }
    return null;
  }

  function setControlValue(control, value, forceFillEmpty) {
    if (!control) return false;
    if (value == null || value === '') return false;
    var next = String(value);
    var cur = control.value != null ? String(control.value) : '';
    if (!forceFillEmpty && !isBlankUi(cur) && cur === next) {
      if (typeof control.getAttribute === 'function' && control.getAttribute('value') !== next) {
        control.setAttribute('value', next);
      }
      return false;
    }
    if (!forceFillEmpty && !isBlankUi(cur) && cur !== next) {
      return false;
    }
    control.value = next;
    if (typeof control.setAttribute === 'function') control.setAttribute('value', next);
    try {
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  function setByLabels(labels, value, force) {
    if (isBlankUi(value)) return;
    for (var i = 0; i < labels.length; i += 1) {
      setControlValue(findFieldControl(labels[i]), value, force);
    }
  }

  function forceTextNearLabel(labelWanted, value) {
    if (isBlankUi(value)) return;
    var wanted = normalizeLabel(labelWanted);
    var nodes = Array.from(document.querySelectorAll('label,div,span,p,strong'));
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (normalizeLabel(el.textContent) !== wanted && normalizeLabel(el.textContent).indexOf(wanted) !== 0) continue;
      var parent = el.parentElement;
      for (var d = 0; d < 5 && parent; d += 1, parent = parent.parentElement) {
        var inputs = parent.querySelectorAll('input, textarea, select');
        for (var j = 0; j < inputs.length; j += 1) setControlValue(inputs[j], value, true);
        var boxes = parent.querySelectorAll('[data-value], [data-copy], [data-copy-box], code, pre');
        for (var k = 0; k < boxes.length; k += 1) {
          var node = boxes[k];
          if (node.getAttribute && node.getAttribute('data-value') != null) node.setAttribute('data-value', value);
          if (node.getAttribute && node.getAttribute('data-copy-box') != null && isBlankUi(node.textContent)) {
            node.textContent = value;
          }
          if (node.childElementCount === 0 && isBlankUi(node.textContent)) {
            node.textContent = value;
          }
        }
      }
    }
  }

  function ensureRepairDateRow(dateStr) {
    if (isBlankUi(dateStr)) return;
    if (findFieldControl('Repair Date') || findFieldControl('Dealer Repair Date')) {
      setByLabels(['Repair Date', 'Dealer Repair Date', 'Repair Start Date'], dateStr, true);
      forceTextNearLabel('Repair Date', dateStr);
      return;
    }
    if (document.getElementById('sdlg-injected-repair-date')) {
      var existing = document.getElementById('sdlg-injected-repair-date');
      var box = existing.querySelector('[data-copy-box]');
      if (box) box.textContent = dateStr;
      return;
    }
    var failLabel = null;
    var labels = Array.from(document.querySelectorAll('label,div,span,strong'));
    for (var i = 0; i < labels.length; i += 1) {
      if (normalizeLabel(labels[i].textContent) === 'failure date') {
        failLabel = labels[i];
        break;
      }
    }
    if (!failLabel) return;
    var host = failLabel.closest('div') || failLabel.parentElement;
    if (!host || !host.parentElement) return;
    var row = document.createElement('div');
    row.id = 'sdlg-injected-repair-date';
    row.setAttribute('data-sdlg-extra-field', 'Repair Date');
    row.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px dashed #94a3b8;border-radius:8px;background:#f8fafc;';
    row.innerHTML =
      '<div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:4px">Repair Date</div>' +
      '<div data-copy-box style="font-size:13px;font-family:ui-monospace,monospace">' + escapeHtml(dateStr) + '</div>' +
      '<button type="button" class="secondary-btn" style="margin-top:6px;min-height:30px;font-size:12px">Copy</button>';
    host.parentElement.insertBefore(row, host.nextSibling);
  }

  function findTextContainer(labelText) {
    var wanted = normalizeLabel(labelText);
    var nodes = Array.from(document.querySelectorAll('label,div,span,p,strong'));
    var hit = nodes.find(function (el) { return normalizeLabel(el.textContent) === wanted; });
    if (!hit) return null;
    var parent = hit;
    for (var i = 0; i < 4 && parent; i += 1, parent = parent.parentElement) {
      if ((parent.innerText || '').length < 1200) return parent;
    }
    return hit.parentElement || hit;
  }

  function writeCanonicalBadge(resolver) {
    if (!resolver) return;
    var old = document.getElementById('sdlg-canonical-warranty-badge');
    if (old) old.remove();
    var machineStatus = displayStatus(resolver.machine_status);
    var componentStatus = displayStatus(resolver.component_status);
    var overallStatus = displayStatus(resolver.overall_status);
    var category = clean(resolver.component_category);
    var tier = clean(resolver.warranty_tier_used);
    var scope = clean(resolver.model_scope);
    var reason = clean(resolver.reason || resolver.overall_reason || resolver.component_reason);
    var policies = Array.isArray(resolver.machine_policies) ? resolver.machine_policies : [];

    var coverageClass = clean(resolver.component_coverage_class);
    var policyVariant = clean(resolver.component_policy_variant);
    var categorySource = clean(resolver.component_category_source);
    var expiryBasis = clean(resolver.expiry_basis);
    var salesExpiry = clean(resolver.after_sales_expiry_date);
    var blMaximum = clean(resolver.after_departure_expiry_date);
    var effectiveExpiry = clean(resolver.effective_expiry_date);
    var finalRoute = clean(resolver.final_route);
    var finalRouteReason = clean(resolver.final_route_reason);

    var matrixHtml = '';
    if (policies.length) {
      matrixHtml = '<div style="margin-top:8px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr style="text-align:left;background:#e2e8f0"><th style="padding:4px 6px">Category</th><th style="padding:4px 6px">Status</th><th style="padding:4px 6px">Months</th><th style="padding:4px 6px">Hours</th><th style="padding:4px 6px">Expiry</th></tr></thead><tbody>' +
        policies.map(function (p) {
          return '<tr style="border-top:1px solid #cbd5e1">' +
            '<td style="padding:4px 6px">' + escapeHtml(p.component_category) + (p.is_claim_component ? ' <b>*</b>' : '') + '</td>' +
            '<td style="padding:4px 6px">' + escapeHtml(displayStatus(p.status)) + '</td>' +
            '<td style="padding:4px 6px">' + escapeHtml(p.warranty_months) + '</td>' +
            '<td style="padding:4px 6px">' + escapeHtml(p.warranty_hours) + '</td>' +
            '<td style="padding:4px 6px">' + escapeHtml(p.effective_expiry_date || '\u2014') + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    }

    var badge = document.createElement('div');
    badge.id = 'sdlg-canonical-warranty-badge';
    badge.style.cssText = 'margin:12px 0;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;font-size:13px;line-height:1.5;';
    badge.innerHTML = '<b>Canonical Warranty Engine</b><br>' +
      'Machine: <b>' + escapeHtml(machineStatus || '\u2014') + '</b>' +
      (tier ? ' \u00b7 ' + escapeHtml(tier) : '') +
      (scope ? ' \u00b7 Scope: ' + escapeHtml(scope) : '') +
      (category ? '<br>Claim category: <b>' + escapeHtml(category) + '</b>' : '') +
      (coverageClass ? '<br>Coverage class: <b>' + escapeHtml(coverageClass) + '</b>' : '') +
      (policyVariant ? ' \u00b7 Policy variant: <b>' + escapeHtml(policyVariant) + '</b>' : '') +
      (categorySource ? '<br>Category source: <b>' + escapeHtml(categorySource) + '</b>' : '') +
      (expiryBasis ? ' \u00b7 Expiry basis: <b>' + escapeHtml(expiryBasis) + '</b>' : '') +
      (salesExpiry ? '<br>SDLG: Sales expiry: <b>' + escapeHtml(salesExpiry) + '</b>' : '') +
      (blMaximum ? ' \u00b7 SDLG: B/L maximum: <b>' + escapeHtml(blMaximum) + '</b>' : '') +
      (effectiveExpiry ? '<br>SDLG: Effective expiry: <b>' + escapeHtml(effectiveExpiry) + '</b>' : '') +
      '<br>Component: <b>' + escapeHtml(componentStatus || '\u2014') + '</b>' +
      ' \u00b7 Overall: <b>' + escapeHtml(overallStatus || '\u2014') + '</b>' +
      (finalRoute ? ' \u00b7 Final Route: <b>' + escapeHtml(finalRoute) + '</b>' : '') +
      (finalRouteReason ? '<br>Final routing reason: <span style="color:#475569">' + escapeHtml(finalRouteReason) + '</span>' : '') +
      (reason && !finalRouteReason ? '<br><span style="color:#475569">' + escapeHtml(reason) + '</span>' : '') +
      matrixHtml;
    var anchor = findTextContainer('Warranty Engine');
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(badge, anchor.nextSibling);
    else if (document.body) document.body.insertBefore(badge, document.body.firstChild);
  }

  function applyReportNameShort(claim) {
    var full = clean(claim && claim.fault_description);
    var shortComplaint = shortenComplaint(full);
    if (!full || !shortComplaint || shortComplaint === full) return;
    document.querySelectorAll('[data-value], [data-sdlg-copy-report-name]').forEach(function (el) {
      var cur = el.getAttribute('data-value') || '';
      if (cur.indexOf(full) >= 0) el.setAttribute('data-value', cur.split(full).join(shortComplaint));
    });
    document.querySelectorAll('code, pre, [style*="monospace"]').forEach(function (el) {
      if (el.childElementCount > 0) return;
      var t = el.textContent || '';
      if (t.indexOf(full) >= 0) el.textContent = t.split(full).join(shortComplaint);
    });
  }

  function applyClaimData(claim, resolver) {
    if (!claim) return;

    var person = feedbackPersonValue(claim);
    var repairDt = repairDateValue(claim);
    var serviceMethod = clean(claim.repair_method);
    var serviceType = clean(claim.service_type) || 'Repair';

    setByLabels(['Service Type'], serviceType, true);
    setByLabels(['Service Method'], serviceMethod, true);
    forceTextNearLabel('Service Method', serviceMethod);

    setByLabels(['Serial number', 'Serial Number', 'Serial No'], clean(claim.serial_no), true);
    setByLabels(['Hour meter', 'Hour Meter', 'HM'], claim.hm_failure != null ? String(claim.hm_failure) : '', true);

    setByLabels(['Whole Machine Warranty'], wholeMachineLabel(resolver), true);

    setByLabels(['Feedback Person'], person, true);
    forceTextNearLabel('Feedback Person', person);

    setByLabels(['Failure Date'], formatPortalDate(claim.failure_date), true);
    setByLabels(['Repair Date', 'Dealer Repair Date', 'Repair Start Date'], repairDt, true);
    ensureRepairDateRow(repairDt);

    setByLabels(['Complaint'], clean(claim.fault_description), false);
    setByLabels(['Fault Details', 'Fault Detail'], clean(claim.cause_analyze) || clean(claim.comment), false);

    var loc = clean(claim.work_location) || clean(claim.failure_part_location) || clean(claim.branch_name);
    setByLabels(['Machine Location'], loc, true);

    if (claim.hm_completion != null && !isBlankUi(claim.hm_completion)) {
      setByLabels(['Repair Labor (Hrs)', 'Repair Labor (Hrs)', 'Repair Labor'], String(claim.hm_completion), true);
    }

    if (claim.mileage_km != null && !isBlankUi(claim.mileage_km)) {
      setByLabels(['Service Mileage (Km)', 'Service Mileage', 'Mileage'], String(claim.mileage_km), true);
    }

    if (claim.labour_amount != null) setByLabels(['Labour Amount'], String(claim.labour_amount), true);
    if (claim.mileage_amount != null) setByLabels(['Mileage Amount'], String(claim.mileage_amount), true);
    if (claim.other_amount != null) setByLabels(['Other Amount'], String(claim.other_amount), true);
    if (claim.total_amount != null) setByLabels(['Total Amount Claimed'], String(claim.total_amount), true);

    applyReportNameShort(claim);
  }

  function hasRelevantWarrantyUi() {
    return Boolean(
      findFieldControl('Feedback Person') ||
      findFieldControl('Whole Machine Warranty') ||
      findFieldControl('Failure Date') ||
      document.querySelector('[data-sdlg-copy-report-name]') ||
      /Warranty Claim Input Helper/i.test(document.body ? document.body.innerText : '')
    );
  }

  async function run() {
    var claimId = findClaimId();
    if (!claimId || !hasRelevantWarrantyUi()) return;

    var sequence = ++runSequence;

    try {
      var results = await Promise.all([loadClaim(claimId), loadResolver(claimId)]);
      if (sequence !== runSequence || findClaimId() !== claimId) return;

      var claim = results[0];
      var resolver = results[1];
      var key =
        claimId +
        '|' +
        clean(claim && claim.technical_personnel) +
        '|' +
        clean(claim && claim.dealer_repair_date) +
        '|' +
        clean(claim && claim.completion_date) +
        '|' +
        clean(resolver && resolver.component_status);
      if (key === lastAppliedKey && document.getElementById('sdlg-canonical-warranty-badge')) {
        applyClaimData(claim, resolver);
        return;
      }

      applyClaimData(claim, resolver);

      if (sequence !== runSequence || findClaimId() !== claimId) return;

      writeCanonicalBadge(resolver);
      lastAppliedKey = key;
      window.__SDLG_HELPER_LAST__ = { claimId: claimId, claim: claim, resolver: resolver };
    } catch (err) {
      if (sequence !== runSequence || findClaimId() !== claimId) return;
      console.warn('[SDLG Helper canonical]', err && err.message ? err.message : err);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      run();
    }, 300);
  }

  function start() {
    if (hasRelevantWarrantyUi()) schedule();
    var observer = new MutationObserver(function () {
      if (hasRelevantWarrantyUi()) schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.__SDLG_CANONICAL_RPC_ANCHOR__ = function (client, claimId) {
    if (!client || typeof client.rpc !== 'function') return null;
    return client.rpc('sdlg_warranty_resolve_claim', { p_claim_id: claimId });
  };
  window.__SDLG_CANONICAL_RPC_NAME__ = 'sdlg_warranty_resolve_claim';
  window.__SDLG_CLAIM_ID_RE__ = /\b\d{4}-\d{4}-SDLG-PFR\b/;
  window.__SDLG_FIND_CLAIM_ID__ = findClaimId;
  window.SDLGCanonicalWarrantyHelper = { version: '1.2.0', refresh: run };
})();
