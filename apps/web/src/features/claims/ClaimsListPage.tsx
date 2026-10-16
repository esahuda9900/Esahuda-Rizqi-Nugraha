import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchActiveClaims } from '@/lib/claimsApi';
import { StatusBadge } from '@/shared/StatusBadge';

export function ClaimsListPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const listQ = useQuery({
    queryKey: ['claims', 'list'],
    queryFn: () => fetchActiveClaims(500),
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    const rows = listQ.data || [];
    const term = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (status !== 'all' && (c.claim_status || '') !== status) return false;
      if (!term) return true;
      const hay = [
        c.claim_id,
        c.serial_no,
        c.model,
        c.customer,
        c.branch,
        c.dealer_wo_so,
        c.fault_description,
        c.causing_part_no,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [listQ.data, q, status]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const c of listQ.data || []) if (c.claim_status) set.add(c.claim_status);
    return Array.from(set).sort();
  }, [listQ.data]);

  return (
    <div className="page wide">
      <header className="page-header row">
        <div>
          <p className="eyebrow">Claims</p>
          <h1>Daftar klaim</h1>
          <p className="muted">
            {listQ.isLoading
              ? 'Memuat…'
              : `${filtered.length.toLocaleString('id-ID')} ditampilkan` +
                (listQ.data ? ` dari ${listQ.data.length.toLocaleString('id-ID')}` : '')}
          </p>
        </div>
        <Link className="btn-link" to="/parse">
          + Parse / New
        </Link>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Cari claim id, serial, WO, customer, fault…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Semua status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {listQ.isError ? (
        <div className="alert error">{(listQ.error as Error).message}</div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Status</th>
              <th>Model</th>
              <th>Serial</th>
              <th>Customer</th>
              <th>WO</th>
              <th>Branch</th>
              <th>Failure</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.claim_id}>
                <td>
                  <Link to={`/claims/${encodeURIComponent(c.claim_id)}`} className="mono">
                    {c.claim_id}
                  </Link>
                </td>
                <td>
                  <StatusBadge status={c.claim_status} />
                </td>
                <td>{c.model || '—'}</td>
                <td className="mono">{c.serial_no || '—'}</td>
                <td>{c.customer || '—'}</td>
                <td className="mono">{c.dealer_wo_so || '—'}</td>
                <td>{c.branch || '—'}</td>
                <td className="mono">{c.failure_date || '—'}</td>
              </tr>
            ))}
            {!listQ.isLoading && filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">
                  Tidak ada klaim yang cocok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
