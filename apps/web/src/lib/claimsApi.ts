import { getSupabase } from './supabase';

/** Columns safe for list — expand carefully; keep editor on full row by id. */
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
};

const LIST_SELECT =
  'claim_id,serial_no,model,customer,branch,claim_status,dealer_wo_so,failure_date,last_updated,archived_at';

const DETAIL_SELECT =
  LIST_SELECT +
  ',fault_description,causing_part_no,causing_part_desc,hm_failure,repair_method,dealer_repair_date,completion_date,technical_personnel';

export async function fetchActiveClaims(limit = 100): Promise<ClaimListRow[]> {
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

/** Exact id only — never fall back to list cache for editor body (PRD F3). */
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
