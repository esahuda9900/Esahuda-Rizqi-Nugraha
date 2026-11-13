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

  // 2. COMPONENT, PART & DEFECT BLACKLIST
  // These terms describe machine parts, assemblies, or failures and must NEVER be treated as branches.
  var COMPONENT_OR_FAULT_PATTERN = /\b(roller|idler|track|link|shoe|bushing|pin|sprocket|carrier|bucket|boom|arm|cylinder|seal|sealing|gasket|o-?ring|hose|tube|pipe|fitting|valve|spool|pump|motor|engine|turbo|turbocharger|injector|nozzle|manifold|muffler|silencer|radiator|cooler|fan|belt|alternator|starter|battery|harness|wiring|sensor|switch|relay|controller|ecm|ecu|display|monitor|transmission|torque|converter|axle|differential|brake|caliper|disc|pad|tire|tyre|wheel|rim|cabin|cab|glass|door|light|lamp|air\s*conditioner|ac|compressor|condenser|evaporator|heater|grease|bearing|shaft|gear|exhaust|oil|fuel|water|coolant|leak|leaking|leakage|broken|crack|cracking|cracked|damage|damaged|burst|burnt|stuck|jammed|noise|noisy|vibration|loose|loosen|hot|overheat|drop|smoke|error|fault|failure|problem|trouble|repair|replace|replacement|service|inspect|check|maintenance|assy|assembly|kit|part|parts|so|wo|pfr|unit|machine)\b/i;

  function isComponentOrFault(val) {
    if (!val) return false;
    return COMPONENT_OR_FAULT_PATTERN.test(String(val));
  }

  // 3. CANONICAL BRANCH DICTIONARY & ALIASES
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
    { canonical: 'TARAKAN', patterns: [/tarakan/i, /\btrk\b/i] },
    { canonical: 'BENGKULU', patterns: [/bengkulu/i, /\bbkl\b/i] },
    { canonical: 'KETAPANG', patterns: [/ketapang/i, /\bktp\b/i] },
    { canonical: 'MEULABOH', patterns: [/meulaboh/i, /\bmeu\b/i] },
    { canonical: 'LAHAT', patterns: [/lahat/i, /\blht\b/i] },
    { canonical: 'PANGKAL PINANG', patterns: [/pangkal\s*pinang/i, /\bpkp\b/i] },
    { canonical: 'BONTANG', patterns: [/bontang/i, /\bbtg\b/i] },
    { canonical: 'SANGATTA', patterns: [/sangatta/i, /\bsgt\b/i] },
    { canonical: 'TANAH BUMBU', patterns: [/tanah\s*bumbu/i, /\btnb\b/i] },
    { canonical: 'TABALONG', patterns: [/tabalong/i, /\btbg\b/i] },
    { canonical: 'MOROWALI', patterns: [/morowali/i, /\bmrw\b/i] },
    { canonical: 'LUWUK', patterns: [/luwuk/i, /\blwk\b/i] },
    { canonical: 'AMBON', patterns: [/ambon/i, /\bamb\b/i] },
    { canonical: 'JAYAPURA', patterns: [/jayapura/i, /\bdjj\b/i] },
    { canonical: 'TANJUNG REDEB', patterns: [/tanjung\s*redeb/i, /\btjr\b/i] }
  ];

  // 4. REGEX & EXTRACTION ENGINE
  function clean(val) {
    if (val == null) return '';
    return String(val).trim();
  }

  function isPlaceholderToken(val) {
    var s = clean(val);
    if (!s) return true;
    return /^[-–—_./]+$/.test(s) || /^(?:n\/?a|none|null|undefined|unknown|kosong|xxx+|\?+)$/i.test(s);
  }

  function extractWorkOrder(val, appCode, isExplicitField) {
    var s = clean(val);
    if (!s || isPlaceholderToken(s)) return '';
    if (appCode && s.toUpperCase() === clean(appCode).toUpperCase()) return '';

    // Check standard WO prefix with digits: WO26044395, WO-26044395, WO 25036764
    var m1 = s.match(/\b(WO)\s*[-_:]?\s*(\d{6,10})\b/i);
    if (m1) return ('WO' + m1[2]).toUpperCase();

    // Check standard SO prefix with digits: SO26041234, SO-25012345
    var mSo = s.match(/\b(SO)\s*[-_:]?\s*(\d{6,10})\b/i);
    if (mSo) return ('SO' + mSo[2]).toUpperCase();

    // Check AX 8-digit WO across 2023-2029 (23xxxxxx..29xxxxxx; never matches YYYYMMDD 202xxxxx dates)
    var m2 = s.match(/\b(2[3-9]\d{6})\b/);
    if (m2) return ('WO' + m2[1]).toUpperCase();

    // Check generic WO / SO notation with separator
    var m3 = s.match(/\b(WO|SO)\s*[:#/-]\s*([A-Z0-9][A-Z0-9/-]{4,14})\b/i);
    if (m3 && /\d{3,}/.test(m3[2]) && !isPlaceholderToken(m3[2])) {
      var prefix = m3[1].toUpperCase();
      var body = m3[2].replace(/^[-_:/\s]+/, '').toUpperCase();
      if (body.indexOf(prefix) === 0) return body;
      return prefix + body;
    }

    // Explicit dedicated WO/SO column fallback (e.g., AX-WO..., 25/04/1234, etc.)
    if (isExplicitField && s.length >= 4 && s.length <= 24 && /\d{3,}/.test(s) && !isComponentOrFault(s)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) && !/^20\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(s)) {
        return s.toUpperCase();
      }
    }

    return '';
  }

  function extractBranch(val, isStrict) {
    var s = clean(val);
    if (!s || isPlaceholderToken(s)) return '';
    if (isComponentOrFault(s)) return '';

    // Strip common dealership prefixes
    var stripped = s.replace(/^ITR\s*[-–—:]\s*/i, '').replace(/_field$/i, '').trim();
    if (isComponentOrFault(stripped)) return '';

    for (var i = 0; i < BRANCH_ALIASES.length; i++) {
      var item = BRANCH_ALIASES[i];
      for (var j = 0; j < item.patterns.length; j++) {
        if (item.patterns[j].test(stripped) || item.patterns[j].test(s)) {
          return item.canonical;
        }
      }
    }

    // Only allow explicit non-strict branch field if it looks like a clean geographic name
    if (!isStrict) {
      if (/^[A-Za-z\s]{3,30}$/.test(stripped) &&
          !/PT\b|CV\b|LEAKS|REPAIR|CLAIM|FAULT|DAMAGE|SERVICE|REPORT|STATUS/i.test(stripped) &&
          !isComponentOrFault(stripped)) {
        return stripped.toUpperCase();
      }
    }
    return '';
  }

  function resolveBranchFromMasterId(branchId) {
    var id = clean(branchId);
    if (!id) return '';
    var list = (typeof window !== 'undefined' && Array.isArray(window.__SDLG_BRANCHES__)) ? window.__SDLG_BRANCHES__ : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === String(id) && list[i].branch_name) {
        var b = extractBranch(list[i].branch_name, false);
        if (b) return b;
      }
    }
    if (/^ITR\s*[-–—:]/i.test(id)) {
      return extractBranch(id, false);
    }
    return '';
  }

  function extractCustomer(val) {
    var s = clean(val);
    if (!s || isPlaceholderToken(s)) return '';
    // Strip extraneous punctuation and leading/trailing dashes
    var c = s.replace(/^[-–—_\s]+|[-–—_\s]+$/g, '').trim();
    if (!c || isComponentOrFault(c)) return '';
    return c.toUpperCase();
  }

  function mergeClaimWithPool(claim) {
    if (!claim) return {};
    var out = {};
    var k;
    for (k in claim) {
      if (Object.prototype.hasOwnProperty.call(claim, k)) out[k] = claim[k];
    }
    var claimId = clean(out.claim_id);
    if (typeof window !== 'undefined') {
      var live = window.__SDLG_LIVE_CLAIM__;
      if (live && claimId && clean(live.claim_id) === claimId) {
        for (k in live) {
          if (Object.prototype.hasOwnProperty.call(live, k) && (out[k] == null || out[k] === '')) {
            out[k] = live[k];
          }
        }
      }
      var pool = window.__SDLG_ALL_CLAIMS__ || window.allClaims || window.__ALL_CLAIMS__ || [];
      if (Array.isArray(pool) && claimId) {
        for (var i = 0; i < pool.length; i++) {
          var row = pool[i];
          if (row && clean(row.claim_id) === claimId) {
            for (k in row) {
              if (Object.prototype.hasOwnProperty.call(row, k) && (out[k] == null || out[k] === '')) {
                out[k] = row[k];
              }
            }
            break;
          }
        }
      }
    }
    return out;
  }

  // 5. CROSS-CLAIM BRANCH RESOLVER
  function findBranchFromOtherClaims(claim) {
    if (!claim) return '';
    var claimsPool = (typeof window !== 'undefined' && (window.__SDLG_ALL_CLAIMS__ || window.allClaims || window.__ALL_CLAIMS__)) || [];
    if (!Array.isArray(claimsPool) || !claimsPool.length) return '';

    var serial = clean(claim.serial_no || claim.canonical_serial_no).toUpperCase();
    var wo = extractWorkOrder(claim.dealer_wo_so || claim.wo_so || claim.wo_no, claim.app_code, true);
    var customer = clean(claim.customer || claim.customer_name).toUpperCase();

    // 1. By exact Serial Number (same machine = same branch)
    if (serial) {
      for (var i = 0; i < claimsPool.length; i++) {
        var c = claimsPool[i];
        if (c && c.claim_id !== claim.claim_id && clean(c.serial_no || c.canonical_serial_no).toUpperCase() === serial) {
          var b = extractBranch(c.branch || c.branch_name || c.branch_name_master || c.dealer_name, true) || resolveBranchFromMasterId(c.branch_id);
          if (b) return b;
        }
      }
    }

    // 2. By exact WO
    if (wo) {
      for (var j = 0; j < claimsPool.length; j++) {
        var c2 = claimsPool[j];
        if (c2 && c2.claim_id !== claim.claim_id && extractWorkOrder(c2.dealer_wo_so || c2.wo_so || c2.wo_no, c2.app_code, true) === wo) {
          var b2 = extractBranch(c2.branch || c2.branch_name || c2.branch_name_master || c2.dealer_name, true) || resolveBranchFromMasterId(c2.branch_id);
          if (b2) return b2;
        }
      }
    }

    // 3. By customer if only one branch exists for customer in pool
    if (customer) {
      var foundBranches = {};
      for (var k = 0; k < claimsPool.length; k++) {
        var c3 = claimsPool[k];
        var c3Cust = clean(c3 && (c3.customer || c3.customer_name)).toUpperCase();
        if (c3 && c3Cust && c3Cust === customer) {
          var b3 = extractBranch(c3.branch || c3.branch_name || c3.branch_name_master || c3.dealer_name, true) || resolveBranchFromMasterId(c3.branch_id);
          if (b3) foundBranches[b3] = (foundBranches[b3] || 0) + 1;
        }
      }
      var branchKeys = Object.keys(foundBranches);
      if (branchKeys.length === 1) return branchKeys[0];
    }

    return '';
  }

  // 6. STRING SPLITTING ANALYSIS
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

      var wo = extractWorkOrder(p0, '', true);
      var br = isComponentOrFault(p1) ? '' : extractBranch(p1, false);
      var cu = isComponentOrFault(p2) ? '' : extractCustomer(p2);

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
      if (isComponentOrFault(part)) return; // Skip components
      if (!result.detectedWo) {
        var w = extractWorkOrder(part, '', false);
        if (w) { result.detectedWo = w; return; }
      }
      if (!result.detectedBranch) {
        var b = extractBranch(part, true);
        if (b) { result.detectedBranch = b; return; }
      }
      if (!result.detectedCustomer) {
        if (/^(?:PT\.?|CV\.?|UD\.?)\b/i.test(part) || (!extractWorkOrder(part, '', false) && !extractBranch(part, false))) {
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

  // 7. CANONICAL FORMATTER
  function formatMachineLocation(wo, branch, customer) {
    var cleanWo = extractWorkOrder(wo, '', true) || (isPlaceholderToken(wo) ? '' : clean(wo).toUpperCase());
    var cleanBranch = isComponentOrFault(branch) ? '' : (extractBranch(branch, false) || (isPlaceholderToken(branch) ? '' : clean(branch).toUpperCase()));
    var cleanCust = isComponentOrFault(customer) ? '' : (extractCustomer(customer) || (isPlaceholderToken(customer) ? '' : clean(customer).toUpperCase()));

    if (isComponentOrFault(cleanBranch)) cleanBranch = '';
    if (isComponentOrFault(cleanCust)) cleanCust = '';

    var parts = [cleanWo, cleanBranch, cleanCust].filter(Boolean);
    return parts.join('-');
  }

  // Bounded diagnostic deduplication to prevent console flooding on exports & React re-renders
  var lastLogByClaim = Object.create(null);
  var lastLogCount = 0;

  function emitDiagnosticLog(claimId, finalFormatted, isFullyQualified, hasBranchAndCust, logPayload, options) {
    if (options && (options.silent === true || options.log === false)) return;
    if (options === false) return;

    var key = (claimId || 'UNKNOWN') + '|' + finalFormatted + '|' + (isFullyQualified ? '1' : '0');
    if (lastLogByClaim[key]) return;
    if (lastLogCount > 250) {
      lastLogByClaim = Object.create(null);
      lastLogCount = 0;
    }
    lastLogByClaim[key] = true;
    lastLogCount += 1;

    if (isFullyQualified) {
      if (logPayload.split_analysis.missing_in_input.length > 0) {
        console.info('[SDLG InputLock] ✅ Machine Location Auto-Healed for claim ' + (claimId || 'unknown') + ':', logPayload);
      } else {
        console.debug('[SDLG InputLock] Machine Location valid and locked:', logPayload);
      }
      return;
    }

    // If branch + customer resolved cleanly and WO is simply not assigned in DB yet, keep console clean (debug only)
    if (hasBranchAndCust && !logPayload.resolved_components.wo) {
      console.debug('[SDLG InputLock] Machine Location pending WO for claim ' + (claimId || 'unknown') + ':', logPayload);
      return;
    }

    console.warn('[SDLG InputLock] ⚠️ Incomplete Machine Location mapping for claim ' + (claimId || 'unknown') + ':', logPayload);
  }

  // 8. COMPREHENSIVE CLAIM RESOLVER WITH DETAILED DIAGNOSTICS
  function resolveMachineLocation(rawInput, claimContext, options) {
    var baseClaim = claimContext || (typeof window !== 'undefined' ? window.__SDLG_LIVE_CLAIM__ : null) || {};
    var claim = mergeClaimWithPool(baseClaim);
    var claimId = clean(claim.claim_id);
    var appCode = clean(claim.app_code);

    // Hydrate empty rawInput from claim.machine_location before splitting
    var effectiveInput = clean(rawInput) || clean(claim.machine_location);
    var split = splitMachineLocation(effectiveInput);

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

    // Step B: Recover WO from claim record & attached AX work orders
    if (!wo) {
      var candidateWos = [
        { val: claim.dealer_wo_so, explicit: true },
        { val: claim.wo_so, explicit: true },
        { val: claim.wo_no, explicit: true },
        { val: claim.ax_wo_no, explicit: true },
        { val: claim.work_order_no, explicit: true },
        { val: claim.so_no, explicit: true },
        { val: claim.machine_location, explicit: false },
        { val: claim.dealer_claim_no, explicit: false },
        { val: claim.fault_description, explicit: false },
        { val: claim.cause_analyze, explicit: false },
        { val: claim.comment, explicit: false },
        { val: claim.source_raw_text, explicit: false }
      ];
      if (Array.isArray(claim.ax_work_orders)) {
        for (var ax = 0; ax < claim.ax_work_orders.length; ax++) {
          var rowAx = claim.ax_work_orders[ax];
          if (rowAx && (rowAx.wo_no || rowAx.work_order_no || rowAx.dealer_wo_so)) {
            candidateWos.push({ val: rowAx.wo_no || rowAx.work_order_no || rowAx.dealer_wo_so, explicit: true });
          }
        }
      }
      for (var i = 0; i < candidateWos.length; i++) {
        var ew = extractWorkOrder(candidateWos[i].val, appCode, candidateWos[i].explicit);
        if (ew) {
          wo = ew;
          woSource = 'claim_field[' + i + ']';
          break;
        }
      }
    }

    // Step C: Recover Branch from claim record (CRITICAL: Never inspect fault/part fields)
    if (!branch) {
      var candidateBranches = [
        claim.branch,
        claim.branch_name,
        claim.branch_name_master,
        claim.dealer_name,
        claim.primary_resource_group,
        claim.branch_location,
        claim.location
      ];
      for (var j = 0; j < candidateBranches.length; j++) {
        var candidate = candidateBranches[j];
        if (candidate && !isComponentOrFault(candidate)) {
          var eb = extractBranch(candidate, false);
          if (eb && !isComponentOrFault(eb)) {
            branch = eb;
            branchSource = 'claim_field[' + j + ']';
            break;
          }
        }
      }
    }

    // Step C.1: Recover Branch from canonical branch_id if available
    if (!branch && claim.branch_id) {
      var masterBranch = resolveBranchFromMasterId(claim.branch_id);
      if (masterBranch && !isComponentOrFault(masterBranch)) {
        branch = masterBranch;
        branchSource = 'branch_id_master';
      }
    }

    // Step C.2: Recover Branch from other claims sharing serial_no, WO, or customer
    if (!branch) {
      var poolBranch = findBranchFromOtherClaims(claim);
      if (poolBranch && !isComponentOrFault(poolBranch)) {
        branch = poolBranch;
        branchSource = 'cross_claim_pool';
      }
    }

    // Step C.3: Check free-text (comment, raw text) with strict branch matching only
    if (!branch) {
      var freeTexts = [claim.comment, claim.source_raw_text];
      for (var ft = 0; ft < freeTexts.length; ft++) {
        var ebStrict = extractBranch(freeTexts[ft], true);
        if (ebStrict && !isComponentOrFault(ebStrict)) {
          branch = ebStrict;
          branchSource = 'free_text[' + ft + ']';
          break;
        }
      }
    }

    // Step D: Recover Customer from claim record
    if (!customer) {
      var candCust = claim.customer || claim.customer_name;
      if (candCust && !isComponentOrFault(candCust)) {
        customer = extractCustomer(candCust);
        if (customer) customerSource = 'claim.customer';
      }
    }

    var finalFormatted = formatMachineLocation(wo, branch, customer);
    var isFullyQualified = Boolean(wo && branch && customer && finalFormatted.split('-').length >= 3);

    // Detailed diagnostic logging
    var logPayload = {
      claim_id: claimId || 'UNKNOWN',
      raw_input: effectiveInput,
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

    emitDiagnosticLog(claimId, finalFormatted, isFullyQualified, Boolean(branch && customer), logPayload, options);

    return finalFormatted;
  }

  // 7. ACTIVE DOM WATCHER & ENFORCER
  function findLocationControls() {
    var controls = [];
    var selectors = [
      '#sdlg_machine_location',
      '#sdlg_machineLocation',
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

      // If missing WO or Branch or contains known corrupt words (parts, defects, faults)
      var hasCorruptPart = isComponentOrFault(currentVal) ||
        /leak|gauge|broken|fault|damage|roller|idler|track|link|shoe|cylinder|hose|pump|valve|seal|filter|muffler/i.test(currentVal);

      var needsHealing = !split.isComplete ||
        !currentVal.includes('-') ||
        hasCorruptPart ||
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

  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !root.__SDLG_INPUT_LOCK_OBSERVERS__) {
    root.__SDLG_INPUT_LOCK_OBSERVERS__ = true;
    window.addEventListener('load', scheduleLock);
    window.addEventListener('hashchange', scheduleLock);
    window.addEventListener('popstate', scheduleLock);
    window.addEventListener('sdlg-hydration-complete', scheduleLock);

    // Observer for dynamic rendering in React (scoped to #root if present)
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

      var attachObserver = function () {
        var target = document.getElementById('root') || document.body;
        if (target) observer.observe(target, { childList: true, subtree: true });
      };
      if (document.body) {
        attachObserver();
      } else {
        document.addEventListener('DOMContentLoaded', attachObserver, { once: true });
      }
    }
  }

  // Export API
  var API = {
    version: '20261113-canonical-lock-v4',
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
