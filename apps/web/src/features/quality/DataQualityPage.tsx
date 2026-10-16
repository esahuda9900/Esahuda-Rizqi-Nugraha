import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchActiveClaims } from '@/lib/claimsApi';

export function DataQualityPage() {
  const listQ = useQuery({
    queryKey: ['claims', 'list', 'dq'],
    queryFn: () => fetchActiveClaims(800),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const rows = listQ.data || [];
    let missingSerial = 0;
    let missingWo = 0;
    let missingFault = 0;
    let missingPart = 0;
    let missingCustomer = 0;
    for (const c of rows) {
      if (!c.serial_no) missingSerial += 1;
      if (!c.dealer_wo_so) missingWo += 1;
      if (!c.fault_description) missingFault += 1;
      if (!c.causing_part_no) missingPart += 1;
      if (!c.customer) missingCustomer += 1;
    }
    return {
      total: rows.length,
      missingSerial,
      missingWo,
      missingFault,
      missingPart,
      missingCustomer,
      samples: rows
        .filter((c) => !c.serial_no || !c.dealer_wo_so || !c.fault_description)
        .slice(0, 25),
    };
  }, [listQ.data]);

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Data Quality</p>
        <h1>Kelengkapan field klaim</h1>
        <p className="muted">Scan cepat klaim aktif (sample hingga 800 baris).</p>
      </header>

      {listQ.isLoading ? <p className="muted">Memuat…</p> : null}
      {listQ.isError ? (
        <div className="alert error">{(listQ.error as Error).message}</div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi-card"><span className="kpi-label">Sample</span><span className="kpi-value">{stats.total}</span></div>
        <div className="kpi-card"><span className="kpi-label">Tanpa serial</span><span className="kpi-value warn">{stats.missingSerial}</span></div>
        <div className="kpi-card"><span className="kpi-label">Tanpa WO</span><span className="kpi-value warn">{stats.missingWo}</span></div>
        <div className="kpi-card"><span className="kpi-label">Tanpa fault</span><span className="kpi-value warn">{stats.missingFault}</span></div>
        <div className="kpi-card"><span className="kpi-label">Tanpa part</span><span className="kpi-value">{stats.missingPart}</span></div>
        <div className="kpi-card"><span className="kpi-label">Tanpa customer</span><span className="kpi-value">{stats.missingCustomer}</span></div>
      </div>

      <section className="panel">
        <h2 className="section-title">Contoh yang perlu review</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Serial</th>
                <th>WO</th>
                <th>Fault</th>
              </tr>
            </thead>
            <tbody>
              {stats.samples.map((c) => (
                <tr key={c.claim_id}>
                  <td>
                    <Link className="mono" to={`/claims/${encodeURIComponent(c.claim_id)}`}>
                      {c.claim_id}
                    </Link>
                  </td>
                  <td className="mono">{c.serial_no || '—'}</td>
                  <td className="mono">{c.dealer_wo_so || '—'}</td>
                  <td>{c.fault_description || '—'}</td>
                </tr>
              ))}
              {!listQ.isLoading && stats.samples.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    Tidak ada gap kasar di sample ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
