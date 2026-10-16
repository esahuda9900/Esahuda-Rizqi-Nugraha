import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchActiveClaims } from '@/lib/claimsApi';

export function ClaimsListPage() {
  const q = useQuery({
    queryKey: ['claims', 'list'],
    queryFn: () => fetchActiveClaims(150),
    staleTime: 15_000,
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>Claims</h1>
        <p className="muted">List aktif · klik baris untuk detail by claim_id (PRD F3).</p>
      </header>

      {q.isLoading ? <p className="center-state">Memuat klaim…</p> : null}
      {q.isError ? (
        <div className="alert error">{(q.error as Error).message}</div>
      ) : null}

      {q.data ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Status</th>
                <th>Model</th>
                <th>Serial</th>
                <th>Customer</th>
                <th>WO</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.claim_id}>
                  <td>
                    <Link to={`/claims/${encodeURIComponent(c.claim_id)}`}>
                      {c.claim_id}
                    </Link>
                  </td>
                  <td>{c.claim_status || '—'}</td>
                  <td>{c.model || '—'}</td>
                  <td className="mono">{c.serial_no || '—'}</td>
                  <td>{c.customer || '—'}</td>
                  <td className="mono">{c.dealer_wo_so || '—'}</td>
                  <td>{c.branch || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
