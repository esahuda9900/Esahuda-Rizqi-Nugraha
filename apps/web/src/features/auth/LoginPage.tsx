import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">PT. Indo Traktor Utama</p>
        <h1>SDLG Warranty</h1>
        <p className="muted">Masuk dengan akun Supabase admin.</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error ? <div className="alert error">{error}</div> : null}

        <button type="submit" disabled={submitting || loading}>
          {submitting ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
