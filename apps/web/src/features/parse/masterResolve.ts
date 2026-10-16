import type { MachineRow } from '@/lib/claimsApi';
import type { ParsedClaim } from './types';

/** App. Code city suffix → branch name (legacy index.html inferBranchFromAppCode). */
const APP_CODE_BRANCH: Record<string, string> = {
  JKT: 'JAKARTA',
  BPN: 'BALIKPAPAN',
  BJM: 'BANJARMASIN',
  SMD: 'SAMARINDA',
  PLM: 'PALEMBANG',
  PLB: 'PALEMBANG',
  MKS: 'MAKASSAR',
  MDN: 'MEDAN',
  PKU: 'PEKANBARU',
  LMP: 'LAMPUNG',
  SBY: 'SURABAYA',
  JBI: 'JAMBI',
  PNK: 'PONTIANAK',
  PTK: 'PONTIANAK',
  TKG: 'TARAKAN',
  PLW: 'PALU',
  PLU: 'PALU',
  SRG: 'SORONG',
  BKS: 'BENGKULU',
};

export function inferBranchFromAppCode(appCode: string): string {
  const x = String(appCode || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  const suffix = (x.match(/\/([A-Z]{3})$/) || [])[1] || '';
  return APP_CODE_BRANCH[suffix] || '';
}

function compact(s: string): string {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Last 6 numeric digits of serial (S0600753 / VLGG913FCS0600753 → 600753). */
export function sourceSerialTail6(serial: string): string {
  const digits = String(serial || '').replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(-6);
  return digits;
}

export function modelsEquivalent(a: string, b: string): boolean {
  const ca = compact(a);
  const cb = compact(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  // G9138F vs G9138FLS / G9138F-LS
  if (ca.startsWith(cb) || cb.startsWith(ca)) return true;
  // strip LS/WS product type suffix
  const strip = (x: string) => x.replace(/(LS|WS|SS)$/, '');
  return strip(ca) === strip(cb);
}

/** Rank machine candidates: exact > endsWith > tail6+model. */
export function pickBestMachine(
  candidates: MachineRow[],
  serial: string,
  model: string,
): MachineRow | null {
  if (!candidates.length) return null;
  const sn = compact(serial);
  const exact = candidates.filter((c) => compact(c.serial_no || '') === sn);
  if (exact.length === 1) return exact[0];

  const ends = candidates.filter((c) => compact(c.serial_no || '').endsWith(sn) || sn.endsWith(compact(c.serial_no || '')));
  let pool = ends.length ? ends : candidates;

  if (pool.length > 1 && model) {
    const byModel = pool.filter((c) => modelsEquivalent(c.model || '', model));
    if (byModel.length) pool = byModel;
  }

  // Prefer longest (full VLG) serial
  pool = [...pool].sort(
    (a, b) => compact(b.serial_no || '').length - compact(a.serial_no || '').length,
  );
  return pool[0] || null;
}

/**
 * Apply master unit + app-code branch onto parsed claim (legacy parity).
 * Source values win only when master has nothing better.
 */
export function applyMasterToParsed(
  parsed: ParsedClaim,
  machine: MachineRow | null,
): ParsedClaim {
  const out = { ...parsed };

  // Branch from App Code when form has no branch (legacy)
  if (!out.branch) {
    const inferred = inferBranchFromAppCode(out.appCode);
    if (inferred) out.branch = inferred;
  }

  if (machine) {
    const srcSerial = compact(out.serialNo);
    const dbSerial = compact(machine.serial_no || '');
    if (dbSerial && (!srcSerial || dbSerial.endsWith(srcSerial) || dbSerial.length >= srcSerial.length)) {
      out.serialNo = machine.serial_no || out.serialNo;
    }
    if (machine.model && modelsEquivalent(machine.model, out.model || machine.model)) {
      // Prefer master model when longer / has -LS (canonical)
      if (!out.model || compact(machine.model).length >= compact(out.model).length) {
        out.model = machine.model;
      }
    } else if (!out.model && machine.model) {
      out.model = machine.model;
    }
    if (machine.customer) {
      // Display style legacy: uppercase customer from master when available
      out.customer = out.customer || machine.customer;
      if (machine.customer && compact(machine.customer) === compact(out.customer)) {
        out.customer = machine.customer;
      }
    }
    if (machine.branch) {
      out.branch = machine.branch || out.branch;
    }
    if (!out.salesDate && machine.sales_date) out.salesDate = machine.sales_date;
  }

  // Indent: some masters append product type (-LS) — keep source indent unless empty
  // Repair status hint (not a form field but useful)
  return out;
}
