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
  type MachineRow,
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

/** Short text inputs */
const EDIT_FIELDS = [
  ['dealerWoSo', 'WO'],
  ['distributorNo', 'Distributor no'],
  ['appCode', 'App code'],
  ['model', 'Model'],
  ['serialNo', 'Serial'],
  ['indentNo', 'Indent'],
  ['customer', 'Customer'],
  ['branch', 'Branch'],
  ['distributor', 'Distributor'],
  ['dealerName', 'Dealer name'],
  ['dealerCode', 'Dealer code'],
  ['dealerClaimNo', 'Dealer claim no'],
  ['dealerClaimDate', 'Dealer claim date'],
  ['salesDate', 'Sales date'],
  ['failureDate', 'Failure date'],
  ['dealerRepairDate', 'Repair date'],
  ['completionDate', 'Completion'],
  ['causingPartNo', 'Part no'],
  ['causingPartDesc', 'Part desc'],
  ['failurePartLocation', 'Part location'],
  ['engineSerialNo', 'Engine SN'],
  ['repairMethod', 'Repair method'],
  ['technicalPersonnel', 'Tech'],
  ['hmFailure', 'HM failure'],
  ['hmCompletion', 'HM completion'],
  ['labourHrs', 'Labour hrs'],
  ['mileageKm', 'Mileage km'],
  ['mileageToSite', 'Mileage to site'],
  ['partsTotal', 'Parts total'],
  ['totalAmount', 'Total amount'],
] as const;

const TEXT_AREAS = [
  ['faultDescription', 'Fault'],
  ['causeAnalyze', 'Cause'],
  ['comment', 'Comment'],
] as const;

const NUM_KEYS: (keyof ParsedClaim)[] = [
  'hmFailure',
  'hmCompletion',
  'labourHrs',
  'labourAmount',
  'mileageKm',
  'mileageAmount',
  'mileageToSite',
  'otherAmount',
  'partsTotal',
  'totalAmount',
];

/** Prefer longer/canonical serial & model from machines (legacy master match). */
function mergeMachine(p: ParsedClaim, m: MachineRow): ParsedClaim {
  const out = { ...p };
  const srcSerial = (p.serialNo || '').toUpperCase();
  const dbSerial = (m.serial_no || '').toUpperCase();
  if (dbSerial && (!srcSerial || dbSerial.includes(srcSerial) || dbSerial.length > srcSerial.length)) {
    out.serialNo = m.serial_no || p.serialNo;
  }
  if (m.model) {
    const srcModel = (p.model || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const dbModel = m.model.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!srcModel || dbModel.startsWith(srcModel) || dbModel.includes(srcModel)) {
      out.model = m.model;
    }
  }
  if (!out.customer && m.customer) out.customer = m.customer;
  if (!out.branch && m.branch) out.branch = m.branch;
  else if (m.branch && !out.branch) out.branch = m.branch;
  if (m.branch) out.branch = out.branch || m.branch;
  if (!out.salesDate && m.sales_date) out.salesDate = m.sales_date;
  return out;
}

export function ParsePage() {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<ParsedClaim | null>(null);
  const [masterHit, setMasterHit] = useState<MachineRow | null>(null);
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

  async function enrichFromUnit(p: ParsedClaim): Promise<{ parsed: ParsedClaim; machine: MachineRow | null }> {
    if (!p.serialNo) return { parsed: p, machine: null };
    try {
      const m = await findMachineBySerial(p.serialNo);
      if (!m) return { parsed: p, machine: null };
      return { parsed: mergeMachine(p, m), machine: m };
    } catch {
      return { parsed: p, machine: null };
    }
  }

  async function runParse(sourceText?: string) {
    setError(null);
    setMessage(null);
    setMasterHit(null);
    const text = sourceText ?? raw;
    let p = parseWarrantyText(text);
    const enriched = await enrichFromUnit(p);
    p = enriched.parsed;
    setMasterHit(enriched.machine);
    setParsed(p);
    if (!p.model && !p.serialNo && !p.dealerWoSo) {
      setError('Parse tidak menemukan field inti (model/serial/WO). Cek format paste/Excel.');
    } else if (enriched.machine) {
      setMessage(
        `Master match: ${enriched.machine.serial_no || '—'} · ${enriched.machine.model || '—'} · ${enriched.machine.branch || '—'}`,
      );
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
      setMessage((prev) => `Excel diimpor: ${file.name}${prev ? ` · ${prev}` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal baca Excel');
    } finally {
      setImporting(false);
    }
  }

  function patchParsed(key: keyof ParsedClaim, value: string) {
    if (!parsed) return;
    if (NUM_KEYS.includes(key)) {
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
        if (sourceLock?.level === 'hard') throw new Error(sourceLock.text);
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
          Parity web lama: parts table · labour/mileage · master serial/model/branch · clear WO on
          collision · SOURCE LOCK.
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
              rows={16}
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
                setMasterHit(null);
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
              {masterHit ? (
                <div className="alert info">
                  <strong>Master match</strong> · SN{' '}
                  <span className="mono">{masterHit.serial_no || '—'}</span> ·{' '}
                  {masterHit.model || '—'} · {masterHit.branch || '—'} ·{' '}
                  {masterHit.customer || '—'}
                </div>
              ) : null}
              {matched ? (
                <div className={`alert ${matchKind === 'weak' ? 'warn' : 'info'}`}>
                  Cocok WO <strong className="mono">{matched.claim_id}</strong> — match{' '}
                  <strong>{matchKind}</strong>
                  {matched.claim_status ? ` · ${matched.claim_status}` : ''}
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

              <div className="parse-textareas">
                {TEXT_AREAS.map(([key, label]) => {
                  const val = String(parsed[key] ?? '');
                  return (
                    <label key={key}>
                      {label}
                      <textarea
                        rows={key === 'causeAnalyze' ? 6 : 3}
                        value={val}
                        onChange={(e) => patchParsed(key, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>

              {parsed.partsRows?.length ? (
                <div className="parts-table-wrap">
                  <h3 className="section-title">Parts ({parsed.partsRows.length})</h3>
                  <table className="parts-table">
                    <thead>
                      <tr>
                        <th>Failure</th>
                        <th>Replacement</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.partsRows.map((r, i) => (
                        <tr key={`${r.failurePartNo}-${i}`}>
                          <td className="mono">{r.failurePartNo}</td>
                          <td className="mono">{r.replacementPartNo}</td>
                          <td>{r.description || '—'}</td>
                          <td>{r.qty ?? '—'}</td>
                          <td>{r.unitPrice ?? '—'}</td>
                          <td>{r.amount ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

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
