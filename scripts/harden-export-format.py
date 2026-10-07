from pathlib import Path

# The native ExcelJS exporter in scripts/fix-export-format.py is canonical.
# This hardener is intentionally non-destructive: it must never rewrite a
# working native-table exporter with the old SheetJS implementation.
INDEX = Path("index.html")
text = INDEX.read_text(encoding="utf-8")

if "ExcelJS" in text and "addTable" in text:
    print("Native ExcelJS table exporter detected; hardener skipped.")
else:
    print("Native exporter not present; no destructive fallback is applied.")
