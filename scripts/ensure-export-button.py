from pathlib import Path
INDEX = Path('index.html')
text = INDEX.read_text(encoding='utf-8')
marker = '// ─── HM ESTIMATION ENGINE'
if marker not in text:
    raise SystemExit('HM marker not found')
bridge = r'''// ─── Export button reliability bridge
window.exportToExcel = exportToExcel;
(function () {
    function wire() {
        document.querySelectorAll('button,[role="button"]').forEach(function (el) {
            var label = String(el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!label || label.indexOf('export') < 0 || label.indexOf('import') >= 0 || el.dataset.sdlgExportWired === '1') return;
            el.dataset.sdlgExportWired = '1';
            el.removeAttribute('disabled');
            el.removeAttribute('aria-disabled');
            el.style.pointerEvents = 'auto';
            el.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.exportToExcel();
            }, true);
        });
    }
    wire();
    new MutationObserver(wire).observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['disabled','aria-disabled']});
})();
'''
start = text.find('// ─── Export button reliability bridge')
if start >= 0:
    text = text[:start] + text[text.find(marker, start):]
text = text.replace(marker, bridge + '\n' + marker, 1)
INDEX.write_text(text, encoding='utf-8')
print('Export button bridge updated')
