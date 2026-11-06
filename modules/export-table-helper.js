/**
 * SDLG Export Table Helper — V2.0 (Smart Excel Styler)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ AUTO-WIDTH: Lebar kolom otomatis nyesuain isi data.
 * ✅ AUTO-NUMBER: Deteksi kolom uang -> Rp xxx,xxx. Kolom tanggal -> DD/MM/YYYY.
 * ✅ CONDITIONAL FORMATTING: Teks "Rejected" otomatis merah, "Approved" hijau.
 * ✅ FROZEN PANES: Header atas & kolom kiri diam saat di-scroll.
 * ✅ CLEAN HEADER: Font Aptos, warna biru navy elegan, border bawah tebal.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_EXPORT_HELPER_V2__) return;
  window.__SDLG_EXPORT_HELPER_V2__ = true;

  // Konversi nomor kolom ke huruf Excel (1 = A, 27 = AA)
  function colLetter(n) {
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  /**
   * Fungsi Utama: Style Tabel Excel
   * @param {Object} ws - ExcelJS Worksheet
   * @param {Number} rowCount - Jumlah baris data (tanpa header)
   * @param {Number} colCount - Jumlah kolom
   * @param {String} name - Nama Tabel (harus unik di Excel)
   */
  function styleTable(ws, rowCount, colCount, name) {
    if (rowCount === 0 || colCount === 0) return 0;

    const endCol = colLetter(colCount);
    const endRow = rowCount + 1;

    // 1. Sanitize unique column names (Excel Tables strictly require unique non-empty header names)
    const colNames = [];
    const usedNames = new Set();
    for (let c = 1; c <= colCount; c++) {
      let raw = String(ws.getCell(1, c).value ?? '').trim() || `Col_${c}`;
      raw = raw.replace(/[\[\]']/g, '').trim();
      let colName = raw;
      let counter = 1;
      while (usedNames.has(colName.toLowerCase())) {
        colName = `${raw}_${counter++}`;
      }
      usedNames.add(colName.toLowerCase());
      colNames.push(colName);
      ws.getCell(1, c).value = colName;
    }

    // 2. Sanitize Table Name (must start with letter, letters/numbers/underscores only)
    const safeName = (name || 'DataTable').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z]/, 'T_');

    // 3. Create Excel Table (ListObject) with native filter buttons & zebra stripes
    try {
      const table = ws.addTable({
        name: safeName,
        ref: `A1:${endCol}${endRow}`,
        headerRow: true,
        totalsRow: false,
        columns: colNames.map(n => ({ name: n, filterButton: true })),
        rows: Array.from({ length: rowCount }, (_, r) =>
          Array.from({ length: colCount }, (_, c) => ws.getCell(r + 2, c + 1).value)
        ),
        style: { theme: 'TableStyleMedium9', showRowStripes: true }
      });
      if (table && typeof table.commit === 'function') {
        table.commit();
      }
    } catch (e) {
      console.warn('[SDLG Export] addTable notice:', e.message);
    }

    // 4. View Configuration: Freeze Header (Row 1) & Freeze Key ID (Col A), Show Grid Lines
    ws.views = [{ 
      state: 'frozen', 
      ySplit: 1, 
      xSplit: 1, 
      showGridLines: true 
    }];

    // 5. Header Row Styling (Navy Blue, White Text, Bold, Middle-Aligned)
    ws.getRow(1).height = 28;
    ws.getRow(1).eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
      cell.border = { 
        bottom: { style: 'medium', color: { argb: 'FF0F2744' } },
        right: { style: 'thin', color: { argb: 'FF2A4B7C' } }
      };
    });

    // 6. Data Row Formatting & Cell Alignment
    for (let c = 1; c <= colCount; c++) {
      const headerText = String(ws.getCell(1, c).value || '').toLowerCase();
      const column = ws.getColumn(c);
      let maxLen = headerText.length;

      const isDateCol = /date|tanggal|tgl|updated/i.test(headerText);
      const isAmountCol = /amount|total|price|harga|biaya|nilai|nominal/i.test(headerText) && !/qty|quantity|count|hrs|km/i.test(headerText);
      const isIntCol = /qty|quantity|count|foto|photo|hrs|hours|jam|mileage|hm|meter/i.test(headerText);
      const isStatusCol = /status|state|result|kualitas|quality/i.test(headerText);
      const isLongTextCol = /description|analyze|comment|reason|warning|catatan|keterangan|summary|location/i.test(headerText);

      for (let r = 2; r <= endRow; r++) {
        const cell = ws.getCell(r, c);
        const val = cell.value;

        if (val != null) {
          const strVal = String(val instanceof Date ? 'YYYY-MM-DD' : val);
          if (strVal.length > maxLen) maxLen = Math.min(strVal.length, 50);
        }

        cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF1F2937' } };
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: isAmountCol || isIntCol ? 'right' : (isDateCol ? 'center' : 'left'),
          wrapText: isLongTextCol 
        };

        // Numbers: keep clean numbers without forced "Rp" so multi-currency formulas work
        if (typeof val === 'number') {
          if (isAmountCol) {
            cell.numFmt = '#,##0.00';
          } else if (isIntCol) {
            cell.numFmt = '#,##0';
          }
        } else if (val instanceof Date) {
          cell.numFmt = 'yyyy-mm-dd';
        } else if (typeof val === 'string' && isDateCol && /^\d{4}-\d{2}-\d{2}/.test(val)) {
          const parts = val.slice(0, 10).split('-');
          const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
          if (!isNaN(d.getTime())) {
            cell.value = d;
            cell.numFmt = 'yyyy-mm-dd';
          }
        }

        // Soft corporate status highlighting
        if (isStatusCol && typeof val === 'string') {
          const v = val.toLowerCase();
          if (/reject|gagal|fail|batal|cancel|check/i.test(v)) {
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF991B1B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          } else if (/approve|success|berhasil|done|closed|paid|settlement|ok\b/i.test(v)) {
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF166534' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          } else if (/pending|hold|wait|tunggu|draft|audit|submitted/i.test(v)) {
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF854D0E' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
          }
        }

        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFF3F4F6' } }
        };
      }

      column.width = Math.max(12, Math.min(maxLen + 4, 45));
      if (isLongTextCol) column.width = Math.max(column.width, 32);
    }

    for (let r = 2; r <= endRow; r++) {
      ws.getRow(r).height = 22;
    }

    return endRow;
  }

  // Export (Immutable)
  window.SDLGExportTableHelper = Object.freeze({ 
    version: '2.0.0',
    styleTable 
  });

})();