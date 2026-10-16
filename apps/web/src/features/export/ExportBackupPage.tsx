import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { downloadClaimsCsv, downloadFullBackupJson, BACKUP_TABLES } from '@/lib/exportApi';
import { canExportClaims, canFullBackup, fetchMyRole } from '@/lib/rolesApi';

export function ExportBackupPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const roleQ = useQuery({
    queryKey: ['my-role', user?.id],
    queryFn: () => fetchMyRole(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const role = roleQ.data?.role ?? null;
  const allowCsv = canExportClaims(role);
  const allowBackup = canFullBackup(role);

  async function runCsv() {
    setBusy('csv'); setMsg(null); setErr(null);
    try {
      const r = await downloadClaimsCsv();
      setMsg(`CSV siap: ${r.filename} (${r.rows.toLocaleString('id-ID')} baris).`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runBackup() {
    setBusy('json'); setMsg(null); setErr(null);
    try {
      const r = await downloadFullBackupJson();
      const summary = Object.entries(r.counts).map(([k, v]) => `${k}=${v}`).join(', ');
      setMsg(`Backup JSON: ${r.filename}. Counts: ${summary}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Fase 3 · Export & backup</p>
        <h1>Export + Backup</h1>
        <p className="muted">
          Role: <strong>{roleQ.isLoading ? '…' : role || 'tidak terdaftar'}</strong>
        </p>
      </header>
      {!roleQ.isLoading && !allowCsv ? (
        <div className="alert warn">Export hanya admin / warranty_admin.</div>
      ) : null}
      <section className="panel">
        <h2 className="section-title">Export klaim (CSV)</h2>
        <div className="btn-row">
          <button type="button" disabled={!allowCsv || busy !== null} onClick={() => void runCsv()}>
            {busy === 'csv' ? 'Menyiapkan…' : 'Download CSV klaim'}
          </button>
        </div>
      </section>
      <section className="panel">
        <h2 className="section-title">Backup penuh (JSON)</h2>
        <p className="muted small">Tabel: {BACKUP_TABLES.join(', ')}. Hanya admin.</p>
        <div className="btn-row">
          <button type="button" disabled={!allowBackup || busy !== null} onClick={() => void runBackup()}>
            {busy === 'json' ? 'Mengambil tabel…' : 'Download backup JSON'}
          </button>
        </div>
      </section>
      {msg ? <div className="alert info">{msg}</div> : null}
      {err ? <div className="alert error">{err}</div> : null}
    </div>
  );
}
