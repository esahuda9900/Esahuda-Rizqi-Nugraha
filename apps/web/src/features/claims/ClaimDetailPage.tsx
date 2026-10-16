import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { fetchClaimById } from '@/lib/claimsApi';

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

  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <Link to="/claims" className="back-link">
            ← Claims
          </Link>
          <h1 className="mono">{id || '—'}</h1>
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
        <dl className="detail-grid">
          <div><dt>Status</dt><dd>{q.data.claim_status || '—'}</dd></div>
          <div><dt>Model</dt><dd>{q.data.model || '—'}</dd></div>
          <div><dt>Serial</dt><dd className="mono">{q.data.serial_no || '—'}</dd></div>
          <div><dt>Customer</dt><dd>{q.data.customer || '—'}</dd></div>
          <div><dt>Branch</dt><dd>{q.data.branch || '—'}</dd></div>
          <div><dt>WO</dt><dd className="mono">{q.data.dealer_wo_so || '—'}</dd></div>
          <div><dt>Fault</dt><dd>{q.data.fault_description || '—'}</dd></div>
          <div><dt>Part</dt><dd className="mono">{q.data.causing_part_no || '—'}</dd></div>
          <div><dt>Part desc</dt><dd>{q.data.causing_part_desc || '—'}</dd></div>
          <div><dt>HM failure</dt><dd>{q.data.hm_failure ?? '—'}</dd></div>
          <div><dt>Repair method</dt><dd>{q.data.repair_method || '—'}</dd></div>
          <div><dt>Tech</dt><dd>{q.data.technical_personnel || '—'}</dd></div>
        </dl>
      ) : null}

      <p className="muted small">
        Detail selalu <code>fetchClaimById</code> — tanpa fallback list cache.
      </p>
    </div>
  );
}
