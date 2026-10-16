import { useQuery } from '@tanstack/react-query';
import { countActiveClaims } from '@/lib/claimsApi';

export function OverviewPage() {
  const q = useQuery({
    queryKey: ['claims', 'count-active'],
    queryFn: countActiveClaims,
    staleTime: 30_000,
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>Overview</h1>
        <p className="muted">Hitungan langsung dari Supabase (active claims).</p>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Klaim aktif</span>
          <span className="kpi-value">
            {q.isLoading ? '…' : q.isError ? '—' : q.data?.toLocaleString('id-ID')}
          </span>
          {q.isError ? (
            <p className="alert error">{(q.error as Error).message}</p>
          ) : null}
        </div>
      </div>

      <p className="muted small">
        Phase 1 scaffold — chart & hierarchy Overview legacy belum di-port (PRD F2 minimal).
      </p>
    </div>
  );
}
