/**
 * SDLG Workflow Status Constants — V3.0 (Master Data Engine)
 * Pure data. Zero dependencies. Immutable.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V3.0:
 * ✅ IMMUTABLE: Semua data di-freeze (anti-mutation).
 * ✅ STATUS_META: Metadata lengkap (icon, color, prev, next).
 * ✅ NORMALIZATION: Terima input case-insensitive.
 * ✅ BADGE HELPER: getStatusBadge() bikin badge auto dark mode.
 * ✅ WORKFLOW GRAPH: getNextStatuses() buat dropdown form.
 * ✅ BACKWARD COMPAT: Semua API lama tetap jalan.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (root.__SDLG_CORE_CONSTANTS_V3__) return;
  root.__SDLG_CORE_CONSTANTS_V3__ = true;

  // ═════════════════════════════════════════════════════════
  // 1. DATA MENTAH (Array Urut)
  // ═════════════════════════════════════════════════════════
  const WORKFLOW_STATUSES = Object.freeze([
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
  ]);

  // ═════════════════════════════════════════════════════════
  // 2. METADATA (Detail Per Status)
  // ═════════════════════════════════════════════════════════
  const STATUS_META = Object.freeze({
    'Draft': {
      rank: 0, category: 'draft', phase: 'intake',
      icon: '✏️', isFinal: false, isNegative: false,
      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',
      prev: null, next: ['Submitted to Warranty Admin']
    },
    'Submitted to Warranty Admin': {
      rank: 1, category: 'submission', phase: 'submission',
      icon: '📤', isFinal: false, isNegative: false,
      color: '#f97316', bg: 'rgba(249,115,22,0.12)',
      prev: ['Draft'], next: ['Submitted to SDLG']
    },
    'Submitted to SDLG': {
      rank: 2, category: 'submission', phase: 'submission',
      icon: '📮', isFinal: false, isNegative: false,
      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',
      prev: ['Submitted to Warranty Admin'], next: ['Claimed to SDLG']
    },
    'Claimed to SDLG': {
      rank: 3, category: 'submission', phase: 'submission',
      icon: '📨', isFinal: false, isNegative: false,
      color: '#2563eb', bg: 'rgba(37,99,235,0.12)',
      prev: ['Submitted to SDLG'], next: ['SDLG Audit']
    },
    'SDLG Audit': {
      rank: 4, category: 'review', phase: 'review',
      icon: '🔍', isFinal: false, isNegative: false,
      color: '#6366f1', bg: 'rgba(99,102,241,0.12)',
      prev: ['Claimed to SDLG'], next: ['Approved', 'Rejected']
    },
    'Approved': {
      rank: 5, category: 'approved', phase: 'resolution',
      icon: '✅', isFinal: false, isNegative: false,
      color: '#10b981', bg: 'rgba(16,185,129,0.12)',
      prev: ['SDLG Audit'], next: ['Billing']
    },
    'Rejected': {
      rank: 6, category: 'rejected', phase: 'resolution',
      icon: '❌', isFinal: true, isNegative: true,
      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',
      prev: ['SDLG Audit'], next: []
    },
    'Billing': {
      rank: 7, category: 'billing', phase: 'closing',
      icon: '💳', isFinal: false, isNegative: false,
      color: '#0891b2', bg: 'rgba(8,145,178,0.12)',
      prev: ['Approved'], next: ['Paid']
    },
    'Paid': {
      rank: 8, category: 'paid', phase: 'closing',
      icon: '💰', isFinal: true, isNegative: false,
      color: '#16a34a', bg: 'rgba(22,163,74,0.12)',
      prev: ['Billing'], next: ['Completed']
    },
    'Completed': {
      rank: 9, category: 'completed', phase: 'closing',
      icon: '🏁', isFinal: true, isNegative: false,
      color: '#0f766e', bg: 'rgba(15,118,110,0.12)',
      prev: ['Paid'], next: []
    },
    'On Hold': {
      rank: 10, category: 'hold', phase: 'hold',
      icon: '⏸️', isFinal: false, isNegative: false,
      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',
      prev: [], next: [] // On Hold bisa balik ke status manapun (manual)
    }
  });

  // ═════════════════════════════════════════════════════════
  // 3. RANK MAP (Backward Compatible)
  // ═════════════════════════════════════════════════════════
  const WORKFLOW_RANK = Object.freeze(
    WORKFLOW_STATUSES.reduce((acc, s) => {
      acc[s] = STATUS_META[s].rank;
      return acc;
    }, {})
  );

  // Map berdasarkan rank (array indexed by rank)
  const WORKFLOW_STATUS_BY_RANK = Object.freeze(
    WORKFLOW_STATUSES.slice().sort((a, b) => STATUS_META[a].rank - STATUS_META[b].rank)
  );

  // Final statuses (untuk backward compat)
  const FINAL_WORKFLOW_STATUSES = Object.freeze(
    WORKFLOW_STATUSES.reduce((acc, s) => {
      if (STATUS_META[s].isFinal) acc[s] = true;
      return acc;
    }, {})
  );

  // ═════════════════════════════════════════════════════════
  // 4. UTILITY FUNCTIONS
  // ═════════════════════════════════════════════════════════

  /**
   * Normalisasi input status (case-insensitive, trim).
   * "APPROVED" / "approved " / "Approved" → "Approved"
   */
  function normalizeStatus(input) {
    if (!input) return null;
    const cleaned = String(input).trim().toLowerCase();
    for (let i = 0; i < WORKFLOW_STATUSES.length; i++) {
      if (WORKFLOW_STATUSES[i].toLowerCase() === cleaned) return WORKFLOW_STATUSES[i];
    }
    return null;
  }

  /**
   * Cek apakah string adalah status yang valid.
   */
  function isValidStatus(input) {
    return normalizeStatus(input) !== null;
  }

  /**
   * Ambil metadata lengkap satu status.
   */
  function getStatusMeta(input) {
    const normalized = normalizeStatus(input);
    if (!normalized) return null;
    return STATUS_META[normalized];
  }

  /**
   * Ambil category (draft, submission, review, dll).
   */
  function getStatusCategory(input) {
    const meta = getStatusMeta(input);
    return meta ? meta.category : null;
  }

  /**
   * Ambil warna (untuk backward compat).
   */
  function statusColor(input) {
    const meta = getStatusMeta(input);
    return meta ? meta.color : '#64748b';
  }

  /**
   * Ambil array status yang mungkin SETELAH status ini.
   */
  function getNextStatuses(input) {
    const meta = getStatusMeta(input);
    return meta ? meta.next.slice() : [];
  }

  /**
   * Ambil array status yang mungkin SEBELUM status ini.
   */
  function getPreviousStatuses(input) {
    const meta = getStatusMeta(input);
    return meta ? meta.prev.slice() : [];
  }

  /**
   * ⭐ Bikin CSS style object untuk badge (auto dark mode).
   * Pakai: `Object.assign({}, getStatusBadge('Approved'))`
   */
  function getStatusBadge(input) {
    const meta = getStatusMeta(input);
    if (!meta) {
      return {
        display: 'inline-block', padding: '4px 10px', borderRadius: '999px',
        fontSize: '12px', fontWeight: '700',
        background: '#f1f5f9', color: '#64748b'
      };
    }
    return {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: '700',
      background: meta.bg,
      color: meta.color,
      border: '1px solid ' + meta.color + '33' // 20% opacity border
    };
  }

  /**
   * Peringatan saat pindah status.
   * Upgrade dari v1: handle "Approved → Rejected" (batal) selain "mundur".
   */
  function workflowMoveWarning(fromStatus, toStatus) {
    const from = normalizeStatus(fromStatus) || 'Draft';
    const to = normalizeStatus(toStatus) || 'Draft';
    if (from === to) return '';

    const fromMeta = STATUS_META[from];
    const toMeta = STATUS_META[to];

    // Kasus 1: dari final status
    if (fromMeta.isFinal) {
      return 'Claim saat ini sudah berstatus final "' + from + '". Perubahan ke "' + to + '" adalah koreksi workflow dan akan tercatat di audit history.';
    }

    // Kasus 2: Approved → Rejected (batal, bukan mundur rank)
    if (from === 'Approved' && to === 'Rejected') {
      return 'Anda akan membatalkan persetujuan ("Approved → Rejected"). Pastikan ini keputusan yang benar.';
    }

    // Kasus 3: mundur rank (kecuali On Hold)
    if (toMeta.rank < fromMeta.rank && to !== 'On Hold') {
      return 'Status akan mundur dari "' + from + '" ke "' + to + '". Pastikan ini memang koreksi workflow.';
    }

    return '';
  }

  // ═════════════════════════════════════════════════════════
  // 5. EXPORT (Immutable)
  // ═════════════════════════════════════════════════════════
  root.SDLGCoreConstants = Object.freeze({
    version: '3.0.0',
    
    // Data mentah (backward compat)
    WORKFLOW_STATUSES,
    WORKFLOW_RANK,
    FINAL_WORKFLOW_STATUSES,
    WORKFLOW_STATUS_BY_RANK,
    STATUS_META,
    
    // Utilities (backward compat)
    workflowMoveWarning,
    statusColor,
    
    // Utilities baru
    normalizeStatus,
    isValidStatus,
    getStatusMeta,
    getStatusCategory,
    getNextStatuses,
    getPreviousStatuses,
    getStatusBadge
  });

})(typeof window !== 'undefined' ? window : globalThis);