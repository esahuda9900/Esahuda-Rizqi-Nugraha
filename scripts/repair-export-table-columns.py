from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old = "columns:ws.getRow(1).values.slice(1).map(v=>({name:String(v??'')}))"
new = "columns:Array.from({length:colCount},(_,i)=>{const v=ws.getCell(1,i+1).value;return {name:String(v??'').trim()||`Column ${i+1}`};})"

if old not in s:
    # Also handle spacing variants produced by earlier exporter patches.
    s2, n = re.subn(
        r"columns:\s*ws\.getRow\(1\)\.values\.slice\(1\)\.map\(v=>\(\{name:String\(v\?\?['\"]['\"]\)\}\)\)",
        new,
        s,
        count=1,
    )
    if n == 0:
        raise SystemExit('Expected ExcelJS table column definition expression was not found; refusing to modify index.html')
    s = s2
else:
    s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('Repaired ExcelJS table columns with a guaranteed colCount-sized definition array.')
