from pathlib import Path
INDEX = Path("index.html")
text = INDEX.read_text(encoding="utf-8")
old = "columns:Array.from({length:colCount},(_,i)=>{const v=ws.getCell(1,i+1).value;return {name:String(v??'').trim()||`Column ${i+1}`};})"
new = "columns:Array.from({length:colCount},(_,i)=>({name:String(ws.getCell(1,i+1).value??'').trim()||`Column ${i+1}`})),rows:Array.from({length:rowCount},(_,r)=>Array.from({length:colCount},(_,c)=>ws.getCell(r+2,c+1).value))"
if old in text:
    INDEX.write_text(text.replace(old,new,1), encoding="utf-8")
    print("ExcelJS table rows added")
else:
    print("No matching exporter patch target")
