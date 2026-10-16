import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { countActiveClaims, fetchStatusBreakdown } from '@/lib/claimsApi';
import { canAdminCenter, fetchAllRoles, fetchMyRole } from '@/lib/rolesApi';

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
        <p className="muted">User & role · ringkasan data. Tanpa ubah schema. Web lama tidak disentuh.</p>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card accent">
          <span className="kpi-label">Klaim aktif</span>
          <span className="kpi-value">{countQ.isLoading ? '…' : (countQ.data || 0).toLocaleString('id-ID')}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">User role rows</span>
          <span className="kpi-value">{rolesQ.isLoading ? '…' : (rolesQ.data || []).length}</span>
        </div>
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
        <p className="muted small">
          <Link to="/claims">Buka daftar klaim</Link> · <Link to="/export">Export / Backup</Link> ·{' '}
          <Link to="/quality">Data Quality</Link>
        </p>
      </section>

      <section className="panel">
        <h2 className="section-title">Users & roles (read-only v1)</h2>
        {rolesQ.isError ? (
          <div className="alert error">{(rolesQ.error as Error).message}</div>
        ) : null}
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
        <p className="muted small">Ubah role via Supabase Dashboard di M1; form edit role = iterasi berikutnya.</p>
      </section>
    </div>
  );
}
