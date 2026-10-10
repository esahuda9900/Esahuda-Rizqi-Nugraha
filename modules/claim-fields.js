/**
 * SDLG Claim field registry — single source of truth for portal / assessment / helper.
 */
(function (global) {
  'use strict';

  var CLAIM_SELECT = [
    'claim_id', 'model', 'serial_no', 'customer', 'repair_method', 'technical_personnel',
    'causing_part_no', 'causing_part_desc', 'failure_part_location', 'fault_description',
    'cause_analyze', 'comment', 'parts', 'hm_failure', 'hm_completion', 'sales_date',
    'failure_date', 'dealer_repair_date', 'completion_date', 'dealer_claim_date',
    'labour_amount', 'mileage_amount', 'other_amount', 'total_amount', 'mileage_km'
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

  var PORTAL_HOME = {
    serviceType: {
      labels: ['Service Type'],
      id: 'sdlg_serviceType',
      fromClaim: function () { return 'Repair'; }
    },
    serviceMethod: {
      labels: ['Service Method'],
      id: 'sdlg_serviceMethod',
      fromClaim: function (c) { return (c && (c.repair_method || c.service_method)) || ''; }
    },
    serialNumber: {
      labels: ['Serial number', 'Serial Number', 'Serial No'],
      id: 'sdlg_serialNumber',
      fromClaim: function (c) { return (c && (c.serial_no || c.canonical_serial_no)) || ''; }
    },
    hourMeter: {
      labels: ['Hour meter', 'Hour Meter', 'HM'],
      id: 'sdlg_hourMeter',
      fromClaim: function (c) { return c && c.hm_failure != null ? String(c.hm_failure) : ''; }
    },
    repairDate: {
      labels: ['Date of repair report', 'Repair Date', 'Dealer Repair Date'],
      id: 'sdlg_repairDate',
      fromClaim: function (c) {
        if (!c) return '';
        var v = c.dealer_repair_date || c.completion_date || c.failure_date;
        if (!v) return '';
        var s = String(v);
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[3] + '/' + m[2] + '/' + m[1];
        return s;
      }
    },
    failureDate: {
      labels: ['Failure Date'],
      id: 'sdlg_failureDate',
      fromClaim: function (c) {
        if (!c || !c.failure_date) return '';
        var s = String(c.failure_date);
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[3] + '/' + m[2] + '/' + m[1];
        return s;
      }
    },
    complaint: {
      labels: ['Complaint'],
      id: 'sdlg_complaint',
      fromClaim: function (c) { return (c && c.fault_description) || ''; }
    },
    faultDetails: {
      labels: ['Fault Details', 'Fault Detail'],
      id: 'sdlg_faultDetails',
      fromClaim: function (c) { return (c && [c.cause_analyze, c.comment].filter(Boolean).join('\n\n')) || ''; }
    },
    machineLocation: {
      labels: ['Machine Location'],
      id: 'sdlg_machineLocation',
      fromClaim: function (c) { return (c && c.failure_part_location) || ''; }
    },
    feedbackPerson: {
      labels: ['Feedback Person'],
      id: 'sdlg_feedbackPerson',
      fromClaim: function (c) {
        if (!c) return '';
        return stripTechPrefix(pickFirst(
          c.technical_personnel, c.feedback_person, c.pic_name, c.person_in_charge,
          c.technician_name, c.technician, c.service_advisor, c.reported_by
        ));
      }
    },
    feedbackContact: {
      labels: ['Feedback Contact Information', 'Feedback Contact'],
      id: 'sdlg_feedbackContact',
      fromClaim: function (c) {
        if (!c) return '';
        return pickFirst(
          c.feedback_contact, c.feedback_phone, c.technician_contact, c.technical_personnel_phone,
          c.contact, c.phone, c.customer_phone, c.mobile
        );
      }
    }
  };

  global.SDLG_CLAIM_FIELDS = {
    CLAIM_SELECT: CLAIM_SELECT.join(','),
    CLAIM_SELECT_LIST: CLAIM_SELECT,
    PORTAL_HOME: PORTAL_HOME,
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
      loadScript('./modules/sdlg-hash-router.js?v=20261010-v21', 'data-sdlg-hash-router');
      loadScript('./modules/feedback-person-fix.js?v=20261009-v13', 'data-sdlg-fb-fix');
      loadScript('./modules/sdlg-portal-finance-ux.js?v=20261009-v3', 'data-sdlg-finance-ux');
      loadScript('./modules/sdlg-input-helper-ux.js?v=20261009-v191', 'data-sdlg-input-helper-ux');
      loadScript('./modules/sdlg-portal-ux-v2.js?v=20261009-v24', 'data-sdlg-portal-ux-v2');
      loadScript('./modules/sdlg-route-finish.js?v=20261010-v15', 'data-sdlg-route-finish');
      loadScript('./modules/sdlg-ui-consolidate.js?v=20261009-v1', 'data-sdlg-ui-consolidate');
      loadScript('./modules/sdlg-input-empty-guard.js?v=20261009-v1', 'data-sdlg-input-empty-guard');
      loadScript('./modules/sdlg-ui-polish-v3.js?v=20261010-v33', 'data-sdlg-ui-polish-v3');
      loadScript('./modules/sdlg-auth-route-guard.js?v=20261010-v13', 'data-sdlg-auth-route-guard');
    }
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
