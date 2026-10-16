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
    setBusy('csv');
    setMsg(null);
    setErr(null);
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
    setBusy('json');
    setMsg(null);
    setErr(null);
    try {
      const r = await downloadFullBackupJson();
      const summary = Object.entries(r.counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
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
          Unduh data lewat RLS akun kamu. Role:{' '}
          <strong>{roleQ.isLoading ? '…' : role || 'tidak terdaftar di app_user_roles'}</strong>
        </p>
      </header>

      {roleQ.isError ? (
        <div className="alert error">Gagal baca role: {(roleQ.error as Error).message}</div>
      ) : null}

      {!roleQ.isLoading && !allowCsv ? (
        <div className="alert warn">
          Export klaim hanya untuk <code>admin</code> / <code>warranty_admin</code>. Role kamu tidak
          diizinkan (UI + diharapkan RLS juga membatasi write; export = read).
        </div>
      ) : null}

      <section className="panel">
        <h2 className="section-title">Export klaim (CSV)</h2>
        <p className="muted small">
          Kolom monitoring + finance ringkas. UTF-8 BOM supaya Excel Indonesia lebih ramah. Boleh
          dijalankan oleh admin &amp; warranty_admin.
        </p>
        <div className="btn-row">
          <button type="button" disabled={!allowCsv || busy !== null} onClick={() => void runCsv()}>
            {busy === 'csv' ? 'Menyiapkan…' : 'Download CSV klaim'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">Backup penuh (JSON)</h2>
        <p className="muted small">
          Satu file JSON bertanggal WIB: {BACKUP_TABLES.join(', ')}. Hanya <code>admin</code>. Bukan
          restore otomatis (PLAN: restore = RUNBOOK manual di M1).
        </p>
        <div className="btn-row">
          <button
            type="button"
            disabled={!allowBackup || busy !== null}
            onClick={() => void runBackup()}
          >
            {busy === 'json' ? 'Mengambil tabel…' : 'Download backup JSON'}
          </button>
        </div>
      </section>

      {msg ? <div className="alert info">{msg}</div> : null}
      {err ? <div className="alert error">{err}</div> : null}

      <section className="panel">
        <h2 className="section-title">Backup otomatis mingguan</h2>
        <p className="muted small">
          Workflow skeleton: <code>.github/workflows/weekly-db-backup.yml</code>. Butuh repo privat +
          secret <code>SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE</code> (atau anon + user
          token) — <strong>jangan</strong> taruh service_role di frontend. Aktifkan setelah staging
          secrets diisi pemilik.
        </p>
      </section>
    </div>
  );
}
