import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { SDLG_FORM_FIELDS, SDLG_SECTION_TITLES, type SdlgFieldDef, type SdlgFieldKey } from '@/config/sdlgFormFields';
import { fetchClaimById } from '@/lib/claimsApi';
import { daysBetween, parseDateOnly } from '@/lib/format';
import { StatusBadge } from '@/shared/StatusBadge';
import { buildCopyAllText, buildSdlgValues } from './buildSdlgValues';

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch { return false; }
  }
}

function sectionFields(section: SdlgFieldDef['section']) {
  return SDLG_FORM_FIELDS.filter((f) => f.section === section);
}

export function SdlgHelperPage() {
  const { claimId = '' } = useParams();
  const id = decodeURIComponent(claimId);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyAllMsg, setCopyAllMsg] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['claim', id], queryFn: () => fetchClaimById(id), enabled: Boolean(id), staleTime: 10_000 });
  const values = useMemo(() => (q.data ? buildSdlgValues(q.data) : null), [q.data]);
  const missingRequired = useMemo(() => {
    if (!values) return [];
    return SDLG_FORM_FIELDS.filter((f) => f.required && !String(values[f.key] || '').trim()).map((f) => f.portalLabel);
  }, [values]);
  const tenDayWarning = useMemo(() => {
    if (!q.data) return null;
    const repair = parseDateOnly(q.data.dealer_repair_date) || parseDateOnly(q.data.completion_date);
    const claimDate = parseDateOnly(q.data.dealer_claim_date);
    if (!repair) return 'Tanggal repair kosong — tidak bisa cek aturan 10 hari.';
    if (!claimDate) return 'Dealer Claim Date kosong. Aturan: klaim maksimal 10 hari setelah repair.';
    const d = daysBetween(repair, claimDate);
    if (d > 10) return `Dealer Claim Date ${d} hari setelah repair (batas 10 hari).`;
    if (d < 0) return 'Dealer Claim Date lebih awal dari repair — periksa data.';
    return null;
  }, [q.data]);

  async function onCopyField(key: SdlgFieldKey, text: string) {
    if (await copyText(text)) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    }
  }
  async function onCopyAll() {
    if (!values) return;
    const ok = await copyText(buildCopyAllText(values, SDLG_FORM_FIELDS));
    setCopyAllMsg(ok ? 'Semua field tersalin ke clipboard.' : 'Gagal copy.');
    window.setTimeout(() => setCopyAllMsg(null), 2500);
  }

  const sections: SdlgFieldDef['section'][] = ['home', 'replacement_part', 'fault_info', 'new_part', 'price'];

  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <Link to={`/claims/${encodeURIComponent(id)}`} className="back-link">← Detail klaim</Link>
          <p className="eyebrow">Fase 2 · Helper</p>
          <h1>Submit ke SDLG</h1>
          <p className="muted mono">{id}</p>
          {q.data ? <StatusBadge status={q.data.claim_status} /> : null}
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => void onCopyAll()} disabled={!values}>Copy semua</button>
        </div>
      </header>
      <div className="alert info">Assist copy/paste saja — tidak auto-submit.</div>
      {missingRequired.length > 0 ? <div className="alert warn"><strong>Field wajib kosong:</strong> {missingRequired.join(', ')}</div> : null}
      {tenDayWarning ? <div className="alert warn">{tenDayWarning}</div> : null}
      {copyAllMsg ? <div className="alert info">{copyAllMsg}</div> : null}
      {q.isLoading ? <p className="muted">Memuat…</p> : null}
      {q.isError ? <div className="alert error">{(q.error as Error).message}</div> : null}
      {values ? sections.map((sec) => (
        <section key={sec} className="panel">
          <h2 className="section-title">{SDLG_SECTION_TITLES[sec]}</h2>
          <div className="sdlg-field-list">
            {sectionFields(sec).map((f) => {
              const val = values[f.key] || '';
              const empty = !val.trim();
              return (
                <div key={f.key} className={`sdlg-field-row ${empty && f.required ? 'sdlg-field-missing' : ''}`}>
                  <div className="sdlg-field-meta">
                    <span className="sdlg-field-label">{f.portalLabel}{f.required ? ' *' : ''}</span>
                    {f.note ? <span className="muted small">{f.note}</span> : null}
                  </div>
                  <div className="sdlg-field-value mono">{val || '—'}</div>
                  <button type="button" className="ghost" disabled={empty} onClick={() => void onCopyField(f.key, val)}>
                    {copiedKey === f.key ? 'Tersalin' : 'Copy'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )) : null}
    </div>
  );
}
