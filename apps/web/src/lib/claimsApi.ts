import { getSupabase } from './supabase';

export type ClaimListRow = {
  claim_id: string;
  serial_no: string | null;
  model: string | null;
  customer: string | null;
  branch: string | null;
  claim_status: string | null;
  dealer_wo_so: string | null;
  failure_date: string | null;
  last_updated: string | null;
  archived_at: string | null;
  fault_description?: string | null;
  causing_part_no?: string | null;
};

export type ClaimDetail = ClaimListRow & {
  fault_description: string | null;
  causing_part_no: string | null;
  causing_part_desc: string | null;
  hm_failure: number | string | null;
  hm_completion: number | string | null;
  repair_method: string | null;
  dealer_repair_date: string | null;
  completion_date: string | null;
  technical_personnel: string | null;
  cause_analyze: string | null;
  comment: string | null;
  indent_no: string | null;
  labour_hrs: number | null;
  mileage_km: number | null;
  sales_date: string | null;
  distributor: string | null;
  dealer_name: string | null;
  dealer_code: string | null;
  engine_serial_no: string | null;
  failure_part_location: string | null;
  parts_total: number | null;
  total_amount: number | null;
  currency: string | null;
  repair_status: string | null;
};

export type StatusCounts = Record<string, number>;

const LIST_SELECT =
  'claim_id,serial_no,model,customer,branch,claim_status,dealer_wo_so,failure_date,last_updated,archived_at,fault_description,causing_part_no';

const DETAIL_SELECT =
  LIST_SELECT +
  ',causing_part_desc,hm_failure,hm_completion,repair_method,dealer_repair_date,completion_date,technical_personnel,cause_analyze,comment,indent_no,labour_hrs,mileage_km,sales_date,distributor,dealer_name,dealer_code,engine_serial_no,failure_part_location,parts_total,total_amount,currency,repair_status';

export async function fetchActiveClaims(limit = 500): Promise<ClaimListRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('claims')
    .select(LIST_SELECT)
    .is('archived_at', null)
    .order('last_updated', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as ClaimListRow[];
}

export async function fetchClaimById(claimId: string): Promise<ClaimDetail> {
  const id = String(claimId || '').trim();
  if (!id) throw new Error('claim_id kosong');

  const sb = getSupabase();
  const { data, error } = await sb
    .from('claims')
    .select(DETAIL_SELECT)
    .eq('claim_id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Klaim tidak ditemukan: ${id}`);
  const row = data as unknown as ClaimDetail;
  if (String(row.claim_id) !== id) {
    throw new Error('claim_id mismatch — fail closed');
  }
  return row;
}

export async function countActiveClaims(): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from('claims')
    .select('claim_id', { count: 'exact', head: true })
    .is('archived_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchStatusBreakdown(): Promise<StatusCounts> {
  const rows = await fetchActiveClaims(2000);
  const out: StatusCounts = {};
  for (const r of rows) {
    const s = r.claim_status || 'Unknown';
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}

export async function allocateNextClaimId(year = new Date().getFullYear()): Promise<string> {
  const sb = getSupabase();
  const suffix = `-${year}-SDLG-PFR`;
  const { data, error } = await sb
    .from('claims')
    .select('claim_id')
    .like('claim_id', `%${suffix}`)
    .order('claim_id', { ascending: false })
    .limit(50);

  if (error) throw error;

  let max = 0;
  for (const row of data || []) {
    const id = String((row as { claim_id: string }).claim_id || '');
    const m = id.match(/^(\d{4})-\d{4}-SDLG-PFR$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const next = String(max + 1).padStart(4, '0');
  return `${next}-${year}-SDLG-PFR`;
}

export async function insertClaim(row: Record<string, unknown>): Promise<string> {
  const sb = getSupabase();
  const claimId = String(row.claim_id || '').trim();
  if (!claimId) throw new Error('claim_id required');
  const { error } = await sb.from('claims').insert(row);
  if (error) throw error;
  return claimId;
}

export async function updateClaimById(
  claimId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const id = String(claimId || '').trim();
  if (!id) throw new Error('claim_id required');
  const { claim_id: _omit, ...rest } = patch;
  const sb = getSupabase();
  const { error } = await sb
    .from('claims')
    .update({ ...rest, last_updated: new Date().toISOString() })
    .eq('claim_id', id);
  if (error) throw error;
}

export async function countMachines(): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb.from('machines').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Mapped view of public.machines (normalized ids + OSF text fields). */
export type MachineRow = {
  id?: string;
  serial_no: string | null;
  model: string | null;
  customer: string | null;
  branch: string | null;
  sales_date?: string | null;
};

type MachineDb = {
  serial_no: string | null;
  osf_model_code: string | null;
  contract_customer: string | null;
  osf_dealer_name: string | null;
  sale_date: string | null;
};

function mapMachine(row: MachineDb): MachineRow {
  return {
    serial_no: row.serial_no,
    model: row.osf_model_code,
    customer: row.contract_customer,
    branch: row.osf_dealer_name,
    sales_date: row.sale_date,
  };
}

const MACHINE_SELECT =
  'serial_no,osf_model_code,contract_customer,osf_dealer_name,sale_date';

export async function searchMachines(q: string, limit = 40): Promise<MachineRow[]> {
  const sb = getSupabase();
  const term = q.trim();
  if (!term) {
    const { data, error } = await sb
      .from('machines')
      .select(MACHINE_SELECT)
      .order('serial_no', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return ((data || []) as MachineDb[]).map(mapMachine);
  }
  const { data, error } = await sb
    .from('machines')
    .select(MACHINE_SELECT)
    .or(
      `serial_no.ilike.%${term}%,osf_model_code.ilike.%${term}%,contract_customer.ilike.%${term}%,osf_dealer_name.ilike.%${term}%`,
    )
    .limit(limit);
  if (error) throw error;
  return ((data || []) as MachineDb[]).map(mapMachine);
}

export async function findMachineBySerial(serial: string): Promise<MachineRow | null> {
  const s = serial.trim();
  if (!s) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('machines')
    .select(MACHINE_SELECT)
    .ilike('serial_no', `%${s}%`)
    .limit(5);
  if (error) throw error;
  const rows = ((data || []) as MachineDb[]).map(mapMachine);
  return rows[0] || null;
}

export async function claimsForSerial(serial: string, limit = 20): Promise<ClaimListRow[]> {
  const s = serial.trim();
  if (!s) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('claims')
    .select(LIST_SELECT)
    .is('archived_at', null)
    .ilike('serial_no', `%${s}%`)
    .order('failure_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ClaimListRow[];
}
