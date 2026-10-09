/**
 * WO ↔ claim policy v1.5.0
 * Match + confirm via SDLGWoCollisionModal (fallback window.confirm).
 *
 * v1.5.0: ALWAYS show modal+diff on Update Klaim (not only risky matches).
 * v1.4.1: Simpan Baru no longer clears dealerWoSo.
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

  var MULTI_CLAIM_WO_ALLOWLIST = Object.freeze(['WO26040309']);
  var allowSet = new Set(MULTI_CLAIM_WO_ALLOWLIST.map(normalizeWo));

  function isMultiClaimAllowed(wo) {
    var key = normalizeWo(wo);
    return Boolean(key && allowSet.has(key));
  }

  function findMatchedClaim(claims, parsed, serialEquivalentFn) {
    if (!parsed || !Array.isArray(claims)) return null;
    var active = claims.filter(function (c) {
      return c && !c.archived_at;
    });

    var dist = parsed.distributorNo != null ? String(parsed.distributorNo).trim() : '';
    if (dist) {
      var byId = active.find(function (c) {
        return String(c.claim_id || '').trim() === dist;
      });
      if (byId) return byId;
    }

    var wo = normalizeWo(parsed.dealerWoSo);
    if (!wo) return null;

    var serialEq =
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
    var wo = normalizeWo(parsed.dealerWoSo);
    return Boolean(wo && normalizeWo(matchedClaim.dealer_wo_so) === wo);
  }

  function partsEqual(parsed, matchedClaim) {
    var a = normalizePart(parsed && (parsed.causingPartNo || parsed.causing_part_no));
    var b = normalizePart(matchedClaim && matchedClaim.causing_part_no);
    return Boolean(a && b && a === b);
  }

  function faultsSimilar(parsed, matchedClaim) {
    var a = normalizeKey(parsed && (parsed.faultDescription || parsed.fault_description));
    var b = normalizeKey(matchedClaim && matchedClaim.fault_description);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length > 12 && b.indexOf(a.slice(0, 12)) >= 0) return true;
    if (b.length > 12 && a.indexOf(b.slice(0, 12)) >= 0) return true;
    return false;
  }

  function isAuditStatus(matchedClaim) {
    var s = String((matchedClaim && matchedClaim.claim_status) || '').toUpperCase();
    return s.indexOf('AUDIT') >= 0 || (s.indexOf('SDLG') >= 0 && s.indexOf('APPROV') < 0);
  }

  function classifyMatch(parsed, matchedClaim) {
    if (!matchedClaim || !isStrictWoMatch(parsed, matchedClaim)) return 'none';
    if (partsEqual(parsed, matchedClaim) || faultsSimilar(parsed, matchedClaim)) return 'strong';
    return 'weak';
  }

  function shortText(value, max) {
    var s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!s) return '—';
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function collisionConfirmMessage(parsed, matchedClaim) {
    var wo = normalizeWo(parsed && parsed.dealerWoSo);
    var id = matchedClaim && matchedClaim.claim_id ? matchedClaim.claim_id : '?';
    var kind = classifyMatch(parsed, matchedClaim);
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
    var id = matchedClaim && matchedClaim.claim_id ? matchedClaim.claim_id : '?';
    var status = matchedClaim && matchedClaim.claim_status ? matchedClaim.claim_status : '—';
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

  function clearWoOnParsed(parsed) {
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.dealerWoSo) {
      parsed.sourceDealerWoSo = String(parsed.dealerWoSo).trim();
    }
    parsed.dealerWoSo = '';
    parsed.woClearedForCollision = true;
  }

  function filterSourceLockIssues(issues, parsed) {
    if (!parsed || !parsed.woClearedForCollision) return issues || [];
    return (issues || []).filter(function (issue) {
      var msg = String((issue && (issue.message || issue)) || '').toLowerCase();
      return msg.indexOf('wo') < 0 && msg.indexOf('source') < 0;
    });
  }

  function askUser(mode, parsed, matchedClaim) {
    var kind = classifyMatch(parsed, matchedClaim);
    var wo = normalizeWo(parsed && parsed.dealerWoSo);
    var Modal = root.SDLGWoCollisionModal;
    if (Modal && typeof Modal.show === 'function') {
      return Modal.show({
        mode: mode,
        kind: kind,
        wo: wo,
        matchedClaim: matchedClaim,
        parsed: parsed
      });
    }
    var msg =
      mode === 'update'
        ? updateConfirmMessage(parsed, matchedClaim)
        : collisionConfirmMessage(parsed, matchedClaim);
    var ok = typeof root.confirm === 'function' ? root.confirm(msg) : true;
    return Promise.resolve(!!ok);
  }

  /** @returns {Promise<boolean>} */
  function confirmAndPrepareNewSave(parsed, matchedClaim) {
    if (!isStrictWoMatch(parsed, matchedClaim)) return Promise.resolve(true);
    return askUser('new', parsed, matchedClaim).then(function (ok) {
      if (!ok) return false;
      if (parsed && parsed.dealerWoSo) {
        parsed.sourceDealerWoSo = String(parsed.dealerWoSo).trim();
      }
      parsed.woClearedForCollision = false;
      return true;
    });
  }

  /**
   * ALWAYS confirm update with modal+diff (v1.5.0).
   * Previously only risky/weak matches prompted — too easy to overwrite by accident.
   * @returns {Promise<boolean>}
   */
  function confirmUpdateSave(parsed, matchedClaim) {
    if (!matchedClaim) return Promise.resolve(true);
    return askUser('update', parsed, matchedClaim);
  }

  function bannerHint(parsed, matchedClaim) {
    var kind = classifyMatch(parsed, matchedClaim);
    if (kind === 'none') return '';
    if (kind === 'strong') {
      return ' Match kuat (part/fault mirip) — Update lebih aman bila ini revisi klaim yang sama.';
    }
    return ' Match lemah (part/fault beda) — Simpan Baru boleh; WO tetap dipakai (multi-claim). Hindari Update kecuali yakin timpa klaim lama.';
  }

  root.SDLGWoClaimPolicy = Object.freeze({
    version: '1.5.0',
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
