import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ConcurrentEditError,
  createClaimViaRpc,
  fetchActiveClaims,
  fetchClaimById,
  findMachineBySerial,
  updateClaimById,
  type ClaimListRow,
} from '@/lib/claimsApi';
import { omitEmptyFields, parsedToClaimRow } from './claimMapper';
import { excelFileToText } from './excelImport';
import { parseWarrantyText } from './parseWarrantyText';
import type { ParsedClaim } from './types';
import { classifyMatch, findMatchedClaim } from './woPolicy';
import { WoCollisionModal } from './WoCollisionModal';

type PendingAction = { type: 'new' | 'update'; matched: ClaimListRow | null } | null;

const EDIT_FIELDS = [
  ['dealerWoSo', 'WO'],
  ['model', 'Model'],
  ['serialNo', 'Serial'],
  ['customer', 'Customer'],
  ['branch', 'Branch'],
  ['indentNo', 'Indent'],
  ['faultDescription', 'Fault'],
  ['causeAnalyze', 'Cause'],
  ['causingPartNo', 'Part no'],
  ['causingPartDesc', 'Part desc'],
  ['salesDate', 'Sales date'],
  ['failureDate', 'Failure date'],
  ['dealerRepairDate', 'Repair date'],
  ['completionDate', 'Completion'],
  ['repairMethod', 'Repair method'],
  ['technicalPersonnel', 'Tech'],
  ['hmFailure', 'HM failure'],
  ['hmCompletion', 'HM completion'],
] as const;

export function ParsePage() {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<ParsedClaim | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const qc = useQueryClient();
  const navigate = useNavigate();

  const claimsQ = useQuery({
    queryKey: ['claims', 'list'],
    queryFn: () => fetchActiveClaims(800),
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

  async function enrichFromUnit(p: ParsedClaim): Promise<ParsedClaim> {
    if (!p.serialNo) return p;
    try {
      const m = await findMachineBySerial(p.serialNo);
      if (!m) return p;
      return {
        ...p,
        customer: p.customer || m.customer || '',
        model: p.model || m.model || '',
        branch: p.branch || m.branch || '',
        salesDate: p.salesDate || m.sales_date || '',
      };
    } catch {
      return p;
    }
  }

  async function runParse(sourceText?: string) {
    setError(null);
    setMessage(null);
    const text = sourceText ?? raw;
    let p = parseWarrantyText(text);
    p = await enrichFromUnit(p);
    setParsed(p);
    if (!p.model && !p.serialNo && !p.dealerWoSo) {
      setError('Parse tidak menemukan field inti (model/serial/WO). Cek format paste/Excel.');
    }
  }

  async function onExcel(file: File | null) {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const text = await excelFileToText(file);
      setRaw(text);
      await runParse(text);
      setMessage(`Excel diimpor: ${file.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal baca Excel');
    } finally {
      setImporting(false);
    }
  }

  function patchParsed(key: keyof ParsedClaim, value: string) {
    if (!parsed) return;
    setParsed({ ...parsed, [key]: value });
  }

  const saveMut = useMutation({
    mutationFn: async (opts: { mode: 'new' | 'update'; matched: ClaimListRow | null }) => {
      if (!parsed) throw new Error('Belum ada hasil parse');
      if (opts.mode === 'update') {
        if (!opts.matched) throw new Error('Tidak ada klaim untuk di-update');
        const live = await fetchClaimById(opts.matched.claim_id);
        const full = parsedToClaimRow(parsed, opts.matched.claim_id);
        const patch = omitEmptyFields(full);
        await updateClaimById(opts.matched.claim_id, patch, {
          expectedLastUpdated: live.last_updated,
        });
        return opts.matched.claim_id;
      }
      const row = parsedToClaimRow(parsed, 'TEMP');
      const { claim_id: _c, ...body } = row;
      return createClaimViaRpc({ ...body, claim_status: 'Draft' });
    },
    onSuccess: async (claimId) => {
      setMessage(`Tersimpan: ${claimId}`);
      setPending(null);
      await qc.invalidateQueries({ queryKey: ['claims'] });
      navigate(`/claims/${encodeURIComponent(claimId)}`);
    },
    onError: (err) => {
      if (err instanceof ConcurrentEditError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan');
      }
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
        <p className="eyebrow">SDLG Input</p>
        <h1>Parse → Simpan</h1>
        <p className="muted">
          Klaim baru lewat RPC <code>create_sdlg_claim</code>. Update aman (tidak timpa kosong +
          deteksi concurrent edit).
        </p>
      </header>

      <div className="parse-layout">
        <section className="parse-panel">
          <label className="file-label">
            Import Excel (.xlsx / .xls)
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={importing}
              onChange={(e) => void onExcel(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Source text
            <textarea
              rows={14}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Tempel isi form Technical Service Information (Warranty Claim)…"
            />
          </label>
          <div className="btn-row">
            <button type="button" onClick={() => void runParse()} disabled={!raw.trim() || importing}>
              {importing ? 'Import…' : 'Parse'}
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
          <h2 className="section-title">Hasil parse (bisa diedit)</h2>
          {!parsed ? (
            <p className="muted">Belum ada hasil. Paste/Import lalu Parse.</p>
          ) : (
            <>
              {matched ? (
                <div className={`alert ${matchKind === 'weak' ? 'warn' : 'info'}`}>
                  Cocok WO dengan klaim <strong className="mono">{matched.claim_id}</strong>
                  {matched.claim_status ? ` (${matched.claim_status})` : ''} — match{' '}
                  <strong>{matchKind}</strong>.
                </div>
              ) : null}

              <div className="edit-grid">
                {EDIT_FIELDS.map(([key, label]) => {
                  const val = String(parsed[key] ?? '');
                  const empty = !val.trim();
                  return (
                    <label key={key} className={empty ? 'field-empty' : undefined}>
                      {label}
                      {empty ? ' · kosong' : ''}
                      <input value={val} onChange={(e) => patchParsed(key, e.target.value)} />
                    </label>
                  );
                })}
              </div>

              <div className="btn-row">
                <button type="button" onClick={requestSaveNew} disabled={saveMut.isPending}>
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
          onConfirm={() => saveMut.mutate({ mode: pending.type, matched: pending.matched })}
        />
      ) : null}
    </div>
  );
}
