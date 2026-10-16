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
import { baseCustomerName, sameCustomerKey } from '@/lib/identity';
import { omitEmptyFields, parsedToClaimRow } from './claimMapper';
import { excelFileToText } from './excelImport';
import { parseWarrantyText } from './parseWarrantyText';
import type { ParsedClaim } from './types';
import {
  applyNewClaimWoPolicy,
  classifyMatch,
  findMatchedClaim,
  isStrictWoMatch,
} from './woPolicy';
import { WoCollisionModal } from './WoCollisionModal';

type PendingAction = { type: 'new' | 'update'; matched: ClaimListRow | null } | null;

const EDIT_FIELDS = [
  ['dealerWoSo', 'WO'],
  ['model', 'Model'],
  ['serialNo', 'Serial'],
  ['customer', 'Customer'],
  ['branch', 'Branch'],
  ['indentNo', 'Indent'],
  ['distributor', 'Distributor'],
  ['dealerCode', 'Dealer code'],
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
  ['labourHrs', 'Labour hrs'],
  ['mileageToSite', 'Mileage to site'],
  ['partsTotal', 'Parts total'],
  ['totalAmount', 'Total amount'],
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

  const sourceLock = useMemo(() => {
    if (!parsed || !matched) return null;
    const src = parsed.customer;
    const db = matched.customer;
    if (!src || !db) return null;
    if (String(src).trim() === String(db).trim()) return null;
    if (sameCustomerKey(src, db)) {
      return {
        level: 'soft' as const,
        text: `SOURCE LOCK soft: customer teks beda tapi key sama (“${src}” ≈ “${db}” → ${baseCustomerName(src)}). Aman untuk update.`,
      };
    }
    return {
      level: 'hard' as const,
      text: `SOURCE LOCK hard: customer parse “${src}” ≠ DB “${db}” (key ${baseCustomerName(src)} vs ${baseCustomerName(db)}). Update diblokir — review manual atau Simpan Baru.`,
    };
  }, [parsed, matched]);

  const willClearWoOnNew = useMemo(() => {
    if (!parsed || !matched) return false;
    if (!isStrictWoMatch(parsed, matched)) return false;
    const after = applyNewClaimWoPolicy(parsed, matched);
    return !after.dealerWoSo && Boolean(parsed.dealerWoSo);
  }, [parsed, matched]);

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
    const numKeys: (keyof ParsedClaim)[] = [
      'hmFailure',
      'hmCompletion',
      'labourHrs',
      'mileageKm',
      'mileageToSite',
      'partsTotal',
      'totalAmount',
    ];
    if (numKeys.includes(key)) {
      const n = value.trim() === '' ? null : Number(String(value).replace(/,/g, ''));
      setParsed({ ...parsed, [key]: Number.isFinite(n as number) ? n : null } as ParsedClaim);
      return;
    }
    setParsed({ ...parsed, [key]: value });
  }

  const saveMut = useMutation({
    mutationFn: async (opts: { mode: 'new' | 'update'; matched: ClaimListRow | null }) => {
      if (!parsed) throw new Error('Belum ada hasil parse');

      if (opts.mode === 'update') {
        if (!opts.matched) throw new Error('Tidak ada klaim untuk di-update');
        if (sourceLock?.level === 'hard') {
          throw new Error(sourceLock.text);
        }
        const live = await fetchClaimById(opts.matched.claim_id);
        const full = parsedToClaimRow(parsed, opts.matched.claim_id);
        const patch = omitEmptyFields(full);
        await updateClaimById(opts.matched.claim_id, patch, {
          expectedLastUpdated: live.last_updated,
        });
        return opts.matched.claim_id;
      }

      const forCreate = applyNewClaimWoPolicy(parsed, opts.matched);
      const row = parsedToClaimRow(forCreate, 'TEMP');
      const { claim_id: _c, ...body } = row;
      return createClaimViaRpc({ ...body, claim_status: 'Draft' });
    },
    onSuccess: async (claimId, vars) => {
      const cleared =
        vars.mode === 'new' &&
        vars.matched &&
        parsed &&
        applyNewClaimWoPolicy(parsed, vars.matched).dealerWoSo === '' &&
        Boolean(parsed.dealerWoSo);
      setMessage(
        cleared
          ? `Tersimpan: ${claimId} (WO dikosongkan karena collision — isi manual jika perlu)`
          : `Tersimpan: ${claimId}`,
      );
      setPending(null);
      await qc.invalidateQueries({ queryKey: ['claims'] });
      navigate(`/claims/${encodeURIComponent(claimId)}`);
    },
    onError: (err) => {
      if (err instanceof ConcurrentEditError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Gagal menyimpan');
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
    if (sourceLock?.level === 'hard') {
      setError(sourceLock.text);
      return;
    }
    setPending({ type: 'update', matched });
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">SDLG Input</p>
        <h1>Parse → Simpan</h1>
        <p className="muted">
          Parity legacy: clear WO on Simpan Baru collision · SOURCE LOCK hard block · RPC create ·
          omit empty on update.
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
              placeholder="Tempel form Technical Service Information…"
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
            <p className="muted">Belum ada hasil.</p>
          ) : (
            <>
              {matched ? (
                <div className={`alert ${matchKind === 'weak' ? 'warn' : 'info'}`}>
                  Cocok WO <strong className="mono">{matched.claim_id}</strong> — match{' '}
                  <strong>{matchKind}</strong>
                  {willClearWoOnNew ? (
                    <>
                      {' '}
                      · <strong>Simpan Baru akan mengosongkan WO</strong>
                    </>
                  ) : null}
                </div>
              ) : null}
              {sourceLock ? (
                <div className={`alert ${sourceLock.level === 'hard' ? 'error' : 'warn'}`}>
                  {sourceLock.text}
                </div>
              ) : null}

              <div className="edit-grid">
                {EDIT_FIELDS.map(([key, label]) => {
                  const val = String(parsed[key] ?? '');
                  const empty = !val.trim();
                  return (
                    <label key={key} className={empty ? 'field-empty' : undefined}>
                      {label}
                      {empty ? ' · —' : ''}
                      <input value={val} onChange={(e) => patchParsed(key, e.target.value)} />
                    </label>
                  );
                })}
              </div>

              <div className="btn-row parse-actions">
                <button type="button" onClick={requestSaveNew} disabled={saveMut.isPending}>
                  Simpan sebagai Baru
                </button>
                {matched ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={requestUpdate}
                    disabled={saveMut.isPending || sourceLock?.level === 'hard'}
                  >
                    Update {matched.claim_id}
                  </button>
                ) : null}
              </div>
            </>
          )}

          {error ? <div className="alert error">{error}</div> : null}
          {message ? <div className="alert info">{message}</div> : null}
        </section>
      </div>

      {pending && pending.matched && parsed ? (
        <WoCollisionModal
          mode={pending.type}
          kind={matchKind === 'none' ? 'weak' : matchKind}
          parsed={parsed}
          matched={pending.matched}
          willClearWo={pending.type === 'new' && willClearWoOnNew}
          onCancel={() => setPending(null)}
          onConfirm={() => saveMut.mutate({ mode: pending.type, matched: pending.matched })}
        />
      ) : null}
    </div>
  );
}
