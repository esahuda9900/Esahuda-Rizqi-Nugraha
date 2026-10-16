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
  total_amount?: number | null;
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
  mileage_to_site: number | null;
  sales_date: string | null;
  distributor: string | null;
  dealer_name: string | null;
  dealer_code: string | null;
  engine_serial_no: string | null;
  failure_part_location: string | null;
  parts_total: number | null;
  labour_amount: number | null;
  mileage_amount: number | null;
  other_amount: number | null;
  total_amount: number | null;
  currency: string | null;
  repair_status: string | null;
  status_date: string | null;
  status_update_reason: string | null;
  sdlg_submission_no: string | null;
  sdlg_audit_date: string | null;
  sdlg_approval_date: string | null;
  sdlg_no: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  payment_date: string | null;
  payment_amount: number | null;
  dealer_claim_date: string | null;
  dealer_claim_no: string | null;
  parts: unknown;
};

export type StatusCounts = Record<string, number>;

export type ClaimStatusHistoryRow = {
  id: string;
  claim_id: string;
  status: string | null;
  status_date: string | null;
  reason: string | null;
  created_at: string | null;
};

const LIST_SELECT =
  'claim_id,serial_no,model,customer,branch,claim_status,dealer_wo_so,failure_date,last_updated,archived_at,fault_description,causing_part_no,total_amount';

const DETAIL_SELECT =
  LIST_SELECT +
  ',causing_part_desc,hm_failure,hm_completion,repair_method,dealer_repair_date,completion_date,technical_personnel,cause_analyze,comment,indent_no,labour_hrs,mileage_km,mileage_to_site,sales_date,distributor,dealer_name,dealer_code,engine_serial_no,failure_part_location,parts_total,labour_amount,mileage_amount,other_amount,currency,repair_status,status_date,status_update_reason,sdlg_submission_no,sdlg_audit_date,sdlg_approval_date,sdlg_no,invoice_no,invoice_date,payment_date,payment_amount,dealer_claim_date,dealer_claim_no,parts';

export type FetchClaimsOpts = { limit?: number; includeArchived?: boolean };

export async function fetchClaims(opts: FetchClaimsOpts = {}): Promise<ClaimListRow[]> {
  const limit = opts.limit ?? 800;
  const sb = getSupabase();
  let q = sb.from('claims').select(LIST_SELECT).order('last_updated', { ascending: false }).limit(limit);
  if (!opts.includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ClaimListRow[];
}

export async function fetchActiveClaims(limit = 500): Promise<ClaimListRow[]> {
  return fetchClaims({ limit, includeArchived: false });
}

export async function fetchClaimById(claimId: string): Promise<ClaimDetail> {
  const id = String(claimId || '').trim();
  if (!id) throw new Error('claim_id kosong');
  const sb = getSupabase();
  const { data, error } = await sb.from('claims').select(DETAIL_SELECT).eq('claim_id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Klaim tidak ditemukan: ${id}`);
  const row = data as unknown as ClaimDetail;
  if (String(row.claim_id) !== id) throw new Error('claim_id mismatch — fail closed');
  return row;
}

export async function fetchClaimStatusHistory(claimId: string): Promise<ClaimStatusHistoryRow[]> {
  const id = String(claimId || '').trim();
  if (!id) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('claim_status_history')
    .select('id,claim_id,status,status_date,reason,created_at')
    .eq('claim_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as ClaimStatusHistoryRow[];
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
  const rows = await fetchClaims({ limit: 2000, includeArchived: false });
  const out: StatusCounts = {};
  for (const r of rows) {
    const s = r.claim_status || 'Unknown';
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}

export async function allocateNextClaimId(year = new Date().getFullYear()): Promise<string> {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc('next_sdlg_claim_id');
    if (!error && data) {
      const id = String(data).trim();
      if (/^\d{4}-\d{4}-SDLG-PFR$/i.test(id)) return id;
    }
  } catch {
    /* fallback */
  }
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
  return `${String(max + 1).padStart(4, '0')}-${year}-SDLG-PFR`;
}

/** New claim via SECURITY DEFINER RPC (allocates claim_id safely). */
export async function createClaimViaRpc(payload: Record<string, unknown>): Promise<string> {
  const sb = getSupabase();
  const body = { ...payload };
  delete body.claim_id;
  if (!body.claim_status) body.claim_status = 'Draft';
  const { data, error } = await sb.rpc('create_sdlg_claim', { p_claim: body });
  if (error) throw error;
  const id = String(data || '').trim();
  if (!id) throw new Error('create_sdlg_claim tidak mengembalikan claim_id');
  return id;
}

export async function insertClaim(row: Record<string, unknown>): Promise<string> {
  const sb = getSupabase();
  const claimId = String(row.claim_id || '').trim();
  if (!claimId) throw new Error('claim_id required');
  const { error } = await sb.from('claims').insert(row);
  if (error) throw error;
  return claimId;
}

export class ConcurrentEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrentEditError';
  }
}

export async function updateClaimById(
  claimId: string,
  patch: Record<string, unknown>,
  opts?: { expectedLastUpdated?: string | null },
): Promise<void> {
  const id = String(claimId || '').trim();
  if (!id) throw new Error('claim_id required');
  const { claim_id: _omit, ...rest } = patch;
  const sb = getSupabase();

  if (opts?.expectedLastUpdated) {
    const { data: live, error: readErr } = await sb
      .from('claims')
      .select('last_updated')
      .eq('claim_id', id)
      .maybeSingle();
    if (readErr) throw readErr;
    const liveTs = live ? String((live as { last_updated?: string }).last_updated || '') : '';
    if (liveTs && liveTs !== String(opts.expectedLastUpdated)) {
      throw new ConcurrentEditError(
        'Klaim diubah orang lain setelah kamu buka. Muat ulang lalu simpan lagi.',
      );
    }
  }

  const { error } = await sb
    .from('claims')
    .update({ ...rest, last_updated: new Date().toISOString() })
    .eq('claim_id', id);
  if (error) throw error;
}

export async function updateClaimStatusRpc(opts: {
  claimId: string;
  status: string;
  statusDate?: string;
  reason?: string;
}): Promise<void> {
  const claimId = String(opts.claimId || '').trim();
  const status = String(opts.status || '').trim();
  if (!claimId || !status) throw new Error('claim_id dan status wajib');
  if (status === 'Rejected' && !String(opts.reason || '').trim()) {
    throw new Error('Alasan wajib untuk status Rejected');
  }
  const sb = getSupabase();
  const statusDate =
    opts.statusDate ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const { error } = await sb.rpc('update_claim_status', {
    p_claim_id: claimId,
    p_status: status,
    p_status_date: statusDate,
    p_reason: opts.reason || null,
  });
  if (error) throw error;
}

export async function countMachines(): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb.from('machines').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export type MachineRow = {
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

const MACHINE_SELECT = 'serial_no,osf_model_code,contract_customer,osf_dealer_name,sale_date';

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
  const { data, error } = await sb.from('machines').select(MACHINE_SELECT).ilike('serial_no', `%${s}%`).limit(5);
  if (error) throw error;
  return ((data || []) as MachineDb[]).map(mapMachine)[0] || null;
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
