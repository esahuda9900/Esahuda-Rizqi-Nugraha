/**
 * SDLG Claim field registry — single source of truth for portal / assessment / helper.
 * Load before portal helpers. Exposes window.SDLG_CLAIM_FIELDS
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

  var PORTAL_HOME = {
    serviceType: {
      labels: ['Service Type'],
      id: 'sdlg_serviceType',
      fromClaim: function () { return 'Repair'; }
    },
    serviceMethod: {
      labels: ['Service Method'],
      id: 'sdlg_serviceMethod',
      // DB column is repair_method (NOT service_method)
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
      fromClaim: function (c) {
        if (!c) return '';
        return [c.cause_analyze, c.comment].filter(Boolean).join('\n\n');
      }
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
        var raw = (c && c.technical_personnel) || '';
        return String(raw).replace(/^\s*technician\s*[:\-]?\s*/i, '').trim();
      }
    }
  };

  global.SDLG_CLAIM_FIELDS = {
    CLAIM_SELECT: CLAIM_SELECT.join(','),
    CLAIM_SELECT_LIST: CLAIM_SELECT,
    PORTAL_HOME: PORTAL_HOME,
    FORBIDDEN_COLUMNS: ['service_type', 'work_location', 'branch_name', 'service_method']
  };
})(typeof window !== 'undefined' ? window : globalThis);
