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

    // 1. Bikin Tabel Utama (TableStyleMedium2 = Zebra Stripes)
    const table = ws.addTable({
      name: name || 'DataTable',
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
    table.commit();

    // 2. Set View (Freeze Header + Freeze Kolom Pertama)
    ws.views = [{ 
      state: 'frozen', 
      ySplit: 1, 
      xSplit: 1, // Freeze kolom pertama (biasanya ID)
      showGridLines: false 
    }];
    
    ws.autoFilter = { from: 'A1', to: `${endCol}1` };

    // 3. Style Header (Biru Navy & Teks Putih)
    ws.getRow(1).height = 32;
    ws.getRow(1).eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
      cell.border = { 
        bottom: { style: 'medium', color: { argb: 'FF0F2744' } },
        right: { style: 'thin', color: { argb: 'FF2A4B7C' } }
      };
    });

    // 4. Loop Data: Auto-Style & Format
    for (let c = 1; c <= colCount; c++) {
      const headerText = String(ws.getCell(1, c).value || '').toLowerCase();
      const column = ws.getColumn(c);
      let maxLen = 10; // Minimal lebar 10

      for (let r = 2; r <= endRow; r++) {
        const cell = ws.getCell(r, c);
        const val = cell.value;

        // Hitung panjang maksimal untuk Auto-Width
        if (val != null) {
          const len = String(val).length;
          if (len > maxLen) maxLen = len;
        }

        // Styling Dasar
        cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF1F2937' } };
        cell.alignment = { vertical: 'top', wrapText: false };

        // ─── AUTO FORMAT (Rupiah & Tanggal) ───
        if (typeof val === 'number') {
          if (/amount|total|price|biaya|rp|nominal|value/i.test(headerText)) {
            cell.numFmt = '"Rp" #,##0'; 
            cell.alignment = { vertical: 'top', horizontal: 'right' }; // Rata kanan buat duit
          } else if (/qty|quantity|count|jumlah|hari|days|aging/i.test(headerText)) {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'top', horizontal: 'center' };
          }
        } else if (typeof val === 'string' && /date|tanggal|tgl/i.test(headerText)) {
          // Deteksi string tanggal sederhana
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            cell.value = d;
            cell.numFmt = 'DD-MMM-YYYY';
            cell.alignment = { vertical: 'top', horizontal: 'center' };
          }
        }

        // ─── CONDITIONAL FORMATTING (Warna Status) ───
        if (/status|state|result|hasil/i.test(headerText) && typeof val === 'string') {
          const v = val.toLowerCase();
          if (/reject|gagal|fail|batal|cancel/i.test(v)) {
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF991B1B' } }; // Merah
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          } else if (/approve|success|berhasil|done|closed|paid/i.test(v)) {
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF166534' } }; // Hijau
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          } else if (/pending|hold|wait|tunggu|draft/i.test(v)) {
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF92400E' } }; // Kuning/Amber
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          }
        }
      }

      // Set Auto-Width (Maksimal 50 biar gak terlalu lebar)
      column.width = Math.min(maxLen + 4, 50);
    }

    return endRow;
  }

  // Export (Immutable)
  window.SDLGExportTableHelper = Object.freeze({ 
    version: '2.0.0',
    styleTable 
  });

})();