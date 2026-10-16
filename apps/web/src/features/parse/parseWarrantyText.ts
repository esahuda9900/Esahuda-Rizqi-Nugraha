import { parseCellMoney, parseHourMeter, cleanSourceCell } from './money';
import { emptyParsed, type ParsedClaim } from './types';

/** Normalize common Excel date tokens to YYYY-MM-DD when possible. */
function normalizeDate(raw: string): string {
  const x = cleanSourceCell(raw);
  if (!x) return '';
  // already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(x)) return x.slice(0, 10);
  // DD-MMM-YYYY or D-MMM-YYYY
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
      const d = m[1].padStart(2, '0');
      return `${y}-${mon}-${d}`;
    }
  }
  // DD/MM/YYYY
  const dmy = x.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return x;
}

function fieldAfterLabel(text: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(
      label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\s:]*([^\n\r]+)',
      'i',
    );
    const m = text.match(re);
    if (m) {
      let v = cleanSourceCell(m[1]);
      // stop at next obvious label chunk
      v = v.split(/\t{2,}|\s{2,}(?=[A-Z][a-z]+\s)/)[0]?.trim() || v;
      if (v) return v;
    }
  }
  return '';
}

function blockAfterLabel(text: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(
      label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\s:\"]*([\s\S]{0,1200}?)(?=(?:Handling Result|Comment|Causing Part|Part Replacement|Signature|Dealer WO|TOTAL AMOUNT|$))',
      'i',
    );
    const m = text.match(re);
    if (m) return cleanSourceCell(m[1].replace(/^"|"$/g, ''));
  }
  return '';
}

function extractPart(text: string): { no: string; desc: string } {
  const m =
    text.match(/Causing Part Number\s*\(Description\)\s*([A-Z0-9][A-Z0-9._-]*)\s*(?:\(([^)]*)\))?/i) ||
    text.match(/Causing Part[^\n]*?([A-Z]{2,5}-?\d[\dA-Z.-]*)\s*(?:\(([^)]*)\))?/i) ||
    text.match(/\b(SLG-[A-Z0-9.-]+)\b\s*(?:\(([^)]*)\))?/i);
  if (!m) return { no: '', desc: '' };
  return { no: cleanSourceCell(m[1]), desc: cleanSourceCell(m[2] || '') };
}

function extractModel(text: string): string {
  const raw =
    fieldAfterLabel(text, ['Product Name (Model)', 'Product Name', 'Model']) ||
    (text.match(/\bSDLG\s+([A-Z0-9]{3,})/i)?.[1] ?? '');
  return cleanSourceCell(raw).replace(/^SDLG\s+/i, '').replace(/\s+/g, '');
}

function extractSerial(text: string): string {
  const labeled = fieldAfterLabel(text, ['Serial No.', 'Serial No', 'Serial Number']);
  if (labeled) {
    const token = labeled.match(/[A-Z0-9]{6,}/i)?.[0];
    if (token) return token.toUpperCase();
  }
  const vlg = text.match(/\b(VLG[A-Z0-9]{8,})\b/i);
  if (vlg) return vlg[1].toUpperCase();
  const short = text.match(/Serial No\.?\s*([A-Z0-9]{6,})/i);
  return short ? short[1].toUpperCase() : '';
}

/**
 * Heuristic source parser for SDLG warranty paste (Excel → text).
 * Not byte-identical to the 3MB legacy parser; covers core fields for PRD F4.
 */
