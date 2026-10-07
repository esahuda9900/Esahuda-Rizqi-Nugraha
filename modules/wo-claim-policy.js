/**
 * WO ↔ claim policy v1.4.1
 * Match + confirm via SDLGWoCollisionModal (fallback window.confirm).
 *
 * v1.4.1: Simpan Baru no longer clears dealerWoSo. claims.dealer_wo_so is not UNIQUE
 * (only btree indexes), and clearing WO caused SOURCE LOCK to block save
 * (source=WO… vs parse=""). Provenance fields remain for optional lock exception.
 */
(function (root) {
  'use strict';

  function normalizeWo(value) {
    return String(value == null ? '' : value).trim().toUpperCase();
  }

  function normalizeKey(value) {
    return String(value == null ? '' : value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  function normalizePart(value) {
    return String(value == null ? '' : value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  const MULTI_CLAIM_WO_ALLOWLIST = Object.freeze(['WO26040309']);
  const allowSet = new Set(MULTI_CLAIM_WO_ALLOWLIST.map(normalizeWo));

  function isMultiClaimAllowed(wo) {
    const key = normalizeWo(wo);
    return Boolean(key && allowSet.has(key));
  }

  function findMatchedClaim(claims, parsed, serialEquivalentFn) {
    if (!parsed || !Array.isArray(claims)) return null;
    const active = claims.filter(function (c) {
      return c && !c.archived_at;
    });

    const dist = parsed.distributorNo != null ? String(parsed.distributorNo).trim() : '';
    if (dist) {
      const byId = active.find(function (c) {
        return String(c.claim_id || '').trim() === dist;
      });
      if (byId) return byId;
    }

    const wo = normalizeWo(parsed.dealerWoSo);
    if (!wo) return null;

    const serialEq =
      typeof serialEquivalentFn === 'function'
        ? serialEquivalentFn
        : typeof root.SDLGSerialEquivalent === 'function'
          ? root.SDLGSerialEquivalent
          : function (a, b) {
              return String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
            };

    if (isMultiClaimAllowed(wo)) {
      if (!parsed.serialNo) return null;
      return (
        active.find(function (c) {
          return normalizeWo(c.dealer_wo_so) === wo && serialEq(c.serial_no, parsed.serialNo);
        }) || null
      );
    }

    return (
      active.find(function (c) {
        return normalizeWo(c.dealer_wo_so) === wo;
      }) || null
    );
  }

  function isStrictWoMatch(parsed, matchedClaim) {
    if (!parsed || !matchedClaim) return false;
    const wo = normalizeWo(parsed.dealerWoSo);
    if (!wo || isMultiClaimAllowed(wo)) return false;
    return normalizeWo(matchedClaim.dealer_wo_so) === wo;
  }

  function partsEqual(parsed, matchedClaim) {
    const a = normalizePart(parsed && (parsed.causingPartNo || parsed.causing_part_no));
    const b = normalizePart(matchedClaim && (matchedClaim.causing_part_no || matchedClaim.causingPartNo));
    if (!a || !b) return false;
    return a === b;
  }

  function faultsSimilar(parsed, matchedClaim) {
    const a = normalizeKey(parsed && (parsed.faultDescription || parsed.fault_description));
    const b = normalizeKey(matchedClaim && (matchedClaim.fault_description || matchedClaim.faultDescription));
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 12 && b.indexOf(a) >= 0) return true;
    if (b.length >= 12 && a.indexOf(b) >= 0) return true;
    return false;
  }

  function isAuditStatus(matchedClaim) {
    const s = String((matchedClaim && matchedClaim.claim_status) || '').toUpperCase();
    return s.indexOf('AUDIT') >= 0 || (s.indexOf('SDLG') >= 0 && s.indexOf('APPROV') < 0);
  }

  function classifyMatch(parsed, matchedClaim) {
    if (!matchedClaim || !isStrictWoMatch(parsed, matchedClaim)) return 'none';
    if (partsEqual(parsed, matchedClaim) || faultsSimilar(parsed, matchedClaim)) return 'strong';
    return 'weak';
  }

  function shortText(value, max) {
    const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!s) return '—';
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function collisionConfirmMessage(parsed, matchedClaim) {
    const wo = normalizeWo(parsed && parsed.dealerWoSo);
    const id = matchedClaim && matchedClaim.claim_id ? matchedClaim.claim_id : '?';
    const kind = classifyMatch(parsed, matchedClaim);
    return (
      'WO ' +
      wo +
      ' sudah dipakai klaim ' +
      id +
      ' (' +
      kind +
      ').\n\n' +
      'Lama: ' +
      shortText(matchedClaim && matchedClaim.fault_description, 60) +
      ' / ' +
      shortText(matchedClaim && matchedClaim.causing_part_no, 24) +
      '\nBaru: ' +
      shortText(parsed && parsed.faultDescription, 60) +
      ' / ' +
      shortText(parsed && parsed.causingPartNo, 24) +
      '\n\nSimpan Baru? Klaim baru tetap memakai WO yang sama (multi-claim). Utamakan Update jika ini revisi klaim yang sama.'
    );
  }

  function updateConfirmMessage(parsed, matchedClaim) {
    const id = matchedClaim && matchedClaim.claim_id ? matchedClaim.claim_id : '?';
    const status = matchedClaim && matchedClaim.claim_status ? matchedClaim.claim_status : '—';
    return (
      'Update akan menimpa klaim ' +
      id +
      ' (' +
      status +
      ').\n\n' +
      'Lama: ' +
      shortText(matchedClaim && matchedClaim.fault_description, 60) +
      ' / ' +
      shortText(matchedClaim && matchedClaim.causing_part_no, 24) +
      '\nBaru: ' +
      shortText(parsed && parsed.faultDescription, 60) +
      ' / ' +
      shortText(parsed && parsed.causingPartNo, 24)
    );
  }

  /**
   * Legacy helper kept for callers. v1.4.1 does not clear WO on Simpan Baru
   * (DB has no unique on dealer_wo_so; clearing broke SOURCE LOCK).
   * Still records provenance if a caller clears WO intentionally.
   */
  function clearWoOnParsed(parsed) {
    if (!parsed || typeof parsed !== 'object') return;
    var prior =
      parsed.dealerWoSo != null && String(parsed.dealerWoSo).trim()
        ? String(parsed.dealerWoSo).trim()
        : parsed.dealer_wo_so != null && String(parsed.dealer_wo_so).trim()
          ? String(parsed.dealer_wo_so).trim()
          : parsed.sourceDealerWoSo != null
            ? String(parsed.sourceDealerWoSo).trim()
            : '';
    if (prior) {
      parsed.sourceDealerWoSo = prior;
    }
    parsed.dealerWoSo = '';
    if (Object.prototype.hasOwnProperty.call(parsed, 'dealer_wo_so')) {
      parsed.dealer_wo_so = null;
    }
    parsed.woClearedForCollision = true;
  }

  function filterSourceLockIssues(issues, parsed) {
    if (!parsed || parsed.woClearedForCollision !== true) return issues || [];
    return (issues || []).filter(function (issue) {
      return !/^Dealer\s*WO\/SO\s*:/i.test(String(issue || ''));
    });
  }

  function askUser(mode, parsed, matchedClaim) {
    const kind = classifyMatch(parsed, matchedClaim);
    const wo = normalizeWo(parsed && parsed.dealerWoSo);
    const Modal = root.SDLGWoCollisionModal;
    if (Modal && typeof Modal.show === 'function') {
      return Modal.show({
        mode: mode,
        kind: kind,
        wo: wo,
        matchedClaim: matchedClaim,
        parsed: parsed
      });
    }
    const msg =
      mode === 'update'
        ? updateConfirmMessage(parsed, matchedClaim)
        : collisionConfirmMessage(parsed, matchedClaim);
    const ok = typeof root.confirm === 'function' ? root.confirm(msg) : true;
    return Promise.resolve(!!ok);
  }

  /** @returns {Promise<boolean>} */
  function confirmAndPrepareNewSave(parsed, matchedClaim) {
    if (!isStrictWoMatch(parsed, matchedClaim)) return Promise.resolve(true);
    return askUser('new', parsed, matchedClaim).then(function (ok) {
      if (!ok) return false;
      // Keep WO on the new claim — multi-claim is allowed; clearing broke SOURCE LOCK.
      if (parsed && parsed.dealerWoSo) {
        parsed.sourceDealerWoSo = String(parsed.dealerWoSo).trim();
      }
      parsed.woClearedForCollision = false;
      return true;
    });
  }

  /** @returns {Promise<boolean>} */
  function confirmUpdateSave(parsed, matchedClaim) {
    if (!matchedClaim) return Promise.resolve(true);
    const kind = classifyMatch(parsed, matchedClaim);
    const risky = kind === 'weak' || isAuditStatus(matchedClaim);
    if (!risky) return Promise.resolve(true);
    return askUser('update', parsed, matchedClaim);
  }

  function bannerHint(parsed, matchedClaim) {
    const kind = classifyMatch(parsed, matchedClaim);
    if (kind === 'none') return '';
    if (kind === 'strong') {
      return ' Match kuat (part/fault mirip) — Update lebih aman bila ini revisi klaim yang sama.';
    }
    return ' Match lemah (part/fault beda) — Simpan Baru boleh; WO tetap dipakai (multi-claim). Hindari Update kecuali yakin timpa klaim lama.';
  }

  root.SDLGWoClaimPolicy = Object.freeze({
    version: '1.4.1',
    MULTI_CLAIM_WO_ALLOWLIST: MULTI_CLAIM_WO_ALLOWLIST,
    normalizeWo: normalizeWo,
    isMultiClaimAllowed: isMultiClaimAllowed,
    findMatchedClaim: findMatchedClaim,
    isStrictWoMatch: isStrictWoMatch,
    classifyMatch: classifyMatch,
    collisionConfirmMessage: collisionConfirmMessage,
    clearWoOnParsed: clearWoOnParsed,
    filterSourceLockIssues: filterSourceLockIssues,
    confirmAndPrepareNewSave: confirmAndPrepareNewSave,
    updateConfirmMessage: updateConfirmMessage,
    confirmUpdateSave: confirmUpdateSave,
    bannerHint: bannerHint
  });
})(typeof window !== 'undefined' ? window : globalThis);
