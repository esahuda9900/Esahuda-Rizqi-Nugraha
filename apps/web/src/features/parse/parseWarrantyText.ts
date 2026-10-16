import {
  parseCellMoney,
  parseHourMeter,
  cleanSourceCell,
  isPartsTotalSectionStop,
} from './money';
import { emptyParsed, type ParsedClaim } from './types';

/** Normalize common Excel date tokens to YYYY-MM-DD when possible. */
function normalizeDate(raw: string): string {
  const x = cleanSourceCell(raw);
  if (!x) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(x)) return x.slice(0, 10);
  const m = x.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/);
  if (m) {
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const mon = months[m[2].toLowerCase().slice(0, 3)];
    if (mon) {
      let y = m[3];
      if (y.length === 2) y = `20${y}`;
      return `${y}-${mon}-${m[1].padStart(2, '0')}`;
    }
  }
  const dmy = x.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return x;
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Excel paste is almost always tab-separated cells on each line.
 * Build a map: normalized label → value in the *next* non-empty cell.
 */
function buildCellMap(text: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/))
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    for (let i = 0; i < cells.length - 1; i++) {
      const label = normalizeLabel(cells[i]);
      if (label.length < 3) continue;
      if (/^wo\d+$/i.test(cells[i])) continue;
      if (/^\d{4}-\d{4}-sdlg/i.test(cells[i])) continue;
      const next = cells[i + 1];
      if (!next) continue;
      const nextIsLabel =
        /^(product name|indent no|serial no|dealer code|fault description|cause analyze|comment|handling result|customer name|sales date|failure date|working hours|distributor|dealer wo|dealer claim|contact info|repairs completion|causing part)/i.test(
          next,
        );
      if (nextIsLabel) continue;
      if (!map.has(label)) map.set(label, next);
    }
  }
  return map;
}

function fromMap(map: Map<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const key = normalizeLabel(c);
    if (map.has(key)) return cleanSourceCell(map.get(key));
    for (const [k, v] of map) {
      if (k === key || k.startsWith(key) || key.startsWith(k)) {
        return cleanSourceCell(v);
      }
      if (k.includes(key) && key.length >= 8) return cleanSourceCell(v);
    }
  }
  return '';
}

function fieldRegex(text: string, labels: string[]): string {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc + '[\s:]*([^\t\n\r]+?)(?=\t|\s{2,}|$)', 'i');
    const m = text.match(re);
    if (m) {
      const v = cleanSourceCell(m[1]);
      if (v) return v;
    }
  }
  return '';
}

function blockAfterLabel(text: string, labels: string[]): string {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      esc +
        '[\s:\"\t]*([\s\S]{0,1500}?)(?=(?:Handling Result|Comment|Causing Part|Part Replacement|Signature of Technical|Dealer WO|TOTAL AMOUNT|Attach rele|Cause Analyze|Fault Description|$))',
      'i',
    );
    const m = text.match(re);
    if (m) return cleanSourceCell(m[1].replace(/^[\"\s]+|[\"\s]+$/g, ''));
  }
  return '';
}

function extractPart(text: string, map: Map<string, string>): { no: string; desc: string } {
  const labeled =
    fromMap(map, ['causing part number description', 'causing part number', 'causing part']) ||
    fieldRegex(text, ['Causing Part Number (Description)', 'Causing Part Number']);
  if (labeled) {
    const m = labeled.match(/([A-Z]{2,5}-?[A-Z0-9.-]+)\s*(?:\(([^)]*)\))?/i);
    if (m) return { no: cleanSourceCell(m[1]), desc: cleanSourceCell(m[2] || '') };
  }
  const near =
    text.match(
      /Causing Part Number\s*\(Description\)[\s\t]*([A-Z]{2,5}-?[A-Z0-9.-]+)\s*(?:\(([^)]*)\))?/i,
    ) || text.match(/\b(SLG-[A-Z0-9.-]+)\b\s*(?:\(([^)]+)\))?/i);
  if (near) return { no: cleanSourceCell(near[1]), desc: cleanSourceCell(near[2] || '') };
  return { no: '', desc: '' };
}

function extractModel(text: string, map: Map<string, string>): string {
  let raw =
    fromMap(map, ['product name model', 'product name', 'model']) ||
    fieldRegex(text, ['Product Name (Model)', 'Product Name']);
  raw = cleanSourceCell(raw);
  const withSdlg = raw.match(/SDLG\s*([A-Z0-9]{3,})/i);
  if (withSdlg) return withSdlg[1].toUpperCase();
  const token = raw.match(/\b([A-Z]?\d{3,4}[A-Z]?\d?[A-Z]?)\b/i);
  if (token) return token[1].toUpperCase();
  const line = text.match(/Product Name\s*\(Model\)[\s\t]+SDLG\s+([A-Z0-9]+)/i);
  if (line) return line[1].toUpperCase();
  return raw.replace(/^SDLG\s+/i, '').replace(/\s+/g, '').slice(0, 20);
}

