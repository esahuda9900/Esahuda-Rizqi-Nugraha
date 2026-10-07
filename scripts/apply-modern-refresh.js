const fs = require('fs');
const path = require('path');

const root = process.cwd();
const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'styles', 'sdlg-modern-refresh.css');
const commandCenterCssPath = path.join(root, 'styles', 'sdlg-command-center-v2.css');
const compactClaimDetailCssPath = path.join(root, 'styles', 'sdlg-compact-claim-detail-v1.css');
const saasShellCssPath = path.join(root, 'styles', 'sdlg-saas-shell-v1.css');
const saasDarkCssPath = path.join(root, 'styles', 'sdlg-saas-dark-v1.css');
const opsCleanCssPath = path.join(root, 'styles', 'sdlg-ops-clean-v1.css');
let source = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const commandCenterCss = fs.readFileSync(commandCenterCssPath, 'utf8');
const compactClaimDetailCss = fs.readFileSync(compactClaimDetailCssPath, 'utf8');
const saasShellCss = fs.readFileSync(saasShellCssPath, 'utf8');
const saasDarkCss = fs.readFileSync(saasDarkCssPath, 'utf8');
const opsCleanCss = fs.existsSync(opsCleanCssPath) ? fs.readFileSync(opsCleanCssPath, 'utf8') : '';

const marker = 'SDLG_MODERN_REFRESH_V11';
const styleBlock = new RegExp(
  '<!-- SDLG_MODERN_REFRESH_V[0-9]+ -->\\s*<style data-sdlg-modern-refresh>[\\s\\S]*?<\\/style>',
  'i'
);
const style = `<!-- ${marker} -->\n<style data-sdlg-modern-refresh>\n${css}\n\n${commandCenterCss}\n\n${compactClaimDetailCss}\n\n${saasShellCss}\n\n${saasDarkCss}\n\n${opsCleanCss}\n</style>`;

let patched = source.replace(styleBlock, style);
if (patched === source && !source.includes(marker)) {
  const head = '</head>';
  const pos = source.toLowerCase().indexOf(head);
  if (pos >= 0) patched = source.slice(0, pos) + style + '\n' + source.slice(pos);
  else patched = source + '\n' + style;
}

// Ensure external ops-clean stylesheet link exists (cascade + CF static assets).
if (!patched.includes('styles/sdlg-ops-clean-v1.css')) {
  const linkTag = '<link rel="stylesheet" href="styles/sdlg-ops-clean-v1.css" data-sdlg-ops-clean="1" />\n';
  if (patched.includes('styles/sdlg-responsive.css')) {
    patched = patched.replace(
      '<link rel="stylesheet" href="styles/sdlg-responsive.css" />',
      '<link rel="stylesheet" href="styles/sdlg-responsive.css" />\n' + linkTag
    );
  } else if (patched.includes('styles/sdlg-modern-refresh.css')) {
    patched = patched.replace(
      '<link rel="stylesheet" href="styles/sdlg-modern-refresh.css" />',
      '<link rel="stylesheet" href="styles/sdlg-modern-refresh.css" />\n' + linkTag
    );
  }
}

const themeScriptFixed = `<script data-sdlg-theme-boot>
    (function(){
      var KEY='sdlg-theme';
      var root=document.documentElement;
      var buttons=document.querySelectorAll('[data-sdlg-theme]');
      function setTheme(theme){
        theme = theme === 'dark' ? 'dark' : 'light';
        root.dataset.theme = theme;
        try { localStorage.setItem(KEY, theme); } catch (e) {}
        buttons.forEach(function(button){
          button.setAttribute('aria-pressed', String(button.dataset.sdlgTheme === theme));
        });
      }
      buttons.forEach(function(button){
        button.addEventListener('click', function(){ setTheme(button.dataset.sdlgTheme); });
      });
      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (e) {}
      if (saved !== 'dark' && saved !== 'light') {
        saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      setTheme(saved);
    })();
  </script>`;

// Replace any prior theme boot or legacy force-light script
const themeBootRe = /<script(?:\s+data-sdlg-theme-boot)?>(\s*\(function\(\)\{\s*var (?:KEY|root)=[\s\S]*?setTheme\([^)]*\);[\s\S]*?\}\)\(\);\s*)<\/script>/i;
if (themeBootRe.test(patched)) {
  patched = patched.replace(themeBootRe, themeScriptFixed);
} else if (!patched.includes('data-sdlg-theme-boot')) {
  const bodyClose = patched.toLowerCase().lastIndexOf('</body>');
  if (bodyClose >= 0) {
    patched = patched.slice(0, bodyClose) + themeScriptFixed + '\n' + patched.slice(bodyClose);
  }
}

if (patched === source) {
  console.log('Modern refresh already current; no change.');
  process.exit(0);
}

fs.writeFileSync(htmlPath, patched);
console.log('Applied SDLG modern refresh v11 + ops-clean final layer + persistent theme.');
