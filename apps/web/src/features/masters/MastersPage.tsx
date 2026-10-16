import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { countMachines, searchMachines } from '@/lib/claimsApi';

export function MastersPage() {
  const [q, setQ] = useState('');
  const countQ = useQuery({ queryKey: ['machines', 'count'], queryFn: countMachines, staleTime: 60_000 });
  const listQ = useQuery({
    queryKey: ['machines', 'search', q],
    queryFn: () => searchMachines(q, 50),
    staleTime: 15_000,
  });

  return (
    <div className="page wide">
      <header className="page-header">
        <p className="eyebrow">Master Data</p>
        <h1>Machines</h1>
        <p className="muted">
          {countQ.isLoading ? '…' : `${(countQ.data || 0).toLocaleString('id-ID')} unit di master`}
        </p>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Cari serial / model / customer / branch…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {listQ.isError ? (
        <div className="alert error">{(listQ.error as Error).message}</div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Model</th>
              <th>Customer</th>
              <th>Branch</th>
              <th>Sales</th>
            </tr>
          </thead>
          <tbody>
            {(listQ.data || []).map((m, i) => (
              <tr key={`${m.serial_no}-${i}`}>
                <td className="mono">{m.serial_no || '—'}</td>
                <td>{m.model || '—'}</td>
                <td>{m.customer || '—'}</td>
                <td>{m.branch || '—'}</td>
                <td className="mono">{m.sales_date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">v0.2 — master customer/branch terpisah menyusul; machines dulu sebagai unit lookup.</p>
    </div>
  );
}
