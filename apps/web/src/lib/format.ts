/** Display dates as DD/MM/YYYY (WIB for datetimes). Store remains ISO in DB. */

export function formatDateDisplay(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (!s) return '';

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

/** Parse ISO/date-ish to Date at local noon for day math. */
export function parseDateOnly(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
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

/** Strip SLG- prefix for portal material numbers. */
export function stripSlgPrefix(partNo: unknown): string {
  const s = String(partNo ?? '').trim();
  return s.replace(/^SLG-/i, '');
}
