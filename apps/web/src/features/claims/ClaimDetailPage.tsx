import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  archiveClaim,
  ConcurrentEditError,
  fetchClaimById,
  fetchClaimStatusHistory,
  unarchiveClaim,
  updateClaimById,
  updateClaimStatusRpc,
  type ClaimDetail,
} from '@/lib/claimsApi';
import { dash, formatDateDisplay, formatMoney } from '@/lib/format';
import { StatusBadge } from '@/shared/StatusBadge';

/** Full set matching public.claims.claim_status check constraint (legacy parity) */
const STATUSES = [
  'Draft',
  'Ready to Claim',
  'Submitted to Warranty Admin',
  'Submitted to SDLG',
  'Claimed to SDLG',
  'SDLG Audit',
  'Approved',
  'Rejected',
  'Billing',
  'Paid',
  'Completed',
  'On Hold',
] as const;

type Status = (typeof STATUSES)[number];

function suggestNextStatus(current: string | null | undefined): Status {
  const c = String(current || '').trim();
  const idx = STATUSES.findIndex((s) => s === c);
  if (idx >= 0 && idx < STATUSES.length - 1) {
    const next = STATUSES[idx + 1];
    if (next === 'Rejected') return (STATUSES[idx + 2] as Status) || 'SDLG Audit';
    return next as Status;
  }
  return 'SDLG Audit';
}

function Field({
  label,
  value,
  mono,
  money,
  currency,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
  money?: boolean;
  currency?: string | null;
}) {
  let display = dash(value);
  if (money && value != null && value !== '') {
    display = formatMoney(value, currency) || display;
  }
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{display}</dd>
    </div>
  );
}

function DateField({ label, value }: { label: string; value: unknown }) {
  return <Field label={label} value={formatDateDisplay(value) || null} mono />;
}

