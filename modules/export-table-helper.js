(function () {
  'use strict';

  // Extracted from the canonical ExcelJS exporter without changing behavior.
  function styleTable(ws, rowCount, colCount, name) {
    const colLetter = (n) => {
      let s = '';
      while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };

    const endCol = colLetter(colCount);
    const endRow = rowCount + 1;
    const t = ws.addTable({
      name,
      ref: `A1:${endCol}${endRow}`,
      headerRow: true,
      totalsRow: false,
      columns: Array.from({ length: colCount }, (_, i) => ({
        name: String(ws.getCell(1, i + 1).value ?? '').trim() || `Column ${i + 1}`
      })),
      rows: Array.from({ length: rowCount }, (_, r) =>
        Array.from({ length: colCount }, (_, c) => ws.getCell(r + 2, c + 1).value)
      ),
      style: { theme: 'TableStyleMedium2', showRowStripes: true }
    });
    t.commit();

    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, showGridLines: false }];
    ws.autoFilter = { from: 'A1', to: `${endCol}1` };
    ws.getRow(1).height = 30;
    ws.getRow(1).eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF0F2744' } } };
    });

    for (let r = 2; r <= endRow; r++) {
      const row = ws.getRow(r);
      row.eachCell((cell) => {
        cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF1F2937' } };
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    }

    return endRow;
  }

  window.SDLGExportTableHelper = Object.freeze({ styleTable });
})();
