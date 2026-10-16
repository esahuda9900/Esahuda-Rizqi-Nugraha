import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>SDLG Warranty</strong>
          <span className="muted small">v0.1 scaffold</span>
        </div>
        <nav>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/claims">Claims</NavLink>
          <NavLink to="/parse">Parse</NavLink>
        </nav>
        <div className="sidebar-foot">
          <p className="muted small">{user?.email}</p>
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
