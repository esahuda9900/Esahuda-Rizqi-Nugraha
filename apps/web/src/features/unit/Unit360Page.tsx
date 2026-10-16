import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { claimsForSerial, findMachineBySerial } from '@/lib/claimsApi';
import { StatusBadge } from '@/shared/StatusBadge';

export function Unit360Page() {
  const [input, setInput] = useState('');
  const [serial, setSerial] = useState('');

  const machineQ = useQuery({
    queryKey: ['unit', 'machine', serial],
    queryFn: () => findMachineBySerial(serial),
    enabled: Boolean(serial),
  });

  const claimsQ = useQuery({
    queryKey: ['unit', 'claims', serial],
    queryFn: () => claimsForSerial(serial),
    enabled: Boolean(serial),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSerial(input.trim());
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Unit 360</p>
        <h1>Riwayat unit</h1>
        <p className="muted">Cari serial → master machine + klaim terkait.</p>
      </header>

      <form className="toolbar" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Serial no (contoh VLGE… atau N0606362)"
        />
        <button type="submit">Cari</button>
      </form>

      {!serial ? <p className="muted">Masukkan serial untuk melihat 360°.</p> : null}

      {serial ? (
        <>
          <section className="panel">
            <h2 className="section-title">Master machine</h2>
            {machineQ.isLoading ? <p className="muted">Memuat…</p> : null}
            {machineQ.isError ? (
              <div className="alert error">{(machineQ.error as Error).message}</div>
            ) : null}
            {machineQ.data ? (
              <dl className="detail-grid">
                <div><dt>Serial</dt><dd className="mono">{machineQ.data.serial_no || '—'}</dd></div>
                <div><dt>Model</dt><dd>{machineQ.data.model || '—'}</dd></div>
                <div><dt>Customer</dt><dd>{machineQ.data.customer || '—'}</dd></div>
                <div><dt>Branch</dt><dd>{machineQ.data.branch || '—'}</dd></div>
                <div><dt>Sales</dt><dd className="mono">{machineQ.data.sales_date || '—'}</dd></div>
              </dl>
            ) : machineQ.isFetched ? (
              <p className="muted">Tidak ketemu di master machines (masih bisa ada klaim).</p>
            ) : null}
          </section>

          <section className="panel">
            <h2 className="section-title">Klaim untuk serial ini</h2>
            {claimsQ.isLoading ? <p className="muted">Memuat klaim…</p> : null}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Claim</th>
                    <th>Status</th>
                    <th>Fault</th>
                    <th>WO</th>
                    <th>Failure</th>
                  </tr>
                </thead>
                <tbody>
                  {(claimsQ.data || []).map((c) => (
                    <tr key={c.claim_id}>
                      <td>
                        <Link className="mono" to={`/claims/${encodeURIComponent(c.claim_id)}`}>
                          {c.claim_id}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={c.claim_status} />
                      </td>
                      <td>{c.fault_description || '—'}</td>
                      <td className="mono">{c.dealer_wo_so || '—'}</td>
                      <td className="mono">{c.failure_date || '—'}</td>
                    </tr>
                  ))}
                  {claimsQ.isFetched && (claimsQ.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        Tidak ada klaim aktif untuk serial ini.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
