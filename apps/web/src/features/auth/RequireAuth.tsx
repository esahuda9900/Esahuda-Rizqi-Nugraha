import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { session, loading, error, retrySession } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="center-state">
        <p>Memeriksa sesi…</p>
      </div>
    );
  }

  if (error) return <div className="center-state" role="alert"><h1>Belum bisa membuka workspace</h1><p>{error}</p><button onClick={retrySession}>Coba lagi</button></div>;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
