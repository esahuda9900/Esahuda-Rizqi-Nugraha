import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { canAdminCenter, canExportClaims, fetchMyRole } from '@/lib/rolesApi';
const NAV = [
  { to: '/', label: 'Overview', mark: '◫', end: true },
  { to: '/claims', label: 'Monitoring klaim', mark: '▤' },
  { to: '/parse', label: 'Input klaim', mark: '+' },
  { to: '/masters', label: 'Master data', mark: '▦' },
  { to: '/unit', label: 'Unit 360', mark: '◎' },
  { to: '/quality', label: 'Kualitas data', mark: '◇' },
] as const;
export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState(''), [leaving, setLeaving] = useState(false);
  const roleQ = useQuery({ queryKey: ['my-role', user?.id], queryFn: () => fetchMyRole(user!.id), enabled: Boolean(user?.id), staleTime: 60_000 });
  const role = roleQ.data?.role;
  async function logout() {
    setLeaving(true); setLogoutError('');
    try { await signOut(); } catch (e) { setLogoutError(e instanceof Error ? e.message : 'Gagal keluar. Coba lagi.'); } finally { setLeaving(false); }
  }
  return <div className="shell">
    <a className="skip-link" href="#main-content">Langsung ke konten</a>
    <aside className="sidebar"><div className="brand"><div className="brand-mark">S</div><div><strong>SDLG Warranty</strong><span className="muted small">OPERATIONS WORKSPACE</span></div></div><p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Navigasi utama">{NAV.map(item => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false}><span aria-hidden="true" className="nav-mark">{item.mark}</span>{item.label}</NavLink>)}{canExportClaims(role) ? <NavLink to="/export"><span className="nav-mark" aria-hidden="true">↓</span>Export / Backup</NavLink> : null}{canAdminCenter(role) ? <NavLink to="/admin"><span className="nav-mark" aria-hidden="true">⚙</span>Admin Center</NavLink> : null}</nav>
      <div className="sidebar-foot"><div className="account-avatar">{(user?.email || 'U').slice(0, 1).toUpperCase()}</div><p className="account-email">{user?.email}</p><p className="small muted">{roleQ.isPending ? 'Memeriksa akses…' : role || 'Role belum tersedia'}</p>{roleQ.isError ? <div className="alert error" role="alert">Hak akses belum dimuat. <button className="ghost" onClick={() => void roleQ.refetch()}>Coba lagi</button></div> : null}<button className="ghost" disabled={leaving} onClick={() => void logout()}>{leaving ? 'Keluar…' : 'Keluar akun ↗'}</button>{logoutError ? <p role="alert" className="alert error">{logoutError}</p> : null}</div>
    </aside><div className="workspace"><header className="workspace-bar"><span>PT. Indo Traktor Utama <span className="muted">/ {NAV.find(i => i.to === location.pathname)?.label || 'Warranty'}</span></span><span className="workspace-tag">PREVIEW WORKSPACE</span></header><main id="main-content" className="main" tabIndex={-1}><Outlet /></main></div>
  </div>;
}
