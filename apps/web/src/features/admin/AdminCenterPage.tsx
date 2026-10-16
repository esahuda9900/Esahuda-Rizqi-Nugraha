import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  countActiveClaims,
  fetchRecentStatusHistory,
  fetchStatusBreakdown,
} from '@/lib/claimsApi';
import { canAdminCenter, fetchAllRoles, fetchMyRole } from '@/lib/rolesApi';
import { formatDateDisplay } from '@/lib/format';
import { StatusBadge } from '@/shared/StatusBadge';

export function AdminCenterPage() {
  const { user } = useAuth();
  const roleQ = useQuery({
    queryKey: ['my-role', user?.id],
    queryFn: () => fetchMyRole(user!.id),
    enabled: Boolean(user?.id),
  });
  const allow = canAdminCenter(roleQ.data?.role);

  const rolesQ = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: fetchAllRoles,
    enabled: allow,
    staleTime: 30_000,
  });
  const countQ = useQuery({
    queryKey: ['claims', 'count-active'],
    queryFn: countActiveClaims,
    enabled: allow,
    staleTime: 30_000,
  });
  const statusQ = useQuery({
    queryKey: ['claims', 'status-breakdown'],
    queryFn: fetchStatusBreakdown,
    enabled: allow,
    staleTime: 30_000,
  });
  const auditQ = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => fetchRecentStatusHistory(30),
    enabled: allow,
    staleTime: 20_000,
  });

  if (roleQ.isLoading) return <p className="muted page">Memuat role…</p>;
  if (!allow) {
    return (
      <div className="page">
        <div className="alert warn">Admin Center hanya untuk admin / warranty_admin.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Fase 5 · Admin</p>
        <h1>Admin Center</h1>
        <p className="muted">Roles · audit status · shortcut. Web lama tidak disentuh. Cutover dilarang.</p>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card accent">
          <span className="kpi-label">Klaim aktif</span>
          <span className="kpi-value">
            {countQ.isLoading ? '…' : (countQ.data || 0).toLocaleString('id-ID')}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">User roles</span>
          <span className="kpi-value">{rolesQ.isLoading ? '…' : (rolesQ.data || []).length}</span>
        </div>
      </div>

      <div className="quick-links">
        <Link to="/admin/bulk-status">Bulk ubah status →</Link>
        <Link to="/export">Export / Backup →</Link>
        <Link to="/quality">Data Quality →</Link>
        <Link to="/claims">Claims →</Link>
      </div>

      <section className="panel">
        <h2 className="section-title">Status snapshot</h2>
        <ul className="plain-list">
          {Object.entries(statusQ.data || {})
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <li key={k}>
                {k}: <strong>{v}</strong>
              </li>
            ))}
        </ul>
      </section>

      <section className="panel">
        <h2 className="section-title">Audit status terbaru</h2>
        {auditQ.isError ? (
          <div className="alert error">{(auditQ.error as Error).message}</div>
        ) : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Status</th>
                <th>Date</th>
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {(auditQ.data || []).map((h) => (
                <tr key={h.id}>
                  <td>
                    <Link className="mono" to={`/claims/${encodeURIComponent(h.claim_id)}`}>
                      {h.claim_id}
                    </Link>
                  </td>
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
      </section>

      <section className="panel">
        <h2 className="section-title">Users & roles (read-only)</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Display</th>
                <th>Role</th>
                <th>Active</th>
                <th>User id</th>
              </tr>
            </thead>
            <tbody>
              {(rolesQ.data || []).map((r) => (
                <tr key={r.user_id}>
                  <td>{r.display_name || '—'}</td>
                  <td>
                    <code>{r.role}</code>
                  </td>
                  <td>{r.is_active === false ? 'No' : 'Yes'}</td>
                  <td className="mono small">{r.user_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
