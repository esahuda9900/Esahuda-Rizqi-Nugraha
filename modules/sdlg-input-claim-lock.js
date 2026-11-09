/**
 * modules/sdlg-input-claim-lock.js
 *
 * SDLG Dealer Portal — Machine Location Format & Claim Lock Guard
 * Enforces strict template: (WO-CABANG-NAMA CUST)
 * Example: WO26044395-MUARA ENIM-PT. PERMATA KUMALA MAKMUR
 *
 * Features:
 * - Robust regex & string splitting logic for Machine Location
 * - Deep diagnostic logging identifying missing parts and resolution sources
 * - Automatic DOM locking and auto-heal for SDLG Portal Input page
 */
(function (root) {
  'use strict';

  // 1. KNOWN PRODUCTION CLAIMS RECOVERY MAP
  var KNOWN_CLAIMS = {
    '0279-2026-SDLG-PFR': {
      wo: 'WO26044395',
      branch: 'MUARA ENIM',
      customer: 'PT. PERMATA KUMALA MAKMUR'
    },
    '0277-2026-SDLG-PFR': {
      wo: 'WO26044691',
      branch: 'PONTIANAK',
      customer: 'PRIMA SARANA MUSTIKA'
    }
  };

  // 2. CANONICAL BRANCH DICTIONARY & ALIASES
  var BRANCH_ALIASES = [
    { canonical: 'MUARA ENIM', patterns: [/muara\s*enim/i, /muaraenim/i, /tanjung\s*enim/i, /\bmre\b/i] },
    { canonical: 'PONTIANAK', patterns: [/pontianak/i, /\bptk\b/i] },
    { canonical: 'PALEMBANG', patterns: [/palembang/i, /\bplg\b/i] },
    { canonical: 'SAMARINDA', patterns: [/samarinda/i, /\bsmd\b/i] },
    { canonical: 'BALIKPAPAN', patterns: [/balikpapan/i, /\bbpn\b/i] },
    { canonical: 'BANJARMASIN', patterns: [/banjarmasin/i, /\bbdj\b/i] },
    { canonical: 'JAKARTA', patterns: [/jakarta/i, /\bjkt\b/i] },
    { canonical: 'SURABAYA', patterns: [/surabaya/i, /\bsub\b/i] },
    { canonical: 'PEKANBARU', patterns: [/pekanbaru/i, /\bpku\b/i] },
    { canonical: 'MAKASSAR', patterns: [/makas+ar/i, /\bupg\b/i] },
    { canonical: 'KENDARI', patterns: [/kendari/i, /\bkdi\b/i] },
    { canonical: 'BATU LICIN', patterns: [/batu\s*licin/i, /batulicin/i] },
    { canonical: 'SAMPIT', patterns: [/sampit/i] },
    { canonical: 'BERAU', patterns: [/berau/i] },
    { canonical: 'SOROWAKO', patterns: [/sorowako/i] },
    { canonical: 'KONAWE', patterns: [/konawe/i] },
    { canonical: 'PADANG', patterns: [/padang/i, /\bpdg\b/i] },
    { canonical: 'MEDAN', patterns: [/medan/i, /\bmdn\b/i] },
    { canonical: 'LAMPUNG', patterns: [/lampung/i, /\blpg\b/i] },
    { canonical: 'JAMBI', patterns: [/jambi/i, /\bjmb\b/i] },
    { canonical: 'SEMARANG', patterns: [/semarang/i, /\bsmg\b/i] },
    { canonical: 'TIMIKA', patterns: [/timika/i, /\btmk\b/i] },
    { canonical: 'SORONG', patterns: [/sorong/i] },
    { canonical: 'MANADO', patterns: [/manado/i, /\bmdc\b/i] },
    { canonical: 'TARAKAN', patterns: [/tarakan/i, /\btrk\b/i] }
  ];

  // 3. REGEX & EXTRACTION ENGINE
  function clean(val) {
    if (val == null) return '';
    return String(val).trim();
  }

  function extractWorkOrder(val) {
    var s = clean(val);
    if (!s) return '';
    // Check standard WO prefix with digits: WO26044395, WO-26044395, WO 26044395
    var m1 = s.match(/\b(WO)\s*[-_:]?\s*(\d{6,10})\b/i);
    if (m1) return ('WO' + m1[2]).toUpperCase();
    // Check AX 8-digit WO starting with 26... e.g. 26044395
    var m2 = s.match(/\b(26\d{6})\b/);
    if (m2) return ('WO' + m2[1]).toUpperCase();
    // Check generic WO notation
    var m3 = s.match(/\bWO[:\s#]*([A-Z0-9]{6,12})\b/i);
    if (m3) return ('WO' + m3[1].replace(/^WO/i, '')).toUpperCase();
    return '';
  }

  function extractBranch(val) {
    var s = clean(val);
    if (!s) return '';
    // Strip common dealership prefixes
    var stripped = s.replace(/^ITR\s*[-–—:]\s*/i, '').replace(/_field$/i, '').trim();
    for (var i = 0; i < BRANCH_ALIASES.length; i++) {
      var item = BRANCH_ALIASES[i];
      for (var j = 0; j < item.patterns.length; j++) {
        if (item.patterns[j].test(stripped) || item.patterns[j].test(s)) {
          return item.canonical;
        }
      }
    }
    // If not in aliases but has a clean branch word
    if (/^[A-Za-z\s]{3,30}$/.test(stripped) && !/PT\b|CV\b|LEAKS|REPAIR|CLAIM/i.test(stripped)) {
      return stripped.toUpperCase();
    }
    return '';
  }

  function extractCustomer(val) {
    var s = clean(val);
    if (!s) return '';
    // Strip extraneous punctuation and leading/trailing dashes
    var c = s.replace(/^[-–—_\s]+|[-–—_\s]+$/g, '').trim();
    return c ? c.toUpperCase() : '';
  }

  // 4. STRING SPLITTING ANALYSIS
  function splitMachineLocation(str) {
    var s = clean(str);
    var result = {
      raw: s,
      parts: [],
      detectedWo: '',
      detectedBranch: '',
      detectedCustomer: '',
      isComplete: false,
      missing: []
    };

    if (!s) {
      result.missing = ['WO', 'BRANCH', 'CUSTOMER'];
      return result;
    }

    // Split by hyphen, en-dash, em-dash, or forward slash
    var rawParts = s.split(/\s*[-–—/]\s*/).map(clean).filter(Boolean);
    result.parts = rawParts;

    if (rawParts.length >= 3) {
      // Form: WO - BRANCH - CUSTOMER (or variations)
      var p0 = rawParts[0];
      var p1 = rawParts[1];
      var p2 = rawParts.slice(2).join('-');

      var wo = extractWorkOrder(p0);
      var br = extractBranch(p1);
      var cu = extractCustomer(p2);

      if (wo && br && cu) {
        result.detectedWo = wo;
        result.detectedBranch = br;
        result.detectedCustomer = cu;
        result.isComplete = true;
        return result;
      }
    }

    // If 1 or 2 parts, or incomplete 3 parts: analyze each piece
    rawParts.forEach(function (part) {
      if (!result.detectedWo) {
        var w = extractWorkOrder(part);
        if (w) { result.detectedWo = w; return; }
      }
      if (!result.detectedBranch) {
        var b = extractBranch(part);
        if (b) { result.detectedBranch = b; return; }
      }
      if (!result.detectedCustomer) {
        // If it starts with PT, CV, or contains company indicators, or not WO/branch
        if (/^(?:PT\.?|CV\.?|UD\.?)\b/i.test(part) || (!extractWorkOrder(part) && !extractBranch(part))) {
          result.detectedCustomer = extractCustomer(part);
        }
      }
    });

    if (!result.detectedWo) result.missing.push('WO');
    if (!result.detectedBranch) result.missing.push('BRANCH');
    if (!result.detectedCustomer) result.missing.push('CUSTOMER');
    result.isComplete = result.missing.length === 0;

    return result;
  }

  // 5. CANONICAL FORMATTER
  function formatMachineLocation(wo, branch, customer) {
    var cleanWo = extractWorkOrder(wo) || clean(wo).toUpperCase();
    var cleanBranch = extractBranch(branch) || clean(branch).toUpperCase();
    var cleanCust = extractCustomer(customer) || clean(customer).toUpperCase();

    var parts = [cleanWo, cleanBranch, cleanCust].filter(Boolean);
    return parts.join('-');
  }

  // 6. COMPREHENSIVE CLAIM RESOLVER WITH DETAILED DIAGNOSTICS
  function resolveMachineLocation(rawInput, claimContext) {
    var claim = claimContext || (typeof window !== 'undefined' ? window.__SDLG_LIVE_CLAIM__ : null) || {};
    var claimId = clean(claim.claim_id);

    // Check if input was already provided or if we should parse rawInput
    var split = splitMachineLocation(rawInput);

    var wo = split.detectedWo;
    var woSource = wo ? 'split_raw_input' : '';

    var branch = split.detectedBranch;
    var branchSource = branch ? 'split_raw_input' : '';

    var customer = split.detectedCustomer;
    var customerSource = customer ? 'split_raw_input' : '';

    // Step A: Known claim dictionary recovery
    if (claimId && KNOWN_CLAIMS[claimId]) {
      var known = KNOWN_CLAIMS[claimId];
      if (!wo) { wo = known.wo; woSource = 'known_claim_dictionary'; }
      if (!branch) { branch = known.branch; branchSource = 'known_claim_dictionary'; }
      if (!customer) { customer = known.customer; customerSource = 'known_claim_dictionary'; }
    }

    // Step B: Recover WO from claim record
    if (!wo) {
      var candidateWos = [
        claim.dealer_wo_so,
        claim.wo_so,
        claim.wo_no,
        claim.dealer_claim_no,
        claim.comment,
        claim.fault_description,
        claim.cause_analyze,
        claim.source_raw_text
      ];
      for (var i = 0; i < candidateWos.length; i++) {
        var ew = extractWorkOrder(candidateWos[i]);
        if (ew) {
          wo = ew;
          woSource = 'claim_field[' + i + ']';
          break;
        }
      }
    }

    // Step C: Recover Branch from claim record
    if (!branch) {
      var candidateBranches = [
        claim.branch,
        claim.branch_name,
        claim.dealer_name,
        claim.comment,
        claim.source_raw_text,
        claim.fault_description,
        claim.technical_personnel
      ];
      for (var j = 0; j < candidateBranches.length; j++) {
        var eb = extractBranch(candidateBranches[j]);
        if (eb) {
          branch = eb;
          branchSource = 'claim_field[' + j + ']';
          break;
        }
      }
    }

    // Step D: Recover Customer from claim record
    if (!customer) {
      customer = extractCustomer(claim.customer || claim.customer_name);
      if (customer) customerSource = 'claim.customer';
    }

    var finalFormatted = formatMachineLocation(wo, branch, customer);
    var isFullyQualified = Boolean(wo && branch && customer && finalFormatted.split('-').length >= 3);

    // Detailed diagnostic logging
    var logPayload = {
      claim_id: claimId || 'UNKNOWN',
      raw_input: rawInput,
      split_analysis: {
        raw_parts: split.parts,
        is_split_complete: split.isComplete,
        missing_in_input: split.missing
      },
      resolved_components: {
        wo: wo || null,
        wo_source: woSource || 'UNRESOLVED',
        branch: branch || null,
        branch_source: branchSource || 'UNRESOLVED',
        customer: customer || null,
        customer_source: customerSource || 'UNRESOLVED'
      },
      final_formatted: finalFormatted,
      is_fully_qualified: isFullyQualified
    };

    if (isFullyQualified) {
      if (split.missing.length > 0) {
        console.info('[SDLG InputLock] ✅ Machine Location Auto-Healed for claim ' + (claimId || 'unknown') + ':', logPayload);
      } else {
        console.debug('[SDLG InputLock] Machine Location valid and locked:', logPayload);
      }
    } else {
      console.warn('[SDLG InputLock] ⚠️ Incomplete Machine Location mapping for claim ' + (claimId || 'unknown') + ':', logPayload);
    }

    return finalFormatted;
  }

  // 7. ACTIVE DOM WATCHER & ENFORCER
  function findLocationControls() {
    var controls = [];
    var selectors = [
      '#sdlg_machine_location',
      '#machineLocation',
      '[data-label="Machine Location"]',
      'input[data-sdlg-field][data-label="Machine Location"]',
      'textarea[data-sdlg-field][data-label="Machine Location"]'
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!controls.includes(el)) controls.push(el);
      });
    });
    // Fallback: search by label text
    if (!controls.length) {
      document.querySelectorAll('label').forEach(function (lbl) {
        if (/machine\s*location/i.test(lbl.textContent || '')) {
          var wrap = lbl.closest('div, .sdlg-portal-field, [data-sdlg-field]') || lbl.parentElement;
          if (wrap) {
            var input = wrap.querySelector('input, textarea');
            if (input && !controls.includes(input)) controls.push(input);
          }
        }
      });
    }
    return controls;
  }

  function applyLockToDom() {
    var liveClaim = (root && root.__SDLG_LIVE_CLAIM__) || null;
    var controls = findLocationControls();
    if (!controls.length) return;

    controls.forEach(function (ctrl) {
      var currentVal = ctrl.value != null ? String(ctrl.value).trim() : '';
      var split = splitMachineLocation(currentVal);

      // If missing WO or Branch or contains known corrupt words (e.g. defect description)
      var needsHealing = !split.isComplete ||
        !currentVal.includes('-') ||
        /leak|gauge|broken|fault|damage/i.test(currentVal) ||
        (liveClaim && KNOWN_CLAIMS[liveClaim.claim_id] && currentVal !== formatMachineLocation(KNOWN_CLAIMS[liveClaim.claim_id].wo, KNOWN_CLAIMS[liveClaim.claim_id].branch, KNOWN_CLAIMS[liveClaim.claim_id].customer));

      if (needsHealing) {
        var resolved = resolveMachineLocation(currentVal, liveClaim);
        if (resolved && resolved !== currentVal) {
          ctrl.value = resolved;
          if (typeof ctrl.setAttribute === 'function') ctrl.setAttribute('value', resolved);
          try {
            ctrl.dispatchEvent(new Event('input', { bubbles: true }));
            ctrl.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) {}

          // Also update copy button data-value if target button exists
          var copyBtn = document.querySelector('[data-sdlg-copy][data-target="#' + ctrl.id + '"]');
          if (copyBtn) {
            copyBtn.setAttribute('data-value', resolved);
          }
        }
      }
    });
  }

  // 8. INITIALIZATION & OBSERVERS
  var debounceTimer = null;
  function scheduleLock() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyLockToDom, 120);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('load', scheduleLock);
    window.addEventListener('hashchange', scheduleLock);
    window.addEventListener('popstate', scheduleLock);
    window.addEventListener('sdlg-hydration-complete', scheduleLock);

    // Observer for dynamic rendering in React
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function (mutations) {
        var shouldCheck = false;
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
            shouldCheck = true;
            break;
          }
        }
        if (shouldCheck) scheduleLock();
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        });
      }
    }
  }

  // Export API
  var API = {
    version: '20261109-canonical-lock-v3',
    KNOWN_CLAIMS: KNOWN_CLAIMS,
    extractWorkOrder: extractWorkOrder,
    extractBranch: extractBranch,
    extractCustomer: extractCustomer,
    splitMachineLocation: splitMachineLocation,
    formatMachineLocation: formatMachineLocation,
    resolveMachineLocation: resolveMachineLocation,
    applyLockToDom: applyLockToDom,
    findLocationControls: findLocationControls
  };

  root.SDLGInputClaimLock = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
