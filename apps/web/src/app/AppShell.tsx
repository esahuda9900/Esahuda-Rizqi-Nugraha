import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

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
        </nav>
        <div className="sidebar-foot">
          <p className="muted small">{user?.email || 'Admin'}</p>
          <p className="muted small">Policy: DB Verified · Preview</p>
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
