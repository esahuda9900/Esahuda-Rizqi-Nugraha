import {
  parseCellMoney,
  parseHourMeter,
  cleanSourceCell,
  isPartsTotalSectionStop,
} from './money';
import { emptyParsed, type ParsedClaim, type ParsedPartRow } from './types';

function normalizeDate(raw: string): string {
  const x = cleanSourceCell(raw);
  if (!x) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(x)) return x.slice(0, 10);
  const m = x.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/);
  if (m) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
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
        /^(product name|indent no|serial no|dealer code|fault description|cause analyze|comment|handling result|customer name|sales date|failure date|working hours|distributor|dealer wo|dealer claim|contact info|repairs completion|causing part|app\.?\s*code|part replacement)/i.test(
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
      if (k === key || k.startsWith(key) || key.startsWith(k)) return cleanSourceCell(v);
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
        '[\s:\"\t]*([\s\S]{0,4000}?)(?=(?:Handling Result|Comment|Causing Part|Part Replacement|Signature of Technical|Dealer WO|TOTAL AMOUNT|Attach rele|Cause Analyze|Fault Description|Customer Approval|$))',
      'i',
    );
    const m = text.match(re);
    if (m) {
      return cleanSourceCell(
        m[1]
          .replace(/^[\"\s]+|[\"\s]+$/g, '')
          .replace(/\r/g, '')
          .replace(/\n{3,}/g, '\n\n'),
      );
    }
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
    const spaced = labeled.match(/([A-Z]{2,5}-?[A-Z0-9.-]+)\s+(.+)/i);
    if (spaced) return { no: cleanSourceCell(spaced[1]), desc: cleanSourceCell(spaced[2]) };
  }
  const near =
    text.match(
      /Causing Part Number\s*\(Description\)[\s\t]*([A-Z]{2,5}-?[A-Z0-9.-]+)\s*(?:\(([^)]*)\))?/i,
    ) ||
    text.match(/\b(SLG-[A-Z0-9.-]+)\b\s*(?:\(([^)]+)\))?/i) ||
    text.match(/\b(SLG-[A-Z0-9.-]+)\b\s+([A-Za-z][A-Za-z0-9 /-]{2,40})/i);
  if (near) return { no: cleanSourceCell(near[1]), desc: cleanSourceCell(near[2] || '') };
  return { no: '', desc: '' };
}

function extractPartsRows(text: string): ParsedPartRow[] {
  const rows: ParsedPartRow[] = [];
  const lines = text.split(/\r?\n/);
  let inTable = false;
  for (const line of lines) {
    if (/Part\s+Replacement\s+Record/i.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && (/PARTS\s+TOTAL/i.test(line) || /Dealer\s+Distributor\s+Labour/i.test(line))) break;
    if (!inTable) continue;
    if (/Failure\s+Parts?\s+Number/i.test(line) || /Replacement\s+Parts?\s+Number/i.test(line)) continue;
    const cells = (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/))
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    const partIdx = cells.findIndex((c) => /^[A-Z]{2,5}-[A-Z0-9.-]+$/i.test(c));
    if (partIdx < 0) continue;
    const failure = cells[partIdx];
    const replacement =
      cells[partIdx + 1] && /^[A-Z]{2,5}-/i.test(cells[partIdx + 1])
        ? cells[partIdx + 1]
        : failure;
    let desc = '';
    let qty: number | null = null;
    let unitPrice: number | null = null;
    let amount: number | null = null;
    const rest = cells.slice(partIdx + (replacement !== failure ? 2 : 1));
    const nums: number[] = [];
    for (const c of rest) {
      const money = parseCellMoney(c);
      const hm = parseHourMeter(c);
      if (money != null && /[.,]/.test(c)) {
        nums.push(money);
      } else if (hm != null && !/[A-Za-z]/.test(c) && Number(c.replace(/,/g, '')) < 1000) {
        if (qty == null) qty = hm;
        else nums.push(hm);
      } else if (/[A-Za-z]/.test(c) && !desc) {
        desc = c;
      } else if (money != null) {
        nums.push(money);
      }
    }
    if (nums.length >= 2) {
      unitPrice = nums[0];
      amount = nums[1];
    } else if (nums.length === 1) {
      amount = nums[0];
    }
    if (qty == null && amount != null && unitPrice != null && unitPrice > 0) {
      const q = Math.round(amount / unitPrice);
      if (q >= 1 && q <= 99) qty = q;
    }
    rows.push({
      failurePartNo: failure.toUpperCase(),
      replacementPartNo: replacement.toUpperCase(),
      description: desc,
      qty: qty ?? 1,
      unitPrice,
      amount,
    });
  }
  return rows;
}

