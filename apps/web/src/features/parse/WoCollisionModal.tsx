import type { ClaimListRow } from '@/lib/claimsApi';
import type { ParsedClaim } from './types';
import type { MatchKind } from './woPolicy';
import { normalizeWo } from './woPolicy';

type Props = {
  mode: 'new' | 'update';
  kind: MatchKind;
  parsed: ParsedClaim;
  matched: ClaimListRow;
  /** When true, Simpan Baru will clear WO on the new row (legacy hard rule). */
  willClearWo?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function short(v: unknown, max = 90): string {
  const s = String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function WoCollisionModal({
  mode,
  kind,
  parsed,
  matched,
  willClearWo = false,
  onConfirm,
  onCancel,
}: Props) {
  const isUpdate = mode === 'update';
  const badge = isUpdate
    ? 'Update klaim lama'
    : kind === 'strong'
      ? 'WO sama · kerusakan mirip'
      : 'WO sama · kerusakan beda';
  const title = isUpdate ? 'Yakin timpa klaim lama?' : 'WO sudah dipakai klaim lain';
  const primary = isUpdate ? 'Timpa klaim lama' : 'Simpan sebagai Baru';

  return (
    <div className="modal-root" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-card">
        <div className="modal-accent" />
        <div className="modal-body">
          <span className={`modal-badge ${isUpdate ? 'danger' : kind}`}>{badge}</span>
          <h2>{title}</h2>
          <p className="muted">
            {isUpdate
              ? 'Data parse akan menimpa klaim yang sudah tersimpan. Periksa perbedaan di bawah.'
              : 'Nomor WO sama. Cek apakah ini revisi klaim yang sama atau case baru.'}
          </p>
          <div className="modal-wo mono">
            WO {normalizeWo(parsed.dealerWoSo) || '—'} · Klaim {matched.claim_id}
            {matched.claim_status ? ` · ${matched.claim_status}` : ''}
          </div>
          <div className="modal-diff">
            <div className="diff-col old">
              <h4>Klaim lama</h4>
              <p>
                <b>Customer</b>
                {short(matched.customer)}
              </p>
              <p>
                <b>Fault</b>
                {short(matched.fault_description)}
              </p>
              <p>
                <b>Part</b>
                <span className="mono">{short(matched.causing_part_no, 40)}</span>
              </p>
              <p>
                <b>Serial</b>
                <span className="mono">{short(matched.serial_no, 40)}</span>
              </p>
            </div>
            <div className="diff-col new">
              <h4>Parse sekarang</h4>
              <p>
                <b>Customer</b>
                {short(parsed.customer)}
              </p>
              <p>
                <b>Fault</b>
                {short(parsed.faultDescription)}
              </p>
              <p>
                <b>Part</b>
                <span className="mono">{short(parsed.causingPartNo, 40)}</span>
              </p>
              <p>
                <b>Serial</b>
                <span className="mono">{short(parsed.serialNo, 40)}</span>
              </p>
            </div>
          </div>
          <div className="modal-note">
            {isUpdate ? (
              'Aksi ini mengubah klaim existing. Tidak bisa di-undo dari dialog ini.'
            ) : willClearWo ? (
              <>
                <strong>Aturan legacy:</strong> Simpan Baru akan{' '}
                <strong>mengosongkan WO</strong> di klaim baru agar 1 WO ≈ 1 klaim aktif tetap
                terjaga. Isi WO manual nanti jika memang case terpisah yang diizinkan.
              </>
            ) : (
              'Simpan Baru membuat baris klaim baru. Pastikan WO/cabang sudah sesuai.'
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Batal
          </button>
          <button type="button" className={isUpdate ? 'danger' : ''} onClick={onConfirm}>
            {primary}
          </button>
        </div>
      </div>
    </div>
  );
}