function partsRows(parts: unknown): Array<Record<string, unknown>> {
  if (!parts) return [];
  if (Array.isArray(parts)) return parts as Array<Record<string, unknown>>;
  if (typeof parts === 'string') {
    try {
      const p = JSON.parse(parts);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Editable subset — maps form key → DB column */
const EDIT_MAP = [
  { key: 'model', label: 'Model', col: 'model' },
  { key: 'serial_no', label: 'Serial', col: 'serial_no' },
  { key: 'indent_no', label: 'Indent', col: 'indent_no' },
  { key: 'customer', label: 'Customer', col: 'customer' },
  { key: 'branch', label: 'Branch', col: 'branch' },
  { key: 'distributor', label: 'Distributor', col: 'distributor' },
  { key: 'dealer_name', label: 'Dealer', col: 'dealer_name' },
  { key: 'dealer_code', label: 'Dealer code', col: 'dealer_code' },
  { key: 'dealer_wo_so', label: 'WO', col: 'dealer_wo_so' },
  { key: 'dealer_claim_no', label: 'Dealer claim no', col: 'dealer_claim_no' },
  { key: 'distributor_no', label: 'Distributor no', col: 'distributor_no' },
  { key: 'causing_part_no', label: 'Part no', col: 'causing_part_no' },
  { key: 'causing_part_desc', label: 'Part desc', col: 'causing_part_desc' },
  { key: 'failure_part_location', label: 'Location', col: 'failure_part_location' },
  { key: 'repair_method', label: 'Repair method', col: 'repair_method' },
  { key: 'technical_personnel', label: 'Tech', col: 'technical_personnel' },
  { key: 'engine_serial_no', label: 'Engine SN', col: 'engine_serial_no' },
  { key: 'sales_date', label: 'Sales date', col: 'sales_date' },
  { key: 'failure_date', label: 'Failure date', col: 'failure_date' },
  { key: 'dealer_repair_date', label: 'Dealer repair', col: 'dealer_repair_date' },
  { key: 'dealer_claim_date', label: 'Dealer claim date', col: 'dealer_claim_date' },
  { key: 'completion_date', label: 'Completion', col: 'completion_date' },
  { key: 'hm_failure', label: 'HM failure', col: 'hm_failure' },
  { key: 'hm_completion', label: 'HM completion', col: 'hm_completion' },
  { key: 'labour_hrs', label: 'Labour hrs', col: 'labour_hrs' },
  { key: 'mileage_km', label: 'Mileage km', col: 'mileage_km' },
  { key: 'mileage_to_site', label: 'Mileage to site', col: 'mileage_to_site' },
  { key: 'parts_total', label: 'Parts total', col: 'parts_total' },
  { key: 'labour_amount', label: 'Labour amount', col: 'labour_amount' },
  { key: 'mileage_amount', label: 'Mileage amount', col: 'mileage_amount' },
  { key: 'other_amount', label: 'Other amount', col: 'other_amount' },
  { key: 'total_amount', label: 'Total amount', col: 'total_amount' },
  { key: 'currency', label: 'Currency', col: 'currency' },
  { key: 'sdlg_no', label: 'SDLG no', col: 'sdlg_no' },
  { key: 'sdlg_submission_no', label: 'SDLG submission no', col: 'sdlg_submission_no' },
  { key: 'invoice_no', label: 'Invoice no', col: 'invoice_no' },
  { key: 'payment_amount', label: 'Payment amount', col: 'payment_amount' },
] as const;

const TEXT_AREAS = [
  { key: 'fault_description', label: 'Fault', col: 'fault_description' },
  { key: 'cause_analyze', label: 'Cause', col: 'cause_analyze' },
  { key: 'comment', label: 'Comment', col: 'comment' },
] as const;

const NUM_COLS = new Set([
  'hm_failure',
  'hm_completion',
  'labour_hrs',
  'mileage_km',
  'mileage_to_site',
  'parts_total',
  'labour_amount',
  'mileage_amount',
  'other_amount',
  'total_amount',
  'payment_amount',
]);

function claimToForm(c: ClaimDetail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of EDIT_MAP) {
    const v = (c as Record<string, unknown>)[f.col];
    out[f.key] = v == null ? '' : String(v);
  }
  for (const f of TEXT_AREAS) {
    const v = (c as Record<string, unknown>)[f.col];
    out[f.key] = v == null ? '' : String(v);
  }
  return out;
}

/** Only send fields that actually changed; never send empty string over existing value unless user cleared intentionally */
function buildPatch(
  form: Record<string, string>,
  original: ClaimDetail,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const all = [...EDIT_MAP, ...TEXT_AREAS];
  for (const f of all) {
    const raw = form[f.key] ?? '';
    const orig = (original as Record<string, unknown>)[f.col];
    const origStr = orig == null ? '' : String(orig);

    if (raw === origStr) continue;

    if (NUM_COLS.has(f.col)) {
      if (raw.trim() === '') {
        // only clear if original had a value
        if (orig != null && orig !== '') patch[f.col] = null;
      } else {
        const n = Number(String(raw).replace(/,/g, ''));
        if (Number.isFinite(n)) patch[f.col] = n;
      }
    } else {
      // text / date
      if (raw.trim() === '' && (orig == null || orig === '')) continue;
      patch[f.col] = raw.trim() === '' ? null : raw.trim();
    }
  }
  return patch;
}

export function ClaimDetailPage() {
  const { claimId = '' } = useParams();
  const id = decodeURIComponent(claimId);
  const qc = useQueryClient();

  const [showStatus, setShowStatus] = useState(false);
  const [nextStatus, setNextStatus] = useState<Status>('SDLG Audit');
  const [reason, setReason] = useState('');
  const [statusDate, setStatusDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['claim', id],
    queryFn: () => fetchClaimById(id),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: 1,
  });

  const histQ = useQuery({
    queryKey: ['claim-history', id],
    queryFn: () => fetchClaimStatusHistory(id),
    enabled: Boolean(id),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (q.data?.claim_status) {
      setNextStatus(suggestNextStatus(q.data.claim_status));
    }
  }, [q.data?.claim_status]);

  // Reset edit form when claim changes or user opens edit
  useEffect(() => {
    if (q.data && editing) {
      setForm(claimToForm(q.data));
    }
  }, [q.data, editing]);

  // Clean shared state when leaving claim
  useEffect(() => {
    return () => {
      setEditing(false);
      setForm({});
      setSaveMsg(null);
      setSaveErr(null);
      setStatusMsg(null);
      setStatusErr(null);
    };
  }, [id]);

  const statusMut = useMutation({
    mutationFn: async () => {
      if (nextStatus === 'Rejected' && !reason.trim()) {
        throw new Error('Alasan wajib diisi untuk status Rejected');
      }
      await updateClaimStatusRpc({
        claimId: id,
        status: nextStatus,
        statusDate,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setStatusMsg(`Status berhasil diubah → ${nextStatus}`);
      setStatusErr(null);
      setShowStatus(false);
      setReason('');
      await qc.invalidateQueries({ queryKey: ['claim', id] });
      await qc.invalidateQueries({ queryKey: ['claim-history', id] });
      await qc.invalidateQueries({ queryKey: ['claims'] });
    },
    onError: (err) => {
      setStatusErr(err instanceof Error ? err.message : 'Gagal update status');
    },
  });

  const archMut = useMutation({
    mutationFn: async (mode: 'archive' | 'unarchive') => {
      if (mode === 'archive') await archiveClaim(id);
      else await unarchiveClaim(id);
    },
    onSuccess: async (_, mode) => {
      setStatusMsg(mode === 'archive' ? 'Klaim di-archive' : 'Klaim di-unarchive');
      await qc.invalidateQueries({ queryKey: ['claim', id] });
      await qc.invalidateQueries({ queryKey: ['claims'] });
    },
    onError: (err) => {
      setStatusErr(err instanceof Error ? err.message : 'Gagal archive');
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!q.data) throw new Error('Data klaim belum siap');
      const patch = buildPatch(form, q.data);
      if (Object.keys(patch).length === 0) {
        throw new Error('Tidak ada perubahan');
      }
      await updateClaimById(id, patch, {
        expectedLastUpdated: q.data.last_updated,
      });
    },
    onSuccess: async () => {
      setSaveMsg('Perubahan tersimpan');
      setSaveErr(null);
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ['claim', id] });
      await qc.invalidateQueries({ queryKey: ['claims'] });
    },
    onError: (err) => {
      if (err instanceof ConcurrentEditError) {
        setSaveErr(err.message);
      } else {
        setSaveErr(err instanceof Error ? err.message : 'Gagal menyimpan');
      }
    },
  });

  function startEdit() {
    if (!q.data) return;
    setSaveMsg(null);
    setSaveErr(null);
    setForm(claimToForm(q.data));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm({});
    setSaveErr(null);
  }

  const rows = partsRows(q.data?.parts);
  const isArchived = Boolean(q.data?.archived_at);

  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <Link to="/claims" className="back-link">
            ← Claims
          </Link>
          <h1 className="mono">{id || '—'}</h1>
          {q.data ? (
            <div className="header-meta">
              <StatusBadge status={q.data.claim_status} />
              {isArchived ? <span className="muted small">Archived</span> : null}
            </div>
          ) : null}
        </div>
        <div className="header-actions">
          {!editing ? (
            <>
              <button type="button" className="ghost" onClick={startEdit} disabled={!q.data}>
                Edit data
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setStatusErr(null);
                  setStatusMsg(null);
                  setShowStatus(true);
                }}
              >
                Ubah status
              </button>
              {q.data ? (
                <button
                  type="button"
                  className="ghost"
                  disabled={archMut.isPending}
                  onClick={() => archMut.mutate(isArchived ? 'unarchive' : 'archive')}
                >
                  {isArchived ? 'Unarchive' : 'Archive'}
                </button>
              ) : null}
              <Link className="btn-link" to={`/claims/${encodeURIComponent(id)}/sdlg`}>
                Submit ke SDLG
              </Link>
              <Link className="btn-link ghost-link" to="/parse">
                Parse form
              </Link>
            </>
          ) : (
            <>
              <button type="button" className="ghost" onClick={cancelEdit} disabled={saveMut.isPending}>
                Batal
              </button>
              <button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
              </button>
            </>
          )}
        </div>
      </header>

      {statusMsg ? <div className="alert info">{statusMsg}</div> : null}
      {statusErr ? <div className="alert error">{statusErr}</div> : null}
      {saveMsg ? <div className="alert info">{saveMsg}</div> : null}
      {saveErr ? <div className="alert error">{saveErr}</div> : null}

      {q.isLoading ? <p className="center-state">Memuat klaim dari Supabase…</p> : null}

      {q.isError ? (
        <div className="alert error">
          <strong>Gagal memuat klaim</strong>
          <p>{(q.error as Error).message}</p>
          <button type="button" onClick={() => q.refetch()}>
            Coba lagi
          </button>
        </div>
      ) : null}

      {showStatus ? (
        <div className="modal-root">
          <div className="modal-backdrop" onClick={() => setShowStatus(false)} />
          <div className="modal-card">
            <div className="modal-accent" />
            <div className="modal-body">
              <h2>Ubah status klaim</h2>
              <p className="muted small" style={{ marginTop: -4, marginBottom: 12 }}>
                Status mengikuti aturan database & RPC web lama. Rejected wajib isi alasan.
              </p>
              <label>
                Status
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as Status)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tanggal status (YYYY-MM-DD)
                <input
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                  placeholder="2026-10-28"
                />
              </label>
              <label>
                Alasan {nextStatus === 'Rejected' ? '(wajib)' : '(opsional)'}
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    nextStatus === 'Rejected'
                      ? 'Wajib diisi untuk Rejected…'
                      : 'Catatan perubahan status (opsional)'
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setShowStatus(false)}>
                Batal
              </button>
              <button
                type="button"
                disabled={statusMut.isPending}
                onClick={() => statusMut.mutate()}
              >
                {statusMut.isPending ? 'Menyimpan…' : 'Simpan status'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {q.data && editing ? (
        <section className="panel">
          <h2 className="section-title">Edit data klaim</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Hanya field yang berubah yang disimpan. Nilai kosong tidak akan menimpa data yang sudah ada kecuali kamu sengaja kosongkan.
          </p>
          <div className="edit-grid">
            {EDIT_MAP.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="parse-textareas">
            {TEXT_AREAS.map((f) => (
              <label key={f.key}>
                {f.label}
                <textarea
                  rows={f.key === 'cause_analyze' ? 5 : 3}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {q.data && !editing ? (
        <>
          <section className="panel">
            <h2 className="section-title">Status</h2>
            <dl className="detail-grid">
              <Field label="Claim status" value={q.data.claim_status} />
              <DateField label="Status date" value={q.data.status_date} />
              <Field label="Status reason" value={q.data.status_update_reason} />
              <Field label="Repair status" value={q.data.repair_status} />
            </dl>
          </section>

          <section className="panel">
            <h2 className="section-title">Riwayat status</h2>
            {(histQ.data || []).length === 0 && histQ.isFetched ? (
              <p className="muted">Belum ada history.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Tanggal</th>
                      <th>Alasan</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(histQ.data || []).map((h) => (
                      <tr key={h.id}>
                        <td>
                          <StatusBadge status={h.status} />
                        </td>
                        <td className="mono">{formatDateDisplay(h.status_date) || '—'}</td>
                        <td>{h.reason || '—'}</td>
                        <td className="mono small">{h.created_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="section-title">Unit & pihak</h2>
            <dl className="detail-grid">
              <Field label="Model" value={q.data.model} />
              <Field label="Serial" value={q.data.serial_no} mono />
              <Field label="Indent" value={q.data.indent_no} mono />
              <Field label="Customer" value={q.data.customer} />
              <Field label="Branch" value={q.data.branch} />
              <Field label="Distributor" value={q.data.distributor} />
              <Field label="Dealer" value={q.data.dealer_name} />
              <Field label="Dealer code" value={q.data.dealer_code} mono />
              <Field label="WO" value={q.data.dealer_wo_so} mono />
              <Field label="Dealer claim no" value={q.data.dealer_claim_no} mono />
              <Field label="Distributor no" value={q.data.distributor_no} mono />
            </dl>
          </section>

          <section className="panel">
            <h2 className="section-title">Kerusakan & perbaikan</h2>
            <dl className="detail-grid">
              <Field label="Fault" value={q.data.fault_description} />
              <Field label="Cause" value={q.data.cause_analyze} />
              <Field label="Comment" value={q.data.comment} />
              <Field label="Part no" value={q.data.causing_part_no} mono />
              <Field label="Part desc" value={q.data.causing_part_desc} />
              <Field label="Location" value={q.data.failure_part_location} />
              <Field label="Repair method" value={q.data.repair_method} />
              <Field label="Tech" value={q.data.technical_personnel} />
              <Field label="Engine SN" value={q.data.engine_serial_no} mono />
            </dl>
          </section>

          <section className="panel">
            <h2 className="section-title">Tanggal & HM</h2>
            <dl className="detail-grid">
              <DateField label="Sales" value={q.data.sales_date} />
              <DateField label="Failure" value={q.data.failure_date} />
              <DateField label="Dealer repair" value={q.data.dealer_repair_date} />
              <DateField label="Dealer claim date" value={q.data.dealer_claim_date} />
              <DateField label="Completion" value={q.data.completion_date} />
              <Field label="HM failure" value={q.data.hm_failure} />
              <Field label="HM completion" value={q.data.hm_completion} />
              <Field label="Labour hrs" value={q.data.labour_hrs} />
              <Field label="Mileage km" value={q.data.mileage_km} />
              <Field label="Mileage to site" value={q.data.mileage_to_site} />
            </dl>
          </section>

          <section className="panel">
            <h2 className="section-title">Uang</h2>
            <dl className="detail-grid">
              <Field label="Parts total" value={q.data.parts_total} money currency={q.data.currency} />
              <Field label="Labour amount" value={q.data.labour_amount} money currency={q.data.currency} />
              <Field label="Mileage amount" value={q.data.mileage_amount} money currency={q.data.currency} />
              <Field label="Other amount" value={q.data.other_amount} money currency={q.data.currency} />
              <Field label="Total amount" value={q.data.total_amount} money currency={q.data.currency} />
              <Field label="Currency" value={q.data.currency} />
            </dl>
          </section>

          <section className="panel">
            <h2 className="section-title">Finance / SDLG</h2>
            <dl className="detail-grid">
              <Field label="SDLG no" value={q.data.sdlg_no} mono />
              <Field label="SDLG submission no" value={q.data.sdlg_submission_no} mono />
              <DateField label="SDLG audit date" value={q.data.sdlg_audit_date} />
              <DateField label="SDLG approval date" value={q.data.sdlg_approval_date} />
              <Field label="Invoice no" value={q.data.invoice_no} mono />
              <DateField label="Invoice date" value={q.data.invoice_date} />
              <DateField label="Payment date" value={q.data.payment_date} />
              <Field label="Payment amount" value={q.data.payment_amount} money currency={q.data.currency} />
            </dl>
          </section>

          <section className="panel">
            <h2 className="section-title">Parts lines</h2>
            {rows.length === 0 ? (
              <p className="muted">Tidak ada baris parts.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Failure</th>
                      <th>Replacement</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{dash(r.failure_part_no || r.failurePartNo || r.part_no)}</td>
                        <td className="mono">{dash(r.replacement_part_no || r.replacementPartNo)}</td>
                        <td>{dash(r.description || r.desc)}</td>
                        <td>{dash(r.qty ?? r.quantity)}</td>
                        <td className="mono">{dash(r.unit_price ?? r.unitPrice)}</td>
                        <td className="mono">{dash(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {q.data.source_raw_text ? (
            <section className="panel">
              <h2 className="section-title">Source (raw text)</h2>
              <pre
                className="source-raw mono small"
                style={{ whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}
              >
                {q.data.source_raw_text}
              </pre>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