function extractModel(text: string, map: Map<string, string>): string {
  let raw =
    fromMap(map, ['product name model', 'product name', 'model']) ||
    fieldRegex(text, ['Product Name (Model)', 'Product Name']);
  raw = cleanSourceCell(raw);
  const withSdlg = raw.match(/SDLG\s*([A-Z0-9-]{3,})/i);
  if (withSdlg) return withSdlg[1].toUpperCase();
  const token = raw.match(/\b([A-Z]?\d{3,4}[A-Z]?\d?[A-Z]?(?:-LS)?)\b/i);
  if (token) return token[1].toUpperCase();
  const line = text.match(/Product Name\s*\(Model\)[\s\t]+SDLG\s+([A-Z0-9-]+)/i);
  if (line) return line[1].toUpperCase();
  return raw.replace(/^SDLG\s+/i, '').replace(/\s+/g, '').slice(0, 24);
}

function extractSerial(text: string, map: Map<string, string>): string {
  const vlg = text.match(/\b(VLG[A-Z0-9]{8,})\b/i);
  if (vlg) return vlg[1].toUpperCase();
  const labeled =
    fromMap(map, ['serial no.', 'serial no', 'serial number']) ||
    fieldRegex(text, ['Serial No.', 'Serial No', 'Serial Number']);
  if (labeled) {
    const token = labeled.match(/[A-Z0-9]{6,}/i)?.[0];
    if (token) return token.toUpperCase();
  }
  const plate = text.match(/Machine\s+Name\s+Plate\s*\(SN\.?\s*([A-Z0-9]+)\)/i);
  if (plate) return plate[1].toUpperCase();
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
 * Labour Hrs / Mileage Km — form often puts values on next tab cells / next line.
 * Legacy table: Labour | Hrs | Rate | Amount  with value under Hrs column.
 */
function extractLabourMileage(text: string): {
  labourHrs: number | null;
  labourAmount: number | null;
  mileageKm: number | null;
  mileageAmount: number | null;
  otherAmount: number | null;
} {
  let labourHrs: number | null = null;
  let labourAmount: number | null = null;
  let mileageKm: number | null = null;
  let mileageAmount: number | null = null;
  let otherAmount: number | null = null;

  // Flatten whitespace for section scan
  const flat = text.replace(/\r/g, '');

  // Pattern A: "Labour" then within 200 chars "Hrs" then number
  const labourA = flat.match(/Labour[\s\S]{0,200}?\bHrs\b[\s\t:]*(\d+(?:[.,]\d+)?)/i);
  if (labourA) labourHrs = parseHourMeter(labourA[1]);

  // Pattern B: line containing only a small integer near Labour section (tabular)
  if (labourHrs == null) {
    const labourIdx = flat.search(/\bLabour\b/i);
    if (labourIdx >= 0) {
      const slice = flat.slice(labourIdx, labourIdx + 300);
      const nums = [...slice.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1]));
      // Prefer small integers typical for hours (1–99)
      const hr = nums.find((n) => n >= 1 && n <= 99);
      if (hr != null) labourHrs = hr;
    }
  }

  const labourAmt = flat.match(
    /Labour[\s\S]{0,250}?(?:USD\s*)?([¥￥$]?\s*[-–—]|\d+[.,]\d{2})/i,
  );
  if (labourAmt) labourAmount = parseCellMoney(labourAmt[1]) ?? 0;

  const mileageA = flat.match(/Mileage[\s\S]{0,120}?\bKm\b[\s\t:]*(\d+(?:[.,]\d+)?)/i);
  if (mileageA) mileageKm = parseHourMeter(mileageA[1]);

  if (mileageKm == null) {
    const mIdx = flat.search(/\bMileage\b(?!\s*To)/i);
    if (mIdx >= 0) {
      const slice = flat.slice(mIdx, mIdx + 250);
      const nums = [...slice.matchAll(/\b(\d{2,5})\b/g)].map((m) => Number(m[1]));
      const km = nums.find((n) => n >= 10 && n <= 99999);
      if (km != null) mileageKm = km;
    }
  }

  const mileageAmt = flat.match(
    /Mileage[\s\S]{0,200}?(?:USD\s*)?([¥￥$]?\s*[-–—]|\d+[.,]\d{2})/i,
  );
  if (mileageAmt) mileageAmount = parseCellMoney(mileageAmt[1]) ?? 0;

  const otherBlock = flat.match(
    /\bOther\b[\s\S]{0,80}?(?:USD\s*)?([¥￥$]?\s*[-–—]|\d+[.,]\d{2})/i,
  );
  if (otherBlock) otherAmount = parseCellMoney(otherBlock[1]) ?? 0;

  return { labourHrs, labourAmount, mileageKm, mileageAmount, otherAmount };
}

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

  p.appCode =
    fromMap(map, ['app. code', 'app code']) ||
    fieldRegex(text, ['App. Code', 'App Code']) ||
    text.match(/App\.?\s*Code[\s\t]+([0-9/A-Z-]+)/i)?.[1] ||
    '';

  p.dealerClaimNo =
    fromMap(map, ['dealer claim no.', 'dealer claim no']) ||
    fieldRegex(text, ['Dealer Claim No.', 'Dealer Claim No']);

  p.dealerClaimDate = normalizeDate(
    fromMap(map, ['dealer claim date']) ||
      fieldRegex(text, ['Dealer  Claim Date', 'Dealer Claim Date']) ||
      text.match(/Dealer\s+Claim\s+Date[\s\t]+([0-9/\-A-Za-z]+)/i)?.[1] ||
      '',
  );

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

  p.causeAnalyze =
    blockAfterLabel(text, [
      'Cause Analyze',
      'Cause of Failure',
      'Cause Analyze\\s*\\(Cause of Failure\\)',
    ]) || fromMap(map, ['cause analyze', 'cause of failure']);

  p.comment = blockAfterLabel(text, ['Comment']) || fromMap(map, ['comment']);

  p.repairMethod =
    fromMap(map, ['handling result repair method', 'handling result', 'repair method']) ||
    fieldRegex(text, ['Handling Result', 'Repair Method']) ||
    blockAfterLabel(text, ['Handling Result']);

  p.technicalPersonnel =
    fromMap(map, ['signature of technical personnel']) ||
    fieldRegex(text, ['Signature of Technical Personnel', 'Technical Personnel']);
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

  p.partsRows = extractPartsRows(text);
  if (p.partsRows.length && !p.causingPartNo) {
    p.causingPartNo = p.partsRows[0].failurePartNo;
    p.causingPartDesc = p.partsRows[0].description;
  }
  if (p.partsRows.length && p.causingPartNo) {
    const match = p.partsRows.find(
      (r) => r.failurePartNo.toUpperCase() === p.causingPartNo.toUpperCase(),
    );
    if (match?.description && !p.causingPartDesc) p.causingPartDesc = match.description;
  }

  p.engineSerialNo =
    fromMap(map, ['engine serial no.', 'engine serial']) ||
    fieldRegex(text, ['Engine Serial No.', 'Engine Serial']) ||
    text.match(/Engine Name Plate\s*\(([^)]+)\)/i)?.[1] ||
    text.match(/Engine Name Plate[^\n]*\(?\s*(SN\.?\s*[A-Z0-9.-]+)/i)?.[1] ||
    text.match(/\bSN\.(\d{6,})\b/)?.[0] ||
    '';

  p.failurePartLocation =
    fromMap(map, ['failure part location']) ||
    text.match(/Failure Part Location\s*\(([^)]+)\)/i)?.[1] ||
    text.match(/Filure Part Location\s*\(([^)]+)\)/i)?.[1] ||
    part.desc ||
    '';

  const lm = extractLabourMileage(text);
  p.labourHrs = lm.labourHrs;
  p.labourAmount = lm.labourAmount;
  p.mileageKm = lm.mileageKm;
  p.mileageAmount = lm.mileageAmount;
  p.otherAmount = lm.otherAmount;

  const toSite =
    text.match(/Mileage To Site\s*=?\s*(\d+(?:[.,]\d+)?)/i) ||
    text.match(/Milage To Site\s*=?\s*(\d+(?:[.,]\d+)?)/i);
  p.mileageToSite = toSite ? parseHourMeter(toSite[1]) : null;

  p.partsTotal = extractPartsTotal(text);
  if (p.partsTotal == null && p.partsRows.length) {
    const sum = p.partsRows.reduce((a, r) => a + (r.amount ?? 0), 0);
    if (sum > 0) p.partsTotal = sum;
  }
  if (p.partsTotal == null) {
    const partsTotalLine = text.match(/PARTS\s+TOTAL[\s\t$]*([^\n\r]+)/i);
    p.partsTotal = partsTotalLine ? parseCellMoney(partsTotalLine[1]) : null;
  }

  const totalLine = text.match(/TOTAL\s+AMOUNT\s+CLAIMED[\s\t$]*([^\n\r]+)/i);
  p.totalAmount = totalLine ? parseCellMoney(totalLine[1]) : null;

  if (p.totalAmount == null && p.partsTotal != null) p.totalAmount = p.partsTotal;
  if (p.partsTotal == null && p.totalAmount != null) p.partsTotal = p.totalAmount;

  p.distributorNo =
    fromMap(map, ['distributor no', 'distributor no.']) ||
    fieldRegex(text, ['Distributor No:', 'Distributor No.']) ||
    text.match(/\b(\d{4}-\d{4}-SDLG-PFR)\b/i)?.[1] ||
    '';

  return p;
}
