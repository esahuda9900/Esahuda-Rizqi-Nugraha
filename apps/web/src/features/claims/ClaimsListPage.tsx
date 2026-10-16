import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchClaims, type ClaimListRow } from '@/lib/claimsApi';
import { formatDateDisplay } from '@/lib/format';
import { StatusBadge } from '@/shared/StatusBadge';

type SortKey =
  | 'claim_id'
  | 'claim_status'
  | 'model'
  | 'serial_no'
  | 'customer'
  | 'dealer_wo_so'
  | 'branch'
  | 'failure_date'
  | 'last_updated';

const PAGE_SIZE = 50;

function cmp(a: string | null | undefined, b: string | null | undefined): number {
  return String(a || '').localeCompare(String(b || ''), 'id', { sensitivity: 'base', numeric: true });
}

export function ClaimsListPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('last_updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const listQ = useQuery({
    queryKey: ['claims', 'list', showArchived],
    queryFn: () => fetchClaims({ limit: 1000, includeArchived: showArchived }),
    staleTime: 15_000,
  });

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of listQ.data || []) {
      if (c.archived_at && !showArchived) continue;
      const s = c.claim_status || 'Unknown';
      map[s] = (map[s] || 0) + 1;
    }
    return map;
  }, [listQ.data, showArchived]);

  const filtered = useMemo(() => {
    const rows = listQ.data || [];
    const term = q.trim().toLowerCase();
    let out = rows.filter((c) => {
      if (!showArchived && c.archived_at) return false;
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

    out = [...out].sort((a, b) => {
      const av = a[sortKey as keyof ClaimListRow];
      const bv = b[sortKey as keyof ClaimListRow];
      const base = cmp(av as string, bv as string);
      return sortDir === 'asc' ? base : -base;
    });
    return out;
  }, [listQ.data, q, status, showArchived, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const statuses = useMemo(() => Object.keys(statusCounts).sort(), [statusCounts]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'last_updated' || key === 'failure_date' ? 'desc' : 'asc');
    }
    setPage(0);
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <th>
        <button type="button" className="th-sort" onClick={() => toggleSort(k)}>
          {label}
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    );
  }

  return (
    <div className="page wide">
      <header className="page-header row">
        <div>
          <p className="eyebrow">Claims · monitoring</p>
          <h1>Daftar klaim</h1>
          <p className="muted">
            {listQ.isLoading
              ? 'Memuat…'
              : `${filtered.length.toLocaleString('id-ID')} cocok` +
                (listQ.data ? ` · sample ${listQ.data.length.toLocaleString('id-ID')} baris` : '')}
          </p>
        </div>
        <Link className="btn-link" to="/parse">
          + Parse / New
        </Link>
      </header>

      <div className="chip-row">
        <button
          type="button"
          className={status === 'all' ? '' : 'ghost'}
          onClick={() => {
            setStatus('all');
            setPage(0);
          }}
        >
          Semua ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            className={status === s ? '' : 'ghost'}
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
          >
            {s} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Cari claim id, serial, WO, customer, model, fault…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <label className="check-inline">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              setPage(0);
            }}
          />
          Tampilkan archived
        </label>
      </div>

      {listQ.isError ? <div className="alert error">{(listQ.error as Error).message}</div> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh k="claim_id" label="Claim ID" />
              <SortTh k="claim_status" label="Status" />
              <SortTh k="model" label="Model" />
              <SortTh k="serial_no" label="Serial" />
              <SortTh k="customer" label="Customer" />
              <SortTh k="dealer_wo_so" label="WO" />
              <SortTh k="branch" label="Branch" />
              <SortTh k="failure_date" label="Failure" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => (
              <tr key={c.claim_id} className={c.archived_at ? 'row-archived' : undefined}>
                <td>
                  <Link to={`/claims/${encodeURIComponent(c.claim_id)}`} className="mono">
                    {c.claim_id}
                  </Link>
                  {c.archived_at ? <span className="muted small"> · arch</span> : null}
                </td>
                <td>
                  <StatusBadge status={c.claim_status} />
                </td>
                <td>{c.model || '—'}</td>
                <td className="mono">
                  {c.serial_no ? (
                    <Link to={`/unit?serial=${encodeURIComponent(c.serial_no)}`}>
                      {c.serial_no}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{c.customer || '—'}</td>
                <td className="mono">{c.dealer_wo_so || '—'}</td>
                <td>{c.branch || '—'}</td>
                <td className="mono">{formatDateDisplay(c.failure_date) || '—'}</td>
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

      {filtered.length > PAGE_SIZE ? (
        <div className="pager">
          <button
            type="button"
            className="ghost"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Prev
          </button>
          <span className="muted small">
            Halaman {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="ghost"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
