import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  allocateNextClaimId,
  fetchActiveClaims,
  insertClaim,
  updateClaimById,
  type ClaimListRow,
} from '@/lib/claimsApi';
import { parsedToClaimRow } from './claimMapper';
import { parseWarrantyText } from './parseWarrantyText';
import type { ParsedClaim } from './types';
import { classifyMatch, findMatchedClaim } from './woPolicy';
import { WoCollisionModal } from './WoCollisionModal';

type PendingAction = { type: 'new' | 'update'; matched: ClaimListRow | null } | null;

export function ParsePage() {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<ParsedClaim | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();
  const navigate = useNavigate();

  const claimsQ = useQuery({
    queryKey: ['claims', 'list'],
    queryFn: () => fetchActiveClaims(500),
    staleTime: 20_000,
  });

  const matched = useMemo(() => {
    if (!parsed || !claimsQ.data) return null;
    return findMatchedClaim(claimsQ.data, parsed);
  }, [parsed, claimsQ.data]);

  const matchKind = useMemo(
    () => (parsed && matched ? classifyMatch(parsed, matched) : 'none'),
    [parsed, matched],
  );

  function runParse() {
    setError(null);
    setMessage(null);
    const p = parseWarrantyText(raw);
    setParsed(p);
    if (!p.model && !p.serialNo && !p.dealerWoSo) {
      setError('Parse tidak menemukan field inti (model/serial/WO). Cek format paste.');
    }
  }

  const saveMut = useMutation({
    mutationFn: async (opts: { mode: 'new' | 'update'; matched: ClaimListRow | null }) => {
      if (!parsed) throw new Error('Belum ada hasil parse');
      if (opts.mode === 'update') {
        if (!opts.matched) throw new Error('Tidak ada klaim untuk di-update');
        const row = parsedToClaimRow(parsed, opts.matched.claim_id);
        const { claim_id: _id, ...patch } = row;
        await updateClaimById(opts.matched.claim_id, patch);
        return opts.matched.claim_id;
      }
      const claimId = await allocateNextClaimId();
      const row = parsedToClaimRow(parsed, claimId);
      await insertClaim(row);
      return claimId;
    },
    onSuccess: async (claimId) => {
      setMessage(`Tersimpan: ${claimId}`);
      setPending(null);
      await qc.invalidateQueries({ queryKey: ['claims'] });
      navigate(`/claims/${encodeURIComponent(claimId)}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
      setPending(null);
    },
  });

  function requestSaveNew() {
    setError(null);
    if (!parsed) return;
    if (matched && matchKind !== 'none') {
      setPending({ type: 'new', matched });
      return;
    }
    saveMut.mutate({ mode: 'new', matched: null });
  }

  function requestUpdate() {
    setError(null);
    if (!parsed || !matched) return;
    setPending({ type: 'update', matched });
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Parse</h1>
        <p className="muted">Paste form warranty dari Excel → parse → simpan ke Supabase.</p>
      </header>

      <div className="parse-layout">
        <section className="parse-panel">
          <label>
            Source text
            <textarea
              rows={16}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Tempel isi form Technical Service Information (Warranty Claim) di sini…"
            />
          </label>
          <div className="btn-row">
            <button type="button" onClick={runParse} disabled={!raw.trim()}>
              Parse
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setRaw('');
                setParsed(null);
                setError(null);
                setMessage(null);
              }}
            >
              Hapus
            </button>
          </div>
        </section>

        <section className="parse-panel">
          <h2 className="section-title">Hasil parse</h2>
          {!parsed ? (
            <p className="muted">Belum ada hasil. Paste lalu klik Parse.</p>
          ) : (
            <>
              {matched ? (
                <div className={`alert ${matchKind === 'weak' ? 'warn' : 'info'}`}>
                  Cocok WO dengan klaim <strong className="mono">{matched.claim_id}</strong>
                  {matched.claim_status ? ` (${matched.claim_status})` : ''} — match{' '}
                  <strong>{matchKind}</strong>.
                </div>
              ) : null}

              <dl className="detail-grid compact">
                <div><dt>WO</dt><dd className="mono">{parsed.dealerWoSo || '—'}</dd></div>
                <div><dt>Model</dt><dd>{parsed.model || '—'}</dd></div>
                <div><dt>Serial</dt><dd className="mono">{parsed.serialNo || '—'}</dd></div>
                <div><dt>Customer</dt><dd>{parsed.customer || '—'}</dd></div>
                <div><dt>Fault</dt><dd>{parsed.faultDescription || '—'}</dd></div>
                <div><dt>Part</dt><dd className="mono">{parsed.causingPartNo || '—'}</dd></div>
                <div><dt>HM fail</dt><dd>{parsed.hmFailure ?? '—'}</dd></div>
                <div><dt>Labour hrs</dt><dd>{parsed.labourHrs ?? '—'}</dd></div>
                <div><dt>Sales</dt><dd>{parsed.salesDate || '—'}</dd></div>
                <div><dt>Failure</dt><dd>{parsed.failureDate || '—'}</dd></div>
                <div><dt>Parts total</dt><dd>{parsed.partsTotal ?? '—'}</dd></div>
                <div><dt>Total amount</dt><dd>{parsed.totalAmount ?? '—'}</dd></div>
              </dl>

              <div className="btn-row">
                <button
                  type="button"
                  onClick={requestSaveNew}
                  disabled={saveMut.isPending}
                >
                  Simpan sebagai Baru
                </button>
                {matched ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={requestUpdate}
                    disabled={saveMut.isPending}
                  >
                    Update {matched.claim_id}
                  </button>
                ) : null}
              </div>
            </>
          )}

          {error ? <div className="alert error">{error}</div> : null}
          {message ? <div className="alert info">{message}</div> : null}
          {saveMut.isPending ? <p className="muted">Menyimpan…</p> : null}
        </section>
      </div>

      {pending && pending.matched && parsed ? (
        <WoCollisionModal
          mode={pending.type}
          kind={matchKind === 'none' ? 'weak' : matchKind}
          parsed={parsed}
          matched={pending.matched}
          onCancel={() => setPending(null)}
          onConfirm={() =>
            saveMut.mutate({ mode: pending.type, matched: pending.matched })
          }
        />
      ) : null}
    </div>
  );
}
