/**
 * modules/paste-parse-ux.js
 *
 * SDLG Dealer Portal — Paste & Parse UX Helper
 * Parses raw warranty texts and extracts machine location following
 * the strict canonical template: (WO-CABANG-NAMA CUST)
 * e.g., WO26044395-MUARA ENIM-PT. PERMATA KUMALA MAKMUR
 */
(function (root) {
  'use strict';

  var LOCK = root.SDLGInputClaimLock || null;

  function getLock() {
    return root.SDLGInputClaimLock || null;
  }

  function clean(s) {
    return s == null ? '' : String(s).trim();
  }

  // Branch dictionary for paste parsing
  var KNOWN_BRANCHES = [
    'MUARA ENIM', 'TANJUNG ENIM', 'PONTIANAK', 'PALEMBANG', 'SAMARINDA',
    'BALIKPAPAN', 'BANJARMASIN', 'JAKARTA', 'SURABAYA', 'PEKANBARU',
    'MAKASSAR', 'KENDARI', 'BATU LICIN', 'BATULICIN', 'SAMPIT', 'BERAU',
    'SOROWAKO', 'KONAWE', 'PADANG', 'MEDAN', 'LAMPUNG', 'JAMBI',
    'SEMARANG', 'TIMIKA', 'SORONG', 'MANADO', 'TARAKAN'
  ];

  function extractWorkOrder(text) {
    var l = getLock();
    if (l && typeof l.extractWorkOrder === 'function') {
      return l.extractWorkOrder(text);
    }
    var s = clean(text);
    var m1 = s.match(/\b(WO)\s*[-_:]?\s*(\d{6,10})\b/i);
    if (m1) return ('WO' + m1[2]).toUpperCase();
    var m2 = s.match(/\b(26\d{6})\b/);
    if (m2) return ('WO' + m2[1]).toUpperCase();
    return '';
  }

  function extractBranch(text) {
    var l = getLock();
    if (l && typeof l.extractBranch === 'function') {
      return l.extractBranch(text);
    }
    var s = clean(text);
    var stripped = s.replace(/^ITR\s*[-–—:]\s*/i, '').replace(/_field$/i, '').trim();
    for (var i = 0; i < KNOWN_BRANCHES.length; i++) {
      var b = KNOWN_BRANCHES[i];
      var re = new RegExp('\\b' + b.replace(/\s+/g, '\\s*') + '\\b', 'i');
      if (re.test(stripped) || re.test(s)) return b;
    }
    return '';
  }

  function extractCustomer(text) {
    var l = getLock();
    if (l && typeof l.extractCustomer === 'function') {
      return l.extractCustomer(text);
    }
    var s = clean(text).replace(/^[-–—_\s]+|[-–—_\s]+$/g, '').trim();
    return s ? s.toUpperCase() : '';
  }

  function splitMachineLocation(text) {
    var l = getLock();
    if (l && typeof l.splitMachineLocation === 'function') {
      return l.splitMachineLocation(text);
    }
    var rawParts = clean(text).split(/\s*[-–—/]\s*/).map(clean).filter(Boolean);
    return {
      raw: text,
      parts: rawParts,
      detectedWo: extractWorkOrder(text),
      detectedBranch: extractBranch(text),
      detectedCustomer: rawParts.length >= 3 ? rawParts.slice(2).join('-') : (rawParts[0] || ''),
      isComplete: rawParts.length >= 3
    };
  }

  function parseMachineLocation(text, claimContext) {
    var l = getLock();
    if (l && typeof l.resolveMachineLocation === 'function') {
      return l.resolveMachineLocation(text, claimContext);
    }

    var wo = extractWorkOrder(text);
    var branch = extractBranch(text);
    var customer = extractCustomer(text);

    if (claimContext) {
      if (!wo) wo = extractWorkOrder(claimContext.dealer_wo_so || claimContext.wo_so || claimContext.comment);
      if (!branch) branch = extractBranch(claimContext.branch || claimContext.dealer_name);
      if (!customer) customer = extractCustomer(claimContext.customer || claimContext.customer_name);
    }

    var parts = [wo, branch, customer].filter(Boolean);
    return parts.join('-').toUpperCase();
  }

  function diagnoseInput(claimId, text) {
    var wo = extractWorkOrder(text);
    var branch = extractBranch(text);
    var customer = extractCustomer(text);
    var split = splitMachineLocation(text);

    var report = {
      claim_id: claimId,
      raw_text: text,
      split_parts: split.parts,
      detected: { wo: wo || 'MISSING', branch: branch || 'MISSING', customer: customer || 'MISSING' },
      format_valid: Boolean(wo && branch && customer)
    };

    console.info('[SDLG PasteParseUx] Diagnostic for claim ' + (claimId || 'unknown') + ':', report);
    return report;
  }

  var API = {
    version: '20261109-canonical-paste-ux-v3',
    parseMachineLocation: parseMachineLocation,
    splitMachineLocation: splitMachineLocation,
    extractWorkOrder: extractWorkOrder,
    extractBranch: extractBranch,
    extractCustomer: extractCustomer,
    diagnoseInput: diagnoseInput
  };

  root.SDLGPasteParseUx = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
