import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchClaims } from '@/lib/claimsApi';
import { formatDateDisplay } from '@/lib/format';
import { StatusBadge } from '@/shared/StatusBadge';
export function OverviewPage() {
  const q = useQuery({ queryKey: ['claims', 'overview'], queryFn: () => fetchClaims({ limit: 2000 }), staleTime: 30_000 });
  const rows = q.data || [];
  const statuses = rows.reduce<Record<string, number>>((out, r) => { const s = r.claim_status || 'Unknown'; out[s] = (out[s] || 0) + 1; return out; }, {});
  const count = (test: RegExp) => rows.filter(r => test.test(r.claim_status || '')).length;
  const metrics = [
    { label: 'Klaim aktif', value: rows.length, note: 'Seluruh status, tanpa arsip', accent: true },
    { label: 'Dalam audit', value: count(/^SDLG Audit$/i), note: 'Menunggu hasil principal' },
    { label: 'Paid', value: count(/^Paid$/i), note: 'Status pembayaran selesai' },
    { label: 'Rejected', value: count(/^Rejected$/i), note: 'Perlu review alasan penolakan' },
  ];
  return <div className="page operations-overview">
    <header className="page-header row"><div><p className="eyebrow">WARRANTY OPERATIONS / OVERVIEW</p><h1>Pekerjaan lebih terkendali.</h1><p className="muted">Pantau progres klaim dan tentukan tindak lanjut berikutnya.</p></div><div className="row"><button type="button" className="ghost" disabled={q.isFetching} onClick={() => void q.refetch()}>{q.isFetching ? 'Memuat…' : '↻ Refresh'}</button><Link className="btn-link" to="/parse">+ Klaim baru</Link></div></header>
    {q.isError ? <div className="alert error" role="alert">Data belum dapat dimuat. {(q.error as Error).message} <button className="ghost" onClick={() => void q.refetch()}>Coba lagi</button></div> : null}
    <div className="kpi-grid">{metrics.map((m, i) => <div className={`kpi-card ${m.accent ? 'accent' : ''}`} key={m.label}><div className="metric-head"><span className="kpi-label">{m.label}</span><span className="metric-index">0{i + 1}</span></div><span className="kpi-value">{q.isPending ? '…' : q.isError && !q.data ? '—' : m.value.toLocaleString('id-ID')}</span><span className="small muted">{m.note}</span></div>)}</div>
    <div className="overview-grid"><section className="panel"><div className="section-heading"><div><p className="eyebrow">PIPELINE</p><h2>Status klaim</h2></div><span className="small muted">{rows.length} klaim</span></div>
      {q.isPending ? <p role="status" className="muted">Memuat distribusi status…</p> : !rows.length ? <p className="muted">{q.isError ? 'Distribusi belum tersedia.' : 'Belum ada klaim aktif yang dapat ditampilkan.'}</p> : <div className="status-bars">{Object.entries(statuses).sort((a, b) => b[1] - a[1]).map(([name, n]) => <div className="status-row" key={name}><div className="status-row-top"><StatusBadge status={name} /><span className="mono">{n} <span className="muted">/ {Math.round(n / rows.length * 100)}%</span></span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${n / rows.length * 100}%` }} /></div></div>)}</div>}
    </section><section className="panel action-panel"><p className="eyebrow">WORKSPACE</p><h2>Mulai dari sini.</h2><p className="muted">Selesaikan pekerjaan harian tanpa berpindah-pindah sistem.</p><Link to="/claims"><span><strong>Monitoring klaim</strong><small>Cari unit, customer, atau WO</small></span><b>↗</b></Link><Link to="/parse"><span><strong>Input dari laporan TSI</strong><small>Paste, periksa, lalu simpan</small></span><b>↗</b></Link><Link to="/quality"><span><strong>Periksa kualitas data</strong><small>Temukan data yang perlu dilengkapi</small></span><b>↗</b></Link><Link to="/unit"><span><strong>Unit 360</strong><small>Riwayat warranty per unit</small></span><b>↗</b></Link></section></div>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Klaim terakhir diperbarui</h2></div><Link to="/claims">Lihat semua →</Link></div><div className="table-wrap"><table><thead><tr><th>Claim ID</th><th>Customer / Unit</th><th>WO / Cabang</th><th>Status</th><th>Diperbarui</th></tr></thead><tbody>{rows.slice(0, 6).map(r => <tr key={r.claim_id}><td><Link className="mono" to={`/claims/${encodeURIComponent(r.claim_id)}`}>{r.claim_id}</Link></td><td><strong>{r.customer || '—'}</strong><div className="small muted">{r.model || '—'} · {r.serial_no || '—'}</div></td><td>{r.dealer_wo_so || '—'}<div className="small muted">{r.branch || '—'}</div></td><td><StatusBadge status={r.claim_status} /></td><td>{formatDateDisplay(r.last_updated) || '—'}</td></tr>)}</tbody></table></div>{!rows.length ? <p className="muted">{q.isPending ? 'Memuat aktivitas…' : 'Belum ada aktivitas yang dapat ditampilkan.'}</p> : null}</section>
    <p className="small muted">{q.dataUpdatedAt ? `Terakhir dimuat ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(q.dataUpdatedAt)} WIB` : 'Data mengikuti hak akses akun.'}{rows.length === 2000 ? ' · Ringkasan dibatasi 2.000 klaim terbaru.' : ''}</p>
  </div>;
}
