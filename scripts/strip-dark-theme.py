#!/usr/bin/env python3
"""Strip all dark-theme CSS/HTML from SDLG production frontend. Light-only."""
from pathlib import Path
import re

def strip_prefers_dark_blocks(text):
    out = []
    i = 0
    pattern = re.compile(r'@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{', re.I)
    while True:
        m = pattern.search(text, i)
        if not m:
            out.append(text[i:])
            break
        out.append(text[i:m.start()])
        depth = 0
        j = m.end() - 1
        while j < len(text):
            if text[j] == '{':
                depth += 1
            elif text[j] == '}':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        i = j
    return ''.join(out)

def strip_data_theme_dark_rules(text):
    out = text
    sel_re = re.compile(r'(?:html)?\[data-theme=["\']dark["\']\][^{]*\{', re.I)
    while True:
        m = sel_re.search(out)
        if not m:
            break
        depth = 0
        j = m.end() - 1
        while j < len(out):
            if out[j] == '{':
                depth += 1
            elif out[j] == '}':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        out = out[:m.start()] + out[j:]
    return out

def strip_theme_switcher_rules(text):
    while True:
        m = re.search(r'\.sdlg-theme-switcher[^{]*\{', text)
        if not m:
            break
        depth = 0
        j = m.end() - 1
        while j < len(text):
            if text[j] == '{':
                depth += 1
            elif text[j] == '}':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        text = text[:m.start()] + text[j:]
    return text

def force_light_scheme(text):
    text = re.sub(r'color-scheme\s*:\s*light\s+dark\s*;', 'color-scheme: light;', text)
    text = re.sub(r'color-scheme\s*:\s*dark\s*;', 'color-scheme: light;', text)
    return text

def main():
    changed = []
    styles = Path('styles')
    if styles.is_dir():
        for path in sorted(styles.glob('*.css')):
            raw = path.read_text(encoding='utf-8', errors='replace')
            new = force_light_scheme(strip_theme_switcher_rules(
                strip_data_theme_dark_rules(strip_prefers_dark_blocks(raw))))
            if new != raw:
                path.write_text(new, encoding='utf-8')
                changed.append(str(path))
                print('patched', path)

    app = Path('app.html')
    if app.exists():
        html = app.read_text(encoding='utf-8', errors='replace')
        orig = html
        html = re.sub(r'<script\s+data-sdlg-theme-boot>[\s\S]*?</script>\s*', '', html, flags=re.I)
        html = re.sub(r'<div\s+class="sdlg-theme-switcher"[^>]*>[\s\S]*?</div>\s*', '', html, flags=re.I)

        def fix_html_tag(m):
            attrs = re.sub(r'\s*data-theme="[^"]*"', '', m.group(1))
            return '<html' + attrs + ' data-theme="light">'
        html = re.sub(r'<html([^>]*)>', fix_html_tag, html, count=1, flags=re.I)

        light_css = (
            '<style id="sdlg-light-only">\n'
            '  /* HARD LIGHT-ONLY — dark theme removed 2026-10-30 */\n'
            '  :root, html, body { color-scheme: light !important; }\n'
            '  .sdlg-theme-switcher { display: none !important; }\n'
            '  @media (prefers-color-scheme: dark) {\n'
            '    :root, html {\n'
            '      --sdlg-bg: #f3f6fa !important;\n'
            '      --sdlg-surface: #ffffff !important;\n'
            '      --sdlg-surface-muted: #f8fafc !important;\n'
            '      --sdlg-border: #e2e8f0 !important;\n'
            '      --sdlg-border-strong: #cbd5e1 !important;\n'
            '      --sdlg-text: #0f172a !important;\n'
            '      --sdlg-text-muted: #64748b !important;\n'
            '      --sdlg-muted: #64748b !important;\n'
            '      --ui-bg: #eef1f7 !important;\n'
            '      --ui-surface: #ffffff !important;\n'
            '      --ui-text: #0c1526 !important;\n'
            '      --ui-muted: #5a6578 !important;\n'
            '      --ui-glass: rgba(255,255,255,0.75) !important;\n'
            '      --ui-glass-strong: rgba(255,255,255,0.96) !important;\n'
            '    }\n'
            '  }\n'
            '</style>\n'
        )
        if 'sdlg-light-only' not in html and '</head>' in html:
            html = html.replace('</head>', light_css + '</head>', 1)

        html = force_light_scheme(strip_theme_switcher_rules(
            strip_data_theme_dark_rules(strip_prefers_dark_blocks(html))))

        if html != orig:
            app.write_text(html, encoding='utf-8')
            changed.append('app.html')
            print('patched app.html')

    readme = Path('styles/README.md')
    if readme.exists():
        t = readme.read_text(encoding='utf-8')
        if 'light-only' not in t.lower() and 'Light only' not in t:
            t = t.rstrip() + '\n\n## Theme\n\n**Light only.** Dark theme removed 2026-10-30 (OS preference ignored).\n'
            readme.write_text(t, encoding='utf-8')
            changed.append('styles/README.md')

    print('CHANGED', len(changed))
    for c in changed:
        print(' -', c)

if __name__ == '__main__':
    main()
