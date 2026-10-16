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
  repair_method: string | null;
  dealer_repair_date: string | null;
  completion_date: string | null;
  technical_personnel: string | null;
  cause_analyze: string | null;
  comment: string | null;
  indent_no: string | null;
  labour_hrs: number | null;
  mileage_km: number | null;
};

const LIST_SELECT =
  'claim_id,serial_no,model,customer,branch,claim_status,dealer_wo_so,failure_date,last_updated,archived_at,fault_description,causing_part_no';

const DETAIL_SELECT =
  LIST_SELECT +
  ',causing_part_desc,hm_failure,repair_method,dealer_repair_date,completion_date,technical_personnel,cause_analyze,comment,indent_no,labour_hrs,mileage_km';

export async function fetchActiveClaims(limit = 200): Promise<ClaimListRow[]> {
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
  if (String((data as ClaimDetail).claim_id) !== id) {
    throw new Error('claim_id mismatch — fail closed');
  }
  return data as ClaimDetail;
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

/** Next id: NNNN-YYYY-SDLG-PFR */
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
  const { error, count } = await sbUpdate(id, {
    ...rest,
    last_updated: new Date().toISOString(),
  });
  if (error) throw error;
  if (count === 0) {
    // still ok if RLS hides count — verify by re-fetch optional
  }
}

async function sbUpdate(id: string, patch: Record<string, unknown>) {
  const sb = getSupabase();
  return sb.from('claims').update(patch).eq('claim_id', id);
}
