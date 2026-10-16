import type { ParsedClaim, ParsedPartRow } from './types';

function buildPartsJson(parsed: ParsedClaim): unknown {
  const rows = parsed.partsRows?.length
    ? parsed.partsRows
    : parsed.causingPartNo
      ? [
          {
            failurePartNo: parsed.causingPartNo,
            replacementPartNo: parsed.causingPartNo,
            description: parsed.causingPartDesc || '',
            qty: 1,
            unitPrice: null as number | null,
            amount: parsed.partsTotal ?? null,
          } satisfies ParsedPartRow,
        ]
      : [];

  if (!rows.length) return null;
  return rows.map((r) => ({
    failure_part_no: r.failurePartNo || null,
    replacement_part_no: r.replacementPartNo || r.failurePartNo || null,
    description: r.description || '',
    qty: r.qty ?? 1,
    unit_price: r.unitPrice,
    amount: r.amount,
  }));
}

/** Map parser output → claims table columns (snake_case). */
export function parsedToClaimRow(parsed: ParsedClaim, claimId: string): Record<string, unknown> {
  const parts = buildPartsJson(parsed);
  return {
    claim_id: claimId,
    claim_type: 'PFR',
    dealer_wo_so: parsed.dealerWoSo ? parsed.dealerWoSo : null,
    model: parsed.model || null,
    serial_no: parsed.serialNo || null,
    indent_no: parsed.indentNo || null,
    customer: parsed.customer || null,
    distributor: parsed.distributor || null,
    dealer_name: parsed.dealerName || null,
    dealer_code: parsed.dealerCode || null,
    branch: parsed.branch || null,
    sales_date: parsed.salesDate || null,
    failure_date: parsed.failureDate || null,
    dealer_repair_date: parsed.dealerRepairDate || null,
    completion_date: parsed.completionDate || null,
    dealer_claim_date: parsed.dealerClaimDate || null,
    dealer_claim_no: parsed.dealerClaimNo || null,
    hm_failure: parsed.hmFailure,
    hm_completion: parsed.hmCompletion,
    fault_description: parsed.faultDescription || null,
    cause_analyze: parsed.causeAnalyze || null,
    comment: parsed.comment || null,
    causing_part_no: parsed.causingPartNo || null,
    causing_part_desc: parsed.causingPartDesc || null,
    repair_method: parsed.repairMethod || null,
    technical_personnel: parsed.technicalPersonnel || null,
    engine_serial_no: parsed.engineSerialNo || null,
    failure_part_location: parsed.failurePartLocation || null,
    labour_hrs: parsed.labourHrs,
    labour_amount: parsed.labourAmount ?? 0,
    mileage_km: parsed.mileageKm,
    mileage_amount: parsed.mileageAmount ?? 0,
    mileage_to_site: parsed.mileageToSite,
    other_amount: parsed.otherAmount ?? 0,
    parts_total: parsed.partsTotal ?? 0,
    total_amount: parsed.totalAmount ?? 0,
    distributor_no: parsed.distributorNo || null,
    parts: parts,
    source_raw_text: parsed.sourceRawText || null,
    source_serial_no: parsed.serialNo || null,
    source_parse_version: 'web-v0.7-deep-parity',
    source_fields: {
      app_code: parsed.appCode || null,
    },
    source_provenance: {
      parser: 'apps/web parseWarrantyText tsv-map',
      wo_policy: 'clear_wo_on_new_collision',
      version: '0.7',
    },
    last_updated: new Date().toISOString(),
  };
}

/** PLAN aturan 12: jangan menimpa data terisi dengan kosong/null. */
export function omitEmptyFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'claim_id') continue;
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}