export function parseWarrantyText(rawInput: string): ParsedClaim {
  const text = String(rawInput || '');
  const p = emptyParsed(text);
  if (!text.trim()) return p;

  p.dealerWoSo = (
    fieldAfterLabel(text, ['Dealer WO/SO', 'Dealer WO', 'WO/SO']) ||
    text.match(/\b(WO\d{6,})\b/i)?.[1] ||
    ''
  ).toUpperCase();

  p.model = extractModel(text);
  p.serialNo = extractSerial(text);
  p.indentNo = fieldAfterLabel(text, [
    'Indent No. (Machine Build No.)',
    'Indent No.',
    'Machine Build No.',
  ]);
  p.customer = fieldAfterLabel(text, ['Customer Name', 'Customer']);
  p.distributor = fieldAfterLabel(text, ['Distributor']) || 'PT. Indo Traktor Utama';
  p.dealerName =
    fieldAfterLabel(text, ['Contact Info (Dealer Name)', 'Dealer Name']) ||
    p.distributor;
  p.dealerCode = fieldAfterLabel(text, ['Dealer Code']);
  p.salesDate = normalizeDate(fieldAfterLabel(text, ['Sales Date (DD/MM/YY)', 'Sales Date']));
  p.failureDate = normalizeDate(fieldAfterLabel(text, ['Failure Date']));
  p.dealerRepairDate = normalizeDate(
    fieldAfterLabel(text, ['Dealer  Repair Date', 'Dealer Repair Date', 'Repairs Completion Date']),
  );
  p.completionDate =
    normalizeDate(fieldAfterLabel(text, ['Repairs Completion Date', 'Completion Date'])) ||
    p.dealerRepairDate;

  const hmFail =
    fieldAfterLabel(text, ['Working Hours (Hour Meter Reading)', 'Hour Meter Reading', 'Working Hours']) ||
    text.match(/Hour Meter When Problem[^\d]*(\d+)/i)?.[1] ||
    '';
  p.hmFailure = parseHourMeter(hmFail);

  const hmDone =
    text.match(/Finish Hour Meter[^\d]*(\d+(?:\.\d+)?)/i)?.[1] ||
    fieldAfterLabel(text, ['Finish Hour Meter', 'HM Completion']);
  p.hmCompletion = parseHourMeter(hmDone || '');

  p.faultDescription = fieldAfterLabel(text, ['Fault Description']) || blockAfterLabel(text, ['Fault Description']);
  p.causeAnalyze = blockAfterLabel(text, ['Cause Analyze', 'Cause of Failure']);
  p.comment = blockAfterLabel(text, ['Comment']);
  p.repairMethod = fieldAfterLabel(text, ['Handling Result', 'Repair Method', 'Handling Result\n(Repair Method)']);
  p.technicalPersonnel = fieldAfterLabel(text, [
    'Signature of Technical Personnel',
    'Technical Personnel',
  ]);

  const part = extractPart(text);
  p.causingPartNo = part.no;
  p.causingPartDesc = part.desc;

  p.engineSerialNo =
    fieldAfterLabel(text, ['Engine Serial No.', 'Engine Serial']) ||
    text.match(/Engine Name Plate[^\n]*\(?(SN\.?\s*[A-Z0-9.-]+)/i)?.[1] ||
    '';
  p.failurePartLocation =
    fieldAfterLabel(text, ['Failure Part Location']) ||
    text.match(/Failure Part Location\s*\(([^)]+)\)/i)?.[1] ||
    '';

  const labour = text.match(/Labour[\s\S]{0,80}?(\d+(?:[.,]\d+)?)\s*(?:hr|hrs)?/i);
  p.labourHrs = labour ? parseHourMeter(labour[1]) : null;

  const mileage = text.match(/Mileage(?!\s*To)[\s\S]{0,40}?(\d+(?:[.,]\d+)?)/i);
  p.mileageKm = mileage ? parseHourMeter(mileage[1]) : null;

  const toSite =
    text.match(/Mileage To Site\s*=?\s*(\d+(?:[.,]\d+)?)/i) ||
    text.match(/Milage To Site\s*=?\s*(\d+(?:[.,]\d+)?)/i);
  p.mileageToSite = toSite ? parseHourMeter(toSite[1]) : null;

  const partsTotalLine = text.match(/PARTS\s+TOTAL[\s\t]*([^\n\r]+)/i);
  p.partsTotal = partsTotalLine ? parseCellMoney(partsTotalLine[1]) : null;

  const totalLine = text.match(/TOTAL\s+AMOUNT\s+CLAIMED[\s\t]*([^\n\r]+)/i);
  p.totalAmount = totalLine ? parseCellMoney(totalLine[1]) : null;

  p.distributorNo = fieldAfterLabel(text, ['Distributor No:', 'Distributor No.']);

  return p;
}
