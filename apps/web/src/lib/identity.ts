/** SOURCE LOCK / master key helpers — mirror legacy baseCustomerName intent. */

const LEGAL_PREFIX = /^(PT\.?|CV\.?|UD\.?|MR\.?|MRS\.?|IBU|BAPAK)\s+/i;
const LEGAL_SUFFIX = /\s+(PT\.?|CV\.?|UD\.?)$/i;

export function baseCustomerName(value: unknown): string {
  let s = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return '';
  // Strip legal entity both ends repeatedly
  for (let i = 0; i < 3; i++) {
    const next = s.replace(LEGAL_PREFIX, '').replace(LEGAL_SUFFIX, '').trim();
    if (next === s) break;
    s = next;
  }
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameCustomerKey(a: unknown, b: unknown): boolean {
  const ka = baseCustomerName(a);
  const kb = baseCustomerName(b);
  return Boolean(ka && kb && ka === kb);
}

export function normalizeModelKey(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/^SDLG\s+/i, '')
    .replace(/[^A-Z0-9]/g, '');
}
