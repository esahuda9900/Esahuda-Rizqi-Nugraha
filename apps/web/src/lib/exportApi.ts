import { getSupabase } from './supabase';
import { rowsToCsv, stampWib, downloadText } from './download';

/** Subset columns aligned with day-to-day monitoring / web lama export spirit. */
export const CLAIMS_EXPORT_COLUMNS = [
  'claim_id',
  'claim_status',
  'dealer_wo_so',
  'model',
  'serial_no',
  'customer',
  'branch',
  'fault_description',
  'causing_part_no',
  'causing_part_desc',
  'failure_date',
  'dealer_repair_date',
  'completion_date',
  'dealer_claim_date',
  'hm_failure',
  'hm_completion',
  'labour_hrs',
  'mileage_km',
  'parts_total',
  'total_amount',
  'currency',
  'sdlg_submission_no',
  'sdlg_audit_date',
  'sdlg_approval_date',
  'invoice_no',
  'invoice_date',
  'payment_date',
  'payment_amount',
  'last_updated',
  'archived_at',
] as const;

const PAGE = 800;

export async function fetchAllClaimsForExport(): Promise<Record<string, unknown>[]> {
  const sb = getSupabase();
  const select = CLAIMS_EXPORT_COLUMNS.join(',');
  const out: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from('claims')
      .select(select)
      .order('claim_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data || []) as unknown as Record<string, unknown>[];
    out.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 50_000) break; // safety
  }
  return out;
}

export async function downloadClaimsCsv(): Promise<{ rows: number; filename: string }> {
  const rows = await fetchAllClaimsForExport();
  const csv = rowsToCsv([...CLAIMS_EXPORT_COLUMNS], rows);
  const filename = `sdlg-claims-export-${stampWib()}.csv`;
  // BOM for Excel-friendly UTF-8
  downloadText(filename, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  return { rows: rows.length, filename };
}

/** Tables included in full backup (read via RLS). */
export const BACKUP_TABLES = [
  'claims',
  'claim_status_history',
  'machines',
  'customers',
  'customer_aliases',
  'branches',
  'dealers',
  'models',
  'parts_master',
  'app_user_roles',
  'wo_followups',
] as const;

export type BackupPayload = {
  exported_at: string;
  timezone: 'Asia/Jakarta';
  app: 'apps/web';
  phase: '3';
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

async function fetchTableAll(table: string): Promise<unknown[]> {
  const sb = getSupabase();
  const out: unknown[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = data || [];
    out.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 50_000) break;
  }
  return out;
}

export async function buildFullBackup(): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) {
    try {
      const rows = await fetchTableAll(t);
      tables[t] = rows;
      counts[t] = rows.length;
    } catch (err) {
      tables[t] = [];
      counts[t] = -1;
      tables[`${t}__error`] = [{ message: err instanceof Error ? err.message : String(err) }];
    }
  }
  return {
    exported_at: new Date().toISOString(),
    timezone: 'Asia/Jakarta',
    app: 'apps/web',
    phase: '3',
    tables,
    counts,
  };
}

export async function downloadFullBackupJson(): Promise<{ counts: Record<string, number>; filename: string }> {
  const payload = await buildFullBackup();
  const filename = `sdlg-backup-${stampWib()}.json`;
  downloadText(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  return { counts: payload.counts, filename };
}
