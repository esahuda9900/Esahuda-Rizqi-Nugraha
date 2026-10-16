/** Display dates as DD/MM/YYYY (WIB for datetimes). Store remains ISO in DB. */

export function formatDateDisplay(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (!s) return '';

  // Already date-only ISO
  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;
  }

  const t = Date.parse(s);
  if (!Number.isFinite(t)) return s;

  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(t));
  } catch {
    return s;
  }
}

export function formatMoney(value: unknown, currency?: string | null): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(value);
  const cur = (currency || '').trim().toUpperCase();
  try {
    if (cur === 'USD' || cur === 'CNY' || cur === 'IDR') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: cur === 'IDR' ? 'IDR' : cur,
        maximumFractionDigits: 2,
      }).format(n);
    }
  } catch {
    /* fall through */
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function dash(value: unknown): string {
  if (value == null || value === '') return '—';
  const s = String(value).trim();
  return s || '—';
}
