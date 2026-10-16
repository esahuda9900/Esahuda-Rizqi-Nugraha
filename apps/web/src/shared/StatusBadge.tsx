const TONE: Record<string, string> = {
  Paid: 'ok',
  Draft: 'muted',
  Rejected: 'bad',
  'SDLG Audit': 'warn',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status || '—';
  const tone = TONE[s] || (s.toLowerCase().includes('audit') ? 'warn' : 'muted');
  return <span className={`badge badge-${tone}`}>{s}</span>;
}
