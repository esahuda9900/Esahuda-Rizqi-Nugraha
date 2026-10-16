import type { ClaimListRow, MachineRow } from '@/lib/claimsApi';
import type { ParsedClaim } from './types';

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
  if (ca.startsWith(cb) || cb.startsWith(ca)) return true;
  const strip = (x: string) => x.replace(/(LS|WS|SS)$/, '');
  return strip(ca) === strip(cb);
}

export function pickBestMachine(
  candidates: MachineRow[],
  serial: string,
  model: string,
): MachineRow | null {
  if (!candidates.length) return null;
  const sn = compact(serial);
  const exact = candidates.filter((c) => compact(c.serial_no || '') === sn);
  if (exact.length === 1) return exact[0];

  let pool = candidates.filter((c) => {
    const cs = compact(c.serial_no || '');
    const src = compact(c.source_serial_no || '');
    return cs.endsWith(sn) || sn.endsWith(cs) || src === sn || src.endsWith(sn);
  });
  if (!pool.length) pool = candidates;

  if (pool.length > 1 && model) {
    const byModel = pool.filter((c) => modelsEquivalent(c.model || '', model));
    if (byModel.length) pool = byModel;
  }

  pool = [...pool].sort(
    (a, b) => compact(b.serial_no || '').length - compact(a.serial_no || '').length,
  );
  return pool[0] || null;
}

export function applyMasterToParsed(
  parsed: ParsedClaim,
  machine: MachineRow | null,
  canonicalModel?: string | null,
): ParsedClaim {
  const out = { ...parsed };

  if (!out.branch) {
    const inferred = inferBranchFromAppCode(out.appCode);
    if (inferred) out.branch = inferred;
  }

  if (canonicalModel && modelsEquivalent(canonicalModel, out.model || canonicalModel)) {
    if (!out.model || compact(canonicalModel).length >= compact(out.model).length) {
      out.model = canonicalModel;
    }
  }

  if (machine) {
    const srcSerial = compact(out.serialNo);
    const dbSerial = compact(machine.serial_no || '');
    if (dbSerial && (!srcSerial || dbSerial.endsWith(srcSerial) || dbSerial.length >= srcSerial.length)) {
      out.serialNo = machine.serial_no || out.serialNo;
    }
    if (machine.model && modelsEquivalent(machine.model, out.model || machine.model)) {
      if (!out.model || compact(machine.model).length >= compact(out.model).length) {
        out.model = machine.model;
      }
    } else if (!out.model && machine.model) {
      out.model = machine.model;
    }
    if (machine.customer) {
      if (!out.customer) out.customer = machine.customer;
      else if (compact(machine.customer) === compact(out.customer)) {
        out.customer = machine.customer;
      }
    }
    if (machine.branch) out.branch = machine.branch;
    if (!out.salesDate && machine.sales_date) out.salesDate = machine.sales_date;
    if (machine.indent_no) {
      const mi = machine.indent_no.trim();
      if (!out.indentNo) out.indentNo = mi;
      else if (mi.length > out.indentNo.length && mi.startsWith(out.indentNo.replace(/-LS$/i, ''))) {
        out.indentNo = mi;
      }
    }
  }

  if (out.customer && machine?.customer) {
    out.customer = machine.customer;
  }

  return out;
}

export function applyMatchedClaimHint(
  parsed: ParsedClaim,
  matched: ClaimListRow | null,
): ParsedClaim {
  if (!matched) return parsed;
  const out = { ...parsed };
  if (!out.serialNo && matched.serial_no) out.serialNo = matched.serial_no;
  else if (
    out.serialNo &&
    matched.serial_no &&
    matched.serial_no.toUpperCase().includes(out.serialNo.toUpperCase().replace(/\s/g, ''))
  ) {
    if (matched.serial_no.length > out.serialNo.length) out.serialNo = matched.serial_no;
  }
  if (!out.model && matched.model) out.model = matched.model;
  else if (
    out.model &&
    matched.model &&
    modelsEquivalent(out.model, matched.model) &&
    matched.model.length > out.model.length
  ) {
    out.model = matched.model;
  }
  if (!out.customer && matched.customer) out.customer = matched.customer;
  if (!out.branch && matched.branch) out.branch = matched.branch;
  if (!out.distributorNo && matched.claim_id) out.distributorNo = matched.claim_id;
  return out;
}
