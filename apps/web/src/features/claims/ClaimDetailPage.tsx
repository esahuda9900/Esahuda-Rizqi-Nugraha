import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { fetchClaimById } from '@/lib/claimsApi';
import { dash, formatDateDisplay, formatMoney } from '@/lib/format';
import { StatusBadge } from '@/shared/StatusBadge';

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
  const d = formatDateDisplay(value);
  return <Field label={label} value={d || null} mono />;
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

export function ClaimDetailPage() {
  const { claimId = '' } = useParams();
  const id = decodeURIComponent(claimId);

  const q = useQuery({
    queryKey: ['claim', id],
    queryFn: () => fetchClaimById(id),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: 1,
  });

  const rows = partsRows(q.data?.parts);

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
              {q.data.archived_at ? <span className="muted small">Archived</span> : null}
            </div>
          ) : null}
        </div>
        <div className="header-actions">
          <Link className="btn-link ghost-link" to="/parse">
            Parse form
          </Link>
        </div>
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
            <h2 className="section-title">Status</h2>
            <dl className="detail-grid">
              <Field label="Claim status" value={q.data.claim_status} />
              <DateField label="Status date" value={q.data.status_date} />
              <Field label="Status reason" value={q.data.status_update_reason} />
              <Field label="Repair status" value={q.data.repair_status} />
            </dl>
            <p className="muted small">
              Ubah status (modal + alasan + RPC) = Fase 4 PLAN. Halaman ini read-only.
            </p>
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
              <p className="muted">Tidak ada baris parts (atau format tidak dikenali).</p>
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

          <p className="muted small">
            Detail selalu <code>fetchClaimById({id})</code> — fail closed, tanpa fallback list cache.
          </p>
        </>
      ) : null}
    </div>
  );
}
