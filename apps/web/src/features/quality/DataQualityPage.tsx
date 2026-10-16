import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchActiveClaims } from '@/lib/claimsApi';
import { normalizeWo } from '@/features/parse/woPolicy';

export function DataQualityPage() {
  const listQ = useQuery({
    queryKey: ['claims', 'list', 'dq'],
    queryFn: () => fetchActiveClaims(1000),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const rows = listQ.data || [];
    let missingSerial = 0;
    let missingWo = 0;
    let missingFault = 0;
    let missingPart = 0;
    let missingCustomer = 0;
    let missingModel = 0;
    let missingFailureDate = 0;
    const woMap = new Map<string, string[]>();

    for (const c of rows) {
      if (!c.serial_no) missingSerial += 1;
      if (!c.dealer_wo_so) missingWo += 1;
      if (!c.fault_description) missingFault += 1;
      if (!c.causing_part_no) missingPart += 1;
      if (!c.customer) missingCustomer += 1;
      if (!c.model) missingModel += 1;
      if (!c.failure_date) missingFailureDate += 1;
      const wo = normalizeWo(c.dealer_wo_so);
      if (wo) {
        const list = woMap.get(wo) || [];
        list.push(c.claim_id);
        woMap.set(wo, list);
      }
    }

    const dupWos = [...woMap.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([wo, ids]) => ({ wo, ids }))
      .slice(0, 30);

    return {
      total: rows.length,
      missingSerial,
      missingWo,
      missingFault,
      missingPart,
      missingCustomer,
      missingModel,
      missingFailureDate,
      dupWos,
      samples: rows
        .filter(
          (c) =>
            !c.serial_no || !c.dealer_wo_so || !c.fault_description || !c.model || !c.customer,
        )
        .slice(0, 30),
    };
  }, [listQ.data]);

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Data Quality</p>
        <h1>Kelengkapan & duplikat WO</h1>
        <p className="muted">Scan klaim aktif (hingga 1000). Duplikat WO = 1 WO lebih dari 1 klaim aktif.</p>
      </header>

      {listQ.isLoading ? <p className="muted">Memuat…</p> : null}
      {listQ.isError ? (
        <div className="alert error">{(listQ.error as Error).message}</div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Sample</span>
          <span className="kpi-value">{stats.total}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tanpa serial</span>
          <span className="kpi-value warn">{stats.missingSerial}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tanpa WO</span>
          <span className="kpi-value warn">{stats.missingWo}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tanpa fault</span>
          <span className="kpi-value warn">{stats.missingFault}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tanpa model</span>
          <span className="kpi-value">{stats.missingModel}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">WO duplikat</span>
          <span className="kpi-value warn">{stats.dupWos.length}</span>
        </div>
      </div>

      <section className="panel">
        <h2 className="section-title">WO dipakai lebih dari 1 klaim</h2>
        {stats.dupWos.length === 0 ? (
          <p className="muted">Tidak ada duplikat WO di sample (kecuali policy allowlist di parse).</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>WO</th>
                  <th>Claim IDs</th>
                </tr>
              </thead>
              <tbody>
                {stats.dupWos.map((d) => (
                  <tr key={d.wo}>
                    <td className="mono">{d.wo}</td>
                    <td>
                      {d.ids.map((id) => (
                        <span key={id}>
                          <Link className="mono" to={`/claims/${encodeURIComponent(id)}`}>
                            {id}
                          </Link>{' '}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">Contoh gap field</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Serial</th>
                <th>WO</th>
                <th>Model</th>
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
                  <td>{c.model || '—'}</td>
                  <td>{c.fault_description || '—'}</td>
                </tr>
              ))}
              {!listQ.isLoading && stats.samples.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
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
