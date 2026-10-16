import * as XLSX from 'xlsx';

/** Read first sheet of an Excel file into a paste-friendly text block. */
export async function excelFileToText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('File Excel tidak punya sheet');
  const sheet = wb.Sheets[sheetName];
  // TSV-like: labels and values stay on same lines for heuristic parser
  const text = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n', blankrows: false });
  return text;
}
