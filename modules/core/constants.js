/**
 * Workflow / status constants — pure data, no DOM.
 */
(function (root) {
  'use strict';

  var WORKFLOW_STATUSES = [
    'Draft',
    'Submitted to Warranty Admin',
    'Submitted to SDLG',
    'Claimed to SDLG',
    'SDLG Audit',
    'Approved',
    'Rejected',
    'Billing',
    'Paid',
    'Completed',
    'On Hold'
  ];

  var WORKFLOW_RANK = {};
  for (var i = 0; i < WORKFLOW_STATUSES.length; i++) {
    WORKFLOW_RANK[WORKFLOW_STATUSES[i]] = i;
  }

  var FINAL_WORKFLOW_STATUSES = {
    Approved: true,
    Rejected: true,
    Paid: true,
    Completed: true
  };

  function workflowMoveWarning(fromStatus, toStatus) {
    var from = fromStatus || 'Draft';
    var to = toStatus || 'Draft';
    if (from === to) return '';
    if (FINAL_WORKFLOW_STATUSES[from]) {
      return 'Claim saat ini sudah berstatus "' + from + '". Perubahan ke "' + to + '" adalah koreksi workflow dan akan tercatat di audit history.';
    }
    var fromRank = WORKFLOW_RANK[from];
    var toRank = WORKFLOW_RANK[to];
    if (Number.isFinite(fromRank) && Number.isFinite(toRank) && toRank < fromRank && to !== 'On Hold') {
      return 'Status akan mundur dari "' + from + '" ke "' + to + '". Pastikan ini memang koreksi workflow.';
    }
    return '';
  }

  function statusColor(s) {
    var map = {
      Draft: '#f59e0b',
      'Submitted to Warranty Admin': '#f97316',
      'Submitted to SDLG': '#3b82f6',
      'Claimed to SDLG': '#3b82f6',
      'SDLG Audit': '#6366f1',
      Approved: '#10b981',
      Rejected: '#ef4444',
      Billing: '#0891b2',
      Paid: '#16a34a',
      Completed: '#0f766e',
      'On Hold': '#8b5cf6'
    };
    return map[s] || '#64748b';
  }

  var api = {
    version: '1.0.0',
    WORKFLOW_STATUSES: WORKFLOW_STATUSES,
    WORKFLOW_RANK: WORKFLOW_RANK,
    FINAL_WORKFLOW_STATUSES: FINAL_WORKFLOW_STATUSES,
    workflowMoveWarning: workflowMoveWarning,
    statusColor: statusColor
  };

  root.SDLGCoreConstants = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
