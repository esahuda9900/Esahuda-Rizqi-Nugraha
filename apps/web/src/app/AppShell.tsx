import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { canAdminCenter, canExportClaims, fetchMyRole } from '@/lib/rolesApi';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/claims', label: 'Claims' },
  { to: '/parse', label: 'New Claim / Parse' },
  { to: '/masters', label: 'Master Data' },
  { to: '/unit', label: 'Unit 360' },
  { to: '/quality', label: 'Data Quality' },
] as const;

export function AppShell() {
  const { user, signOut } = useAuth();
  const roleQ = useQuery({
    queryKey: ['my-role', user?.id],
    queryFn: () => fetchMyRole(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const role = roleQ.data?.role;
  const showExport = canExportClaims(role);
  const showAdmin = canAdminCenter(role);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SDLG Warranty</strong>
            <span className="muted small">PT. Indo Traktor Utama</span>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false}>
              {item.label}
            </NavLink>
          ))}
          {showExport ? <NavLink to="/export">Export / Backup</NavLink> : null}
          {showAdmin ? <NavLink to="/admin">Admin Center</NavLink> : null}
        </nav>
        <div className="sidebar-foot">
          <p className="muted small">{user?.email || 'User'}</p>
          <p className="muted small">{role ? `role: ${role}` : 'Preview'}</p>
          <button type="button" className="ghost" onClick={() => void signOut()}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
