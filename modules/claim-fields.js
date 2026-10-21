/** SDLG Claim field registry + MINIMAL module loader. */
(function (global) {
  'use strict';

  var CLAIM_SELECT = [
    'claim_id', 'model', 'serial_no', 'customer', 'repair_method', 'technical_personnel',
    'causing_part_no', 'causing_part_desc', 'failure_part_location', 'fault_description',
    'cause_analyze', 'comment', 'parts', 'hm_failure', 'hm_completion', 'sales_date',
    'failure_date', 'dealer_repair_date', 'completion_date', 'dealer_claim_date',
    'labour_amount', 'mileage_amount', 'other_amount', 'total_amount', 'mileage_km', 'labour_hrs',
    'dealer_wo_so', 'branch', 'customer'
  ];

  function pickFirst() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v == null) continue;
      var s = String(v).trim();
      if (!s) continue;
      if (/^kosong$/i.test(s) || /^xxx+$/i.test(s) || /^unknown$/i.test(s) || s === '\u2014' || s === '-' || s === '\u2013') continue;
      return s;
    }
    return '';
  }

  function stripTechPrefix(s) {
    return String(s || '').replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
  }

  global.SDLG_CLAIM_FIELDS = {
    CLAIM_SELECT: CLAIM_SELECT.join(','),
    CLAIM_SELECT_LIST: CLAIM_SELECT,
    FORBIDDEN_COLUMNS: ['service_type', 'work_location', 'branch_name', 'service_method'],
    pickFirst: pickFirst,
    stripTechPrefix: stripTechPrefix
  };

  try {
    if (typeof document !== 'undefined') {
      function loadScript(src, attr) {
        if (document.querySelector('script[' + attr + ']')) return;
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.setAttribute(attr, '1');
        (document.head || document.documentElement).appendChild(s);
      }
      // Event-driven hydrate only. Inline enforcer removed — React owns report, repair date, machine location.
      loadScript('./modules/sdlg-input-hydrate.js?v=20261021-v15', 'data-sdlg-input-hydrate');
      loadScript('./modules/sdlg-hash-router.js?v=20261012-v221', 'data-sdlg-hash-router');
      loadScript('./modules/sdlg-hash-tab-bridge.js?v=20261012-v23', 'data-sdlg-hash-tab-bridge');
      loadScript('./modules/sdlg-input-claim-sync.js?v=20261012-v11', 'data-sdlg-input-claim-sync');
      loadScript('./modules/sdlg-portal-finance-ux.js?v=20261012-v53', 'data-sdlg-finance-ux');
      loadScript('./modules/sdlg-portal-ux-v2.js?v=20261009-v24', 'data-sdlg-portal-ux-v2');
      loadScript('./modules/sdlg-route-finish.js?v=20261010-v15', 'data-sdlg-route-finish');
      loadScript('./modules/sdlg-ui-consolidate.js?v=20261009-v1', 'data-sdlg-ui-consolidate');
      loadScript('./modules/sdlg-ui-polish-v3.js?v=20261010-v33', 'data-sdlg-ui-polish-v3');
      loadScript('./modules/sdlg-auth-route-guard.js?v=20261010-v13', 'data-sdlg-auth-route-guard');
      loadScript('./modules/sdlg-overview-session-gate.js?v=20261010-v12', 'data-sdlg-overview-gate');
      loadScript('./modules/sdlg-overview-ux.js?v=20261010-v11', 'data-sdlg-overview-ux');
    }
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
