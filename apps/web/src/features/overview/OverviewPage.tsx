import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  countActiveClaims,
  countMachines,
  fetchStatusBreakdown,
} from '@/lib/claimsApi';

export function OverviewPage() {
  const totalQ = useQuery({
    queryKey: ['claims', 'count-active'],
    queryFn: countActiveClaims,
    staleTime: 30_000,
  });
  const statusQ = useQuery({
    queryKey: ['claims', 'status-breakdown'],
    queryFn: fetchStatusBreakdown,
    staleTime: 30_000,
  });
  const machinesQ = useQuery({
    queryKey: ['machines', 'count'],
    queryFn: countMachines,
    staleTime: 60_000,
  });

  const statuses = statusQ.data || {};
  const paid = statuses['Paid'] || 0;
  const completed = statuses['Completed'] || 0;
  const audit = statuses['SDLG Audit'] || 0;
  const draft = statuses['Draft'] || 0;
  const rejected = statuses['Rejected'] || 0;
  const onHold = statuses['On Hold'] || 0;
  const ready = statuses['Ready to Claim'] || 0;
  const total = totalQ.data || 0;

  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Overview</h1>
          <p className="muted">Ringkasan live dari Supabase · parity monitoring web lama.</p>
        </div>
        <Link className="btn-link" to="/parse">
          + New Claim / Parse
        </Link>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card accent">
          <span className="kpi-label">Klaim aktif</span>
          <span className="kpi-value">{totalQ.isLoading ? '…' : total.toLocaleString('id-ID')}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Paid + Completed</span>
          <span className="kpi-value ok">
            {statusQ.isLoading ? '…' : (paid + completed).toLocaleString('id-ID')}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">SDLG Audit</span>
          <span className="kpi-value warn">{statusQ.isLoading ? '…' : audit.toLocaleString('id-ID')}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Draft + Ready</span>
          <span className="kpi-value">{statusQ.isLoading ? '…' : `${draft} / ${ready}`}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Rejected / On Hold</span>
          <span className="kpi-value">{statusQ.isLoading ? '…' : `${rejected} / ${onHold}`}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Machines (master)</span>
          <span className="kpi-value">
            {machinesQ.isLoading ? '…' : (machinesQ.data || 0).toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      <section className="panel">
        <h2 className="section-title">Status breakdown</h2>
        {statusQ.isError ? (
          <div className="alert error">{(statusQ.error as Error).message}</div>
        ) : (
          <div className="status-bars">
            {Object.entries(statuses)
              .sort((a, b) => b[1] - a[1])
              .map(([name, n]) => {
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={name} className="status-row">
                    <div className="status-row-top">
                      <span>{name}</span>
                      <span className="mono">
                        {n.toLocaleString('id-ID')} · {pct}%
                      </span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            {Object.keys(statuses).length === 0 && statusQ.isFetched ? (
              <p className="muted">Belum ada data status.</p>
            ) : null}
          </div>
        )}
      </section>

      <div className="quick-links">
        <Link to="/claims">Lihat semua claims →</Link>
        <Link to="/parse">Parse / New claim →</Link>
        <Link to="/unit">Unit 360 →</Link>
        <Link to="/quality">Data quality →</Link>
        <Link to="/admin">Admin Center →</Link>
      </div>
    </div>
  );
}
