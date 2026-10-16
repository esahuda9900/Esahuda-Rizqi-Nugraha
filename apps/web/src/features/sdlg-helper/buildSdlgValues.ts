import type { ClaimDetail } from '@/lib/claimsApi';
import { formatDateDisplay, stripSlgPrefix } from '@/lib/format';
import type { SdlgFieldKey } from '@/config/sdlgFormFields';

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function firstPart(parts: unknown): Record<string, unknown> | null {
  if (!parts) return null;
  let arr: unknown = parts;
  if (typeof parts === 'string') {
    try {
      arr = JSON.parse(parts);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[0] as Record<string, unknown>;
}

export function suggestTaxonomy(claim: ClaimDetail) {
  const blob = [
    claim.fault_description,
    claim.cause_analyze,
    claim.comment,
    claim.causing_part_desc,
    claim.repair_method,
    claim.failure_part_location,
  ]
    .join(' ')
    .toLowerCase();

  let system = '';
  let assembly = '';
  let component = str(claim.causing_part_desc);
  let mode = '';
  let repairAction = '';

  if (/muffler|silencer|engine sound|injector|overflow|engine/.test(blob)) {
    system = 'Engine System';
    if (/muffler|silencer/.test(blob)) {
      assembly = 'Engine Peripherals';
      component = component || 'Muffler';
    }
  } else if (/brake|pneumatic/.test(blob)) system = 'Braking System';
  else if (/hydraulic|cylinder|spool|travel motor/.test(blob))
    system = 'Working Hydraulic System (Mounting, Road)';
  else if (/electrical|sensor|solenoid/.test(blob)) system = 'Electrical System';

  if (/crack|broken/.test(blob)) mode = 'Cracking';
  else if (/leak/.test(blob)) mode = 'Leakage';
  else if (/clog/.test(blob)) mode = 'Clogging';

  if (/replace|new /.test(blob) || /replace/i.test(str(claim.repair_method))) repairAction = 'Replace';

  return { system, assembly, component, mode, repairAction };
}

export function buildSdlgValues(claim: ClaimDetail): Record<SdlgFieldKey, string> {
  const tax = suggestTaxonomy(claim);
  const part = firstPart(claim.parts);
  const qty = part ? str(part.qty ?? part.quantity ?? '1') : '1';
  const unitPrice = part ? str(part.unit_price ?? part.unitPrice ?? '') : '';
  const failureNo = stripSlgPrefix(part?.failure_part_no || part?.failurePartNo || claim.causing_part_no);
  const replaceNo = stripSlgPrefix(
    part?.replacement_part_no || part?.replacementPartNo || claim.causing_part_no,
  );
  const partName = str(part?.description || part?.desc || claim.causing_part_desc);
  const repairDate =
    formatDateDisplay(claim.dealer_repair_date) || formatDateDisplay(claim.completion_date);
  const machineLocation = [claim.dealer_wo_so, claim.branch, claim.customer]
    .map(str)
    .filter(Boolean)
    .join(' · ');
  const faultDetails = [claim.cause_analyze, claim.comment].map(str).filter(Boolean).join('\n');

  return {
    service_type: 'Repair',
    service_method: '',
    serial_no: str(claim.serial_no),
    hm_failure: str(claim.hm_failure),
    failure_date: formatDateDisplay(claim.failure_date),
    dealer_repair_date: repairDate,
    technical_personnel: str(claim.technical_personnel),
    fault_description: str(claim.fault_description),
    fault_details: faultDetails,
    machine_location: machineLocation,
    labour_hrs: str(claim.labour_hrs),
    mileage_km: str(claim.mileage_km),
    logistics_backfill: 'No',
    old_part_material_number: failureNo,
    old_part_qty: qty || '1',
    old_part_name: partName,
    is_primary_cause: 'Yes',
    is_claim: 'Yes',
    is_claimed_compensation: 'Yes',
    fault_cause: str(claim.cause_analyze),
    fault_handling: str(claim.repair_method),
    system_suggest: tax.system,
    assembly_suggest: tax.assembly,
    component_suggest: tax.component,
    mode_suggest: tax.mode,
    repair_action_suggest: tax.repairAction,
    new_part_material_number: replaceNo || failureNo,
    new_part_name: partName,
    new_part_qty: qty || '1',
    unit_price_hint: unitPrice,
    currency_hint: str(claim.currency),
  };
}

export function buildCopyAllText(
  values: Record<SdlgFieldKey, string>,
  fields: { key: SdlgFieldKey; portalLabel: string }[],
): string {
  const lines: string[] = ['SDLG Dealer Portal — copy assist', ''];
  for (const f of fields) lines.push(`${f.portalLabel}:\t${values[f.key] || ''}`);
  return lines.join('\n');
}
