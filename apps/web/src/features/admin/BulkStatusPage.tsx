import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchActiveClaims, updateClaimStatusRpc } from '@/lib/claimsApi';
import { StatusBadge } from '@/shared/StatusBadge';

const STATUSES = ['Draft', 'SDLG Audit', 'Paid', 'Rejected'] as const;

export function BulkStatusPage() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('SDLG Audit');
  const [reason, setReason] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ['claims', 'list', 'bulk'],
    queryFn: () => fetchActiveClaims(400),
    staleTime: 20_000,
  });

  const ids = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const mut = useMutation({
    mutationFn: async () => {
      const results: string[] = [];
      for (const claimId of ids) {
        try {
          await updateClaimStatusRpc({
            claimId,
            status,
            reason: reason.trim() || undefined,
          });
          results.push(`OK ${claimId}`);
        } catch (e) {
          results.push(`FAIL ${claimId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      setLog(results);
      setSelected({});
      await qc.invalidateQueries({ queryKey: ['claims'] });
    },
  });

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="page wide">
      <header className="page-header">
        <p className="eyebrow">M2 · Bulk</p>
        <h1>Bulk ubah status</h1>
        <p className="muted">Pilih klaim → RPC status satu per satu (aman, ada log per baris).</p>
      </header>

      <div className="toolbar">
        <label>
          Status target
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Alasan {status === 'Rejected' ? '(wajib)' : ''}
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={ids.length === 0 || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Memproses…' : `Terapkan ke ${ids.length} klaim`}
        </button>
      </div>

      {log.length > 0 ? (
        <div className="alert info">
          <pre className="mono small">{log.join('\n')}</pre>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th />
              <th>Claim</th>
              <th>Status</th>
              <th>Customer</th>
              <th>WO</th>
            </tr>
          </thead>
          <tbody>
            {(listQ.data || []).map((c) => (
              <tr key={c.claim_id}>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[c.claim_id])}
                    onChange={() => toggle(c.claim_id)}
                  />
                </td>
                <td>
                  <Link className="mono" to={`/claims/${encodeURIComponent(c.claim_id)}`}>
                    {c.claim_id}
                  </Link>
                </td>
                <td>
                  <StatusBadge status={c.claim_status} />
                </td>
                <td>{c.customer || '—'}</td>
                <td className="mono">{c.dealer_wo_so || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
