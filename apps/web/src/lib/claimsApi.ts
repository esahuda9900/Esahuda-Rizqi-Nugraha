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
  source_raw_text?: string | null;
  distributor_no?: string | null;
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
  ',causing_part_desc,hm_failure,hm_completion,repair_method,dealer_repair_date,completion_date,technical_personnel,cause_analyze,comment,indent_no,labour_hrs,mileage_km,mileage_to_site,sales_date,distributor,dealer_name,dealer_code,engine_serial_no,failure_part_location,parts_total,labour_amount,mileage_amount,other_amount,total_amount,currency,repair_status,status_date,status_update_reason,sdlg_submission_no,sdlg_audit_date,sdlg_approval_date,sdlg_no,invoice_no,invoice_date,payment_date,payment_amount,dealer_claim_date,dealer_claim_no,parts,source_raw_text,distributor_no';

type FetchClaimsOpts = { limit?: number; includeArchived?: boolean };

export async function fetchClaims(opts: FetchClaimsOpts = {}): Promise<ClaimListRow[]> {
  const sb = getSupabase();
  const limit = opts.limit ?? 500;
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
  const sb = getSupabase();
  const { data, error } = await sb.from('claims').select(DETAIL_SELECT).eq('claim_id', claimId).maybeSingle().overrideTypes<ClaimDetail, { merge: false }>();
  if (error) throw error;
  if (!data) throw new Error(`Claim ${claimId} tidak ditemukan`);
  return data as ClaimDetail;
}

export async function fetchClaimStatusHistory(claimId: string): Promise<ClaimStatusHistoryRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('claim_status_history')
    .select('id,claim_id,status,status_date,reason,created_at')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data || []) as ClaimStatusHistoryRow[];
}

