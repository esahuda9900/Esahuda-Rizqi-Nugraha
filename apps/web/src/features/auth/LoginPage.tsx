import { FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
export function LoginPage() {
  const { session, loading, signIn, error: sessionError, retrySession } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false), [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = (location.state as { from?: string } | null)?.from;
  const destination = requested?.startsWith('/') && !requested.startsWith('//') && requested !== '/login' ? requested : '/';
  if (!loading && session) return <Navigate to={destination} replace />;
  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try { await signIn(email.trim(), password); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login gagal. Coba lagi.'); }
    finally { setSubmitting(false); }
  }
  return <main className="login-page">
    <section className="login-story" aria-label="Warranty workspace">
      <div className="brand"><div className="brand-mark">S</div><strong>SDLG / WARRANTY</strong></div>
      <div><p className="eyebrow">PT. INDO TRAKTOR UTAMA</p><h1>Setiap klaim.<br />Lebih terkendali.</h1><p className="login-description">Dari laporan kerusakan sampai settlement. Satu workspace untuk memantau dan menindaklanjuti warranty.</p></div>
      <div className="login-steps"><span>01 / Monitor</span><span>02 / Follow up</span><span>03 / Resolve</span></div>
    </section>
    <section className="login-form-area"><form className="login-card" onSubmit={onSubmit}>
      <p className="eyebrow">WARRANTY OPERATIONS</p><h2>Selamat datang kembali.</h2><p className="muted">Masuk dengan akun kerja yang sudah terdaftar.</p>
      <label>Email perusahaan<input type="email" autoComplete="username" placeholder="nama@perusahaan.com" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" className="ghost" aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></div></label>
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      {sessionError ? <div className="alert error" role="alert">{sessionError} <button type="button" className="ghost" onClick={retrySession}>Periksa sesi lagi</button></div> : null}
      <button type="submit" disabled={submitting || loading}>{loading ? 'Memeriksa sesi…' : submitting ? 'Menghubungkan…' : 'Masuk ke workspace →'}</button>
      <p className="small muted">Butuh akses? Hubungi administrator warranty perusahaan.</p>
    </form><p className="login-footer">SDLG WARRANTY · INTERNAL OPERATIONS</p></section>
  </main>;
}