function extractSerial(text: string, map: Map<string, string>): string {
  const labeled =
    fromMap(map, ['serial no.', 'serial no', 'serial number']) ||
    fieldRegex(text, ['Serial No.', 'Serial No', 'Serial Number']);
  if (labeled) {
    const token = labeled.match(/[A-Z0-9]{6,}/i)?.[0];
    if (token) return token.toUpperCase();
  }
  const vlg = text.match(/\b(VLG[A-Z0-9]{8,})\b/i);
  if (vlg) return vlg[1].toUpperCase();
  // ITU forms often use short serial like S0611152
  const short = text.match(/Serial No\.?[\s\t]+([A-Z0-9]{6,})/i);
  return short ? short[1].toUpperCase() : '';
}

function extractWo(text: string, map: Map<string, string>): string {
  const labeled =
    fromMap(map, ['dealer wo/so', 'dealer wo', 'wo/so']) ||
    fieldRegex(text, ['Dealer WO/SO', 'Dealer WO']);
  const fromLabel = (labeled.match(/\b(WO\d{6,})\b/i) || [])[1];
  if (fromLabel) return fromLabel.toUpperCase();
  const any = text.match(/\b(WO\d{6,})\b/i);
  return any ? any[1].toUpperCase() : '';
}

/** Scan lines for PARTS TOTAL value; stop at labour / total section (legacy helper). */
function extractPartsTotal(text: string): number | null {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/PARTS\s+TOTAL/i.test(line)) continue;
    const same = parseCellMoney(line.replace(/PARTS\s+TOTAL/i, ''));
    if (same != null) return same;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      if (isPartsTotalSectionStop(lines[j])) break;
      const m = parseCellMoney(lines[j]);
      if (m != null) return m;
    }
  }
  return null;
}

/**
 * Heuristic source parser for SDLG warranty paste (Excel → text / TSV).
 * Tuned against real ITU form rows. v0.6 parity with legacy money section-stop.
 */