export async function fetchRecentStatusHistory(limit = 40): Promise<ClaimStatusHistoryRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('claim_status_history')
    .select('id,claim_id,status,status_date,reason,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
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
  constructor(message = 'Klaim diubah user lain. Muat ulang lalu simpan lagi.') {
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

export async function archiveClaim(claimId: string): Promise<void> {
  await updateClaimById(claimId, { archived_at: new Date().toISOString() });
}

export async function unarchiveClaim(claimId: string): Promise<void> {
  await updateClaimById(claimId, { archived_at: null });
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
  indent_no?: string | null;
  source_serial_no?: string | null;
};

type MachineDb = {
  serial_no: string | null;
  source_serial_no?: string | null;
  model_id?: string | null;
  customer_id?: string | null;
  branch_id?: string | null;
  osf_model?: string | null;
  indent_no?: string | null;
  customer_name_source?: string | null;
  osf_sales_date?: string | null;
  is_active?: boolean | null;
};

const MACHINE_SELECT =
  'serial_no,source_serial_no,model_id,customer_id,branch_id,osf_model,indent_no,customer_name_source,osf_sales_date,is_active';

function serialDigitsTail6(s: string): string {
  const d = String(s || '').replace(/\D/g, '');
  return d.length >= 6 ? d.slice(-6) : d;
}

function compact(s: string): string {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

async function hydrateMachine(row: MachineDb): Promise<MachineRow> {
  const sb = getSupabase();
  let model = row.osf_model || null;
  let customer = row.customer_name_source || null;
  let branch: string | null = null;

  if (row.model_id) {
    const { data } = await sb
      .from('models')
      .select('model_code,model_name')
      .eq('id', row.model_id)
      .maybeSingle();
    if (data) {
      const d = data as { model_name?: string; model_code?: string };
      model = d.model_name || d.model_code || model;
    }
  }
  if (row.customer_id) {
    const { data } = await sb
      .from('customers')
      .select('customer_name')
      .eq('id', row.customer_id)
      .maybeSingle();
    if (data && (data as { customer_name?: string }).customer_name) {
      customer = (data as { customer_name: string }).customer_name;
    }
  }
  if (row.branch_id) {
    const { data } = await sb
      .from('branches')
      .select('branch_name,branch_code')
      .eq('id', row.branch_id)
      .maybeSingle();
    if (data) {
      const d = data as { branch_name?: string; branch_code?: string };
      branch = d.branch_name || d.branch_code || null;
    }
  }

  return {
    serial_no: row.serial_no,
    source_serial_no: row.source_serial_no || null,
    model,
    customer,
    branch,
    sales_date: row.osf_sales_date || null,
    indent_no: row.indent_no || null,
  };
}

function pickMachineDb(rows: MachineDb[], serial: string, modelHint?: string): MachineDb | null {
  const active = rows.filter((r) => r.is_active !== false);
  const pool0 = active.length ? active : rows;
  const sn = compact(serial);

  const exact = pool0.filter((c) => compact(c.serial_no || '') === sn);
  if (exact.length === 1) return exact[0];

  let pool = pool0.filter((c) => {
    const cs = compact(c.serial_no || '');
    const src = compact(c.source_serial_no || '');
    return (
      cs.endsWith(sn) ||
      sn.endsWith(cs) ||
      src === sn ||
      src.endsWith(sn) ||
      serialDigitsTail6(cs) === serialDigitsTail6(sn)
    );
  });
  if (!pool.length) pool = pool0;

  if (pool.length > 1 && modelHint) {
    const mh = compact(modelHint);
    const byModel = pool.filter((c) => {
      const cm = compact(c.osf_model || '');
      return cm === mh || cm.startsWith(mh) || mh.startsWith(cm.replace(/(LS|WS)$/, ''));
    });
    if (byModel.length) pool = byModel;
  }

  pool.sort((a, b) => compact(b.serial_no || '').length - compact(a.serial_no || '').length);
  return pool[0] || null;
}

export async function searchMachines(q: string, limit = 40): Promise<MachineRow[]> {
  const sb = getSupabase();
  const term = q.trim();
  let query = sb.from('machines').select(MACHINE_SELECT).limit(limit);
  if (term) {
    query = query.or(
      `serial_no.ilike.%${term}%,source_serial_no.ilike.%${term}%,osf_model.ilike.%${term}%,customer_name_source.ilike.%${term}%`,
    );
  } else {
    query = query.order('serial_no', { ascending: true });
  }
  const { data, error } = await query;
  if (error) throw error;
  return Promise.all(((data || []) as MachineDb[]).map(hydrateMachine));
}

export async function findMachineBySerial(
  serial: string,
  modelHint?: string,
): Promise<MachineRow | null> {
  const s = serial.trim();
  if (!s) return null;
  const sb = getSupabase();

  const tryPick = async (data: MachineDb[] | null) => {
    if (!data?.length) return null;
    const picked = pickMachineDb(data, s, modelHint);
    return picked ? hydrateMachine(picked) : null;
  };

  {
    const { data, error } = await sb.from('machines').select(MACHINE_SELECT).ilike('serial_no', s).limit(5);
    if (!error) {
      const hit = await tryPick(data as MachineDb[]);
      if (hit) return hit;
    }
  }

  {
    const { data, error } = await sb
      .from('machines')
      .select(MACHINE_SELECT)
      .ilike('source_serial_no', s)
      .limit(5);
    if (!error) {
      const hit = await tryPick(data as MachineDb[]);
      if (hit) return hit;
    }
  }

  {
    const { data, error } = await sb
      .from('machines')
      .select(MACHINE_SELECT)
      .or(`serial_no.ilike.%${s}%,source_serial_no.ilike.%${s}%`)
      .limit(30);
    if (!error) {
      const hit = await tryPick(data as MachineDb[]);
      if (hit) return hit;
    }
  }

  const tail = serialDigitsTail6(s);
  if (tail.length >= 6) {
    const { data, error } = await sb
      .from('machines')
      .select(MACHINE_SELECT)
      .ilike('serial_no', `%${tail}%`)
      .limit(40);
    if (!error) {
      const hit = await tryPick(data as MachineDb[]);
      if (hit) return hit;
    }
  }

  return null;
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

export async function inferBranchFromClaimHistory(serial: string): Promise<string> {
  const rows = await claimsForSerial(serial, 15);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const b = String(r.branch || '').trim();
    if (!b) continue;
    counts.set(b, (counts.get(b) || 0) + 1);
  }
  let best = '';
  let n = 0;
  for (const [b, c] of counts) {
    if (c > n) {
      best = b;
      n = c;
    }
  }
  return best;
}

export async function resolveModelCanonical(modelHint: string): Promise<string | null> {
  const h = modelHint.trim();
  if (!h) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('models')
    .select('model_code,model_name')
    .or(`model_code.ilike.%${h}%,model_name.ilike.%${h}%`)
    .limit(20);
  if (error || !data?.length) return null;
  const mh = compact(h);
  const rows = data as { model_code?: string; model_name?: string }[];
  const scored = rows
    .map((r) => {
      const code = compact(r.model_code || '');
      const name = compact(r.model_name || '');
      let score = 0;
      if (code === mh || name === mh) score = 100;
      else if (code.startsWith(mh) || name.startsWith(mh)) score = 80;
      else if (code.includes(mh) || name.includes(mh)) score = 50;
      return { r, score, len: (r.model_name || r.model_code || '').length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.len - a.len);
  const best = scored[0]?.r;
  return best?.model_name || best?.model_code || null;
}
