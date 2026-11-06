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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
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
      const serialClean = String(c.serial_no || '').replace(/[^a-zA-Z0-9]/g, '');
      const serialSuffixes = [6, 7, 8].map(len => serialClean.length >= len ? serialClean.slice(-len) : '').filter(Boolean);
      const claimMatch = String(c.claim_id || '').match(/^(\d+)-(\d{4})-SDLG-PFR$/i);
      const claimNums = claimMatch ? [claimMatch[1], claimMatch[1].replace(/^0+/, ''), `pfr${claimMatch[1]}`, `pfr${claimMatch[1].replace(/^0+/, '')}`] : [];
      const woDigits = String(c.dealer_wo_so || '').replace(/[^0-9]/g, '');

      const hay = [
        c.claim_id,
        ...claimNums,
        c.serial_no,
        serialClean,
        ...serialSuffixes,
        c.model,
        c.customer,
        c.branch,
        c.dealer_wo_so,
        woDigits,
        c.fault_description,
        c.causing_part_no,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const tokens = term.split(/\s+/).filter(Boolean);
      return tokens.every(tok => hay.includes(tok));
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
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === 'cards' ? 'active' : ''}
            onClick={() => setViewMode('cards')}
            title="Card view"
          >
            Cards
          </button>
          <button
            type="button"
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
            title="Table view"
          >
            Table
          </button>
        </div>
      </div>

      {listQ.isError ? <div className="alert error">{(listQ.error as Error).message}</div> : null}

      {viewMode === 'cards' ? (
        <div className="claims-cards-grid">
          {pageRows.map((c) => (
            <Link
              key={c.claim_id}
              to={`/claims/${encodeURIComponent(c.claim_id)}`}
              className={`claim-card ${c.archived_at ? 'row-archived' : ''}`}
            >
              <div className="claim-card-main">
                <div className="claim-card-top">
                  <span className="mono" style={{ fontWeight: 750, fontSize: '12px' }}>
                    {c.claim_id}
                  </span>
                  <StatusBadge status={c.claim_status} />
                  {c.branch ? <span className="pill small">{c.branch}</span> : null}
                  {c.archived_at ? <span className="muted small">· archived</span> : null}
                </div>
                <div className="claim-card-title">
                  {c.model || 'Unknown Model'}
                  {c.serial_no ? (
                    <span className="muted" style={{ fontWeight: 500, fontSize: '13px', marginLeft: 6 }}>
                      · SN {c.serial_no}
                    </span>
                  ) : null}
                </div>
                <div className="claim-card-sub">
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{c.customer || '—'}</span>
                  {c.dealer_wo_so ? ` — WO: ${c.dealer_wo_so}` : ''}
                </div>
              </div>
              <div className="claim-card-meta">
                <span className="claim-card-date">
                  {formatDateDisplay(c.failure_date) || formatDateDisplay(c.last_updated) || '—'}
                </span>
                <span className="claim-row-arrow" style={{ fontSize: '18px', color: '#94a3b8' }}>
                  ›
                </span>
              </div>
            </Link>
          ))}
          {!listQ.isLoading && filtered.length === 0 ? (
            <div className="panel empty-cell" style={{ textAlign: 'center', padding: '32px' }}>
              Tidak ada klaim yang cocok.
            </div>
          ) : null}
        </div>
      ) : (
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
      )}

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