export function parseWarrantyText(rawInput: string): ParsedClaim {
  const text = String(rawInput || '').replace(/\u00a0/g, ' ');
  const p = emptyParsed(text);
  if (!text.trim()) return p;

  const map = buildCellMap(text);

  p.dealerWoSo = extractWo(text, map);
  p.model = extractModel(text, map);
  p.serialNo = extractSerial(text, map);

  p.indentNo =
    fromMap(map, ['indent no. machine build no.', 'indent no.', 'machine build no.']) ||
    fieldRegex(text, ['Indent No. (Machine Build No.)', 'Indent No.']);

  p.customer =
    fromMap(map, ['customer name', 'customer']) || fieldRegex(text, ['Customer Name', 'Customer']);
  p.customer = p.customer.replace(/\t.*$/, '').split(/\s{2,}/)[0]?.trim() || p.customer;

  p.distributor =
    fromMap(map, ['distributor']) ||
    fieldRegex(text, ['Distributor']) ||
    'PT. Indo Traktor Utama';
  if (/working conditions/i.test(p.distributor)) {
    p.distributor = 'PT. Indo Traktor Utama';
  }

  p.dealerName =
    fromMap(map, ['contact info dealer name', 'dealer name']) ||
    fieldRegex(text, ['Contact Info (Dealer Name)', 'Dealer Name']) ||
    p.distributor;

  p.dealerCode = fromMap(map, ['dealer code']) || fieldRegex(text, ['Dealer Code']);

  p.salesDate = normalizeDate(
    fromMap(map, ['sales date dd/mm/yy', 'sales date']) ||
      fieldRegex(text, ['Sales Date (DD/MM/YY)', 'Sales Date']),
  );
  p.failureDate = normalizeDate(
    fromMap(map, ['failure date']) || fieldRegex(text, ['Failure Date']),
  );
  p.dealerRepairDate = normalizeDate(
    fromMap(map, ['dealer repair date', 'repairs completion date']) ||
      fieldRegex(text, ['Dealer  Repair Date', 'Dealer Repair Date', 'Repairs Completion Date']),
  );
  p.completionDate =
    normalizeDate(
      fromMap(map, ['repairs completion date', 'completion date']) ||
        fieldRegex(text, ['Repairs Completion Date', 'Completion Date']),
    ) || p.dealerRepairDate;

  const hmFail =
    fromMap(map, ['working hours hour meter reading', 'hour meter reading', 'working hours']) ||
    fieldRegex(text, ['Working Hours (Hour Meter Reading)', 'Hour Meter Reading']) ||
    text.match(/Hour Meter When Problem[^\d]*(\d+)/i)?.[1] ||
    '';
  p.hmFailure = parseHourMeter(hmFail);

  const hmDone =
    text.match(/Finish Hour Meter[^\d]*(\d+(?:\.\d+)?)/i)?.[1] ||
    fromMap(map, ['finish hour meter', 'hm completion']);
  p.hmCompletion = parseHourMeter(hmDone || '');

  p.faultDescription =
    fromMap(map, ['fault description']) ||
    fieldRegex(text, ['Fault Description']) ||
    blockAfterLabel(text, ['Fault Description']);

  p.causeAnalyze = blockAfterLabel(text, ['Cause Analyze', 'Cause of Failure']);
  p.comment = blockAfterLabel(text, ['Comment']);

  p.repairMethod =
    fromMap(map, ['handling result repair method', 'handling result', 'repair method']) ||
    fieldRegex(text, ['Handling Result', 'Repair Method']) ||
    blockAfterLabel(text, ['Handling Result']);

  p.technicalPersonnel =
    fromMap(map, ['signature of technical personnel']) ||
    fieldRegex(text, ['Signature of Technical Personnel', 'Technical Personnel']);
  // Form often puts names on same row after colon blank
  if (!p.technicalPersonnel) {
    const techRow = text.match(
      /Signature of Technical Personnel[:\s\t]*([^\n\r]*?)(?:Repairs Completion|PARTS|$)/i,
    );
    if (techRow) {
      const names = cleanSourceCell(techRow[1]).replace(/\t+/g, ' ').trim();
      if (names && !/^repairs/i.test(names)) p.technicalPersonnel = names;
    }
  }

  const part = extractPart(text, map);
  p.causingPartNo = part.no;
  p.causingPartDesc =
    part.desc ||
    text.match(/Filure Part Location\s*\(([^)]+)\)/i)?.[1] ||
    text.match(/Failure Part Location\s*\(([^)]+)\)/i)?.[1] ||
    '';

  p.engineSerialNo =
    fromMap(map, ['engine serial no.', 'engine serial']) ||
    fieldRegex(text, ['Engine Serial No.', 'Engine Serial']) ||
    text.match(/Engine Name Plate[^\n]*\(?\s*(SN\.?\s*[A-Z0-9.-]+)/i)?.[1] ||
    text.match(/\bSN\.(\d{6,})\b/)?.[0] ||
    '';

  p.failurePartLocation =
    fromMap(map, ['failure part location']) ||
    text.match(/Failure Part Location\s*\(([^)]+)\)/i)?.[1] ||
    text.match(/Filure Part Location\s*\(([^)]+)\)/i)?.[1] ||
    part.desc ||
    '';

  const labour =
    text.match(/Labour[\s\S]{0,120}?Hrs[\s\t]*(\d+(?:[.,]\d+)?)/i) ||
    text.match(/\bHrs\b[\s\t]*(\d+(?:[.,]\d+)?)/i);
  p.labourHrs = labour ? parseHourMeter(labour[1]) : null;

  const mileage =
    text.match(/Mileage(?!\s*To)[\s\S]{0,60}?Km[\s\t]*(\d+(?:[.,]\d+)?)/i) ||
    text.match(/\bKm\b[\s\t]*(\d{2,5})/i);
  p.mileageKm = mileage ? parseHourMeter(mileage[1]) : null;

  const toSite =
    text.match(/Mileage To Site\s*=?\s*(\d+(?:[.,]\d+)?)/i) ||
    text.match(/Milage To Site\s*=?\s*(\d+(?:[.,]\d+)?)/i);
  p.mileageToSite = toSite ? parseHourMeter(toSite[1]) : null;

  p.partsTotal = extractPartsTotal(text);
  if (p.partsTotal == null) {
    const partsTotalLine = text.match(/PARTS\s+TOTAL[\s\t$]*([^\n\r]+)/i);
    p.partsTotal = partsTotalLine ? parseCellMoney(partsTotalLine[1]) : null;
  }

  const totalLine = text.match(/TOTAL\s+AMOUNT\s+CLAIMED[\s\t$]*([^\n\r]+)/i);
  p.totalAmount = totalLine ? parseCellMoney(totalLine[1]) : null;

  if (p.partsTotal == null && p.causingPartNo) {
    const rowMoney = text.match(
      new RegExp(
        p.causingPartNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '[\\s\\S]{0,80}?(\\$?\\s*\\d+[.,]\\d{2})',
        'i',
      ),
    );
    if (rowMoney) p.partsTotal = parseCellMoney(rowMoney[1]);
  }

  // If only one money found, mirror to total
  if (p.totalAmount == null && p.partsTotal != null) p.totalAmount = p.partsTotal;
  if (p.partsTotal == null && p.totalAmount != null) p.partsTotal = p.totalAmount;

  p.distributorNo =
    fromMap(map, ['distributor no', 'distributor no.']) ||
    fieldRegex(text, ['Distributor No:', 'Distributor No.']) ||
    text.match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/i)?.[1] ||
    '';

  return p;
}
