from pathlib import Path

# The professional exporter is authored by scripts/fix-export-format.py.
# This legacy finalizer used to rewrite it with SheetJS-only styling, which
# produced a technically valid but visually plain workbook. Keep this step
# intentionally non-destructive so the final export cannot regress.
INDEX = Path('index.html')
text = INDEX.read_text(encoding='utf-8')

if 'async function exportToExcel(claims)' in text and 'loadExcelJS' in text and 'ExcelJS' in text:
    print('Professional ExcelJS exporter detected; legacy finalizer skipped.')
else:
    print('Legacy finalizer skipped; fix-export-format.py owns the export implementation.')
