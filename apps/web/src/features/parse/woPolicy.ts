import type { ClaimListRow } from '@/lib/claimsApi';
import type { ParsedClaim } from './types';

export type MatchKind = 'none' | 'strong' | 'weak';

const MULTI_CLAIM_WO_ALLOWLIST = ['WO26040309'] as const;

export function normalizeWo(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizePart(value: unknown): string {
  return normalizeKey(value);
}

export function isMultiClaimAllowed(wo: unknown): boolean {
  const key = normalizeWo(wo);
  return Boolean(key && MULTI_CLAIM_WO_ALLOWLIST.includes(key as (typeof MULTI_CLAIM_WO_ALLOWLIST)[number]));
}

/**
 * Match priority:
 * 1) same dealer WO (1 WO = 1 claim, except allowlist)
 * 2) optional soft hint via distributor claim id (not used alone for "strong")
 */
export function findMatchedClaim(
  claims: ClaimListRow[],
  parsed: ParsedClaim,
): ClaimListRow | null {
  const active = claims.filter((c) => c && !c.archived_at);

  const wo = normalizeWo(parsed.dealerWoSo);
  if (wo) {
    if (isMultiClaimAllowed(wo)) {
      if (!parsed.serialNo) return null;
      const serial = parsed.serialNo.toUpperCase();
      return (
        active.find(
          (c) =>
            normalizeWo(c.dealer_wo_so) === wo &&
            String(c.serial_no || '')
              .toUpperCase()
              .includes(serial.slice(-6)),
        ) || null
      );
    }
    const byWo = active.find((c) => normalizeWo(c.dealer_wo_so) === wo);
    if (byWo) return byWo;
  }

  // Soft: distributor claim no equals claim_id (update path), only if no WO hit
  const dist = String(parsed.distributorNo || '').trim();
  if (dist) {
    const byId = active.find((c) => String(c.claim_id || '').trim() === dist);
    if (byId) return byId;
  }

  return null;
}

export function isStrictWoMatch(parsed: ParsedClaim, matched: ClaimListRow | null): boolean {
  if (!matched) return false;
  const wo = normalizeWo(parsed.dealerWoSo);
  return Boolean(wo && normalizeWo(matched.dealer_wo_so) === wo);
}

export function classifyMatch(parsed: ParsedClaim, matched: ClaimListRow | null): MatchKind {
  if (!matched) return 'none';

  // Matched only via claim_id (distributor no) without WO equality → weak update hint
  if (!isStrictWoMatch(parsed, matched)) {
    const dist = String(parsed.distributorNo || '').trim();
    if (dist && String(matched.claim_id).trim() === dist) return 'weak';
    return 'none';
  }

  const partA = normalizePart(parsed.causingPartNo);
  const partB = normalizePart(matched.causing_part_no);
  if (partA && partB && partA === partB) return 'strong';
  const fA = normalizeKey(parsed.faultDescription);
  const fB = normalizeKey(matched.fault_description);
  if (fA && fB && (fA === fB || (fA.length > 12 && fB.includes(fA.slice(0, 12))))) return 'strong';
  return 'weak';
}

export { MULTI_CLAIM_WO_ALLOWLIST };
