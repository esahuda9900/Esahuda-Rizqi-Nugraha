const TONE: Record<string, string> = {
  Draft: 'muted',
  'Ready to Claim': 'muted',
  'Submitted to Warranty Admin': 'warn',
  'Submitted to SDLG': 'warn',
  'Claimed to SDLG': 'warn',
  'SDLG Audit': 'warn',
  Approved: 'ok',
  Rejected: 'bad',
  Billing: 'ok',
  Paid: 'ok',
  Completed: 'ok',
  'On Hold': 'warn',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status || '—';
  let tone = TONE[s];
  if (!tone) {
    const lower = s.toLowerCase();
    if (lower.includes('reject') || lower.includes('hold')) tone = 'bad';
    else if (lower.includes('audit') || lower.includes('submit') || lower.includes('claim')) tone = 'warn';
    else if (lower.includes('paid') || lower.includes('approv') || lower.includes('complete') || lower.includes('bill'))
      tone = 'ok';
    else tone = 'muted';
  }
  return <span className={`badge badge-${tone}`}>{s}</span>;
}
