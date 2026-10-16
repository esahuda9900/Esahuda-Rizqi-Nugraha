import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { fetchClaimById, updateClaimById } from '@/lib/claimsApi';
import { StatusBadge } from '@/shared/StatusBadge';

const STATUSES = ['Draft', 'SDLG Audit', 'Paid', 'Rejected'] as const;

function Field({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  const v = value == null || value === '' ? '—' : String(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{v}</dd>
    </div>
  );
}

export function ClaimDetailPage() {
  const { claimId = '' } = useParams();
  const id = decodeURIComponent(claimId);
  const qc = useQueryClient();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['claim', id],
    queryFn: () => fetchClaimById(id),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: 1,
  });

  const statusMut = useMutation({
    mutationFn: async (next: string) => {
      await updateClaimById(id, { claim_status: next });
      return next;
    },
    onSuccess: async (next) => {
      setStatusMsg(`Status → ${next}`);
      setStatusErr(null);
      await qc.invalidateQueries({ queryKey: ['claim', id] });
      await qc.invalidateQueries({ queryKey: ['claims'] });
    },
    onError: (err) => {
      setStatusErr(err instanceof Error ? err.message : 'Gagal update status');
    },
  });

  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <Link to="/claims" className="back-link">
            ← Claims
          </Link>
          <h1 className="mono">{id || '—'}</h1>
          {q.data ? <StatusBadge status={q.data.claim_status} /> : null}
        </div>
        <Link className="btn-link ghost-link" to="/parse">
          Parse form
        </Link>
      </header>

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

      {q.data ? (
        <>
          <section className="panel">
            <h2 className="section-title">Status workflow</h2>
            <div className="toolbar">
              <select
                value={q.data.claim_status || 'Draft'}
                disabled={statusMut.isPending}
                onChange={(e) => statusMut.mutate(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {q.data.claim_status &&
                !STATUSES.includes(q.data.claim_status as (typeof STATUSES)[number]) ? (
                  <option value={q.data.claim_status}>{q.data.claim_status}</option>
                ) : null}
              </select>
            </div>
            {statusMsg ? <div className="alert info">{statusMsg}</div> : null}
            {statusErr ? <div className="alert error">{statusErr}</div> : null}
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
              <Field label="Repair status" value={q.data.repair_status} />
              <Field label="Tech" value={q.data.technical_personnel} />
              <Field label="Engine SN" value={q.data.engine_serial_no} mono />
            </dl>
          </section>

          <section className="panel">
            <h2 className="section-title">Tanggal & HM</h2>
            <dl className="detail-grid">
              <Field label="Sales" value={q.data.sales_date} mono />
              <Field label="Failure" value={q.data.failure_date} mono />
              <Field label="Dealer repair" value={q.data.dealer_repair_date} mono />
              <Field label="Completion" value={q.data.completion_date} mono />
              <Field label="HM failure" value={q.data.hm_failure} />
              <Field label="HM completion" value={q.data.hm_completion} />
              <Field label="Labour hrs" value={q.data.labour_hrs} />
              <Field label="Mileage km" value={q.data.mileage_km} />
              <Field label="Parts total" value={q.data.parts_total} />
              <Field label="Total amount" value={q.data.total_amount} />
              <Field label="Currency" value={q.data.currency} />
            </dl>
          </section>
        </>
      ) : null}
    </div>
  );
}
