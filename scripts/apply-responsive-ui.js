const fs=require('fs');
const path=require('path');
const f=path.join(process.cwd(),'index.html');
let h=fs.readFileSync(f,'utf8');
const css=fs.readFileSync(path.join(process.cwd(),'styles','sdlg-responsive.css'),'utf8');

// Remove all historical responsive/runtime injectors. The mobile CSS is the
// source of truth; imperative row rewriting was causing valid flex/grid layouts
// and controls to collapse on mobile.
h=h.replace(/<!--\s*SDLG_RESPONSIVE_UI_V[0-9]+\s*--><style[^>]*data-sdlg-responsive-v[0-9]+[^>]*>[\s\S]*?<\/style>/gi,'')
 .replace(/<!--\s*SDLG_MOBILE_CLAIM_RUNTIME_V[0-9]+\s*--><script[^>]*data-sdlg-mobile-claim-v[0-9]+[^>]*>[\s\S]*?<\/script>/gi,'');

// Android Chrome needs an explicit viewport. Without it, the mobile layout
// viewport can behave like a ~980px desktop canvas, so the max-width:760px
// responsive rules never activate and the claims header overflows.
if(!/<meta[^>]+name=["']viewport["'][^>]*>/i.test(h)){
  h=h.replace(/<head[^>]*>/i, match => match+'\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
}

// Keep one deterministic responsive stylesheet injection for the monolithic
// production HTML. No MutationObserver/runtime DOM rewriting is injected.
const marker='SDLG_RESPONSIVE_UI_V10';
const style=`<!-- ${marker} --><style data-sdlg-responsive-v10>${css}</style>`;
h=h.replace(/<\/head>/i,style+'\n</head>');

fs.writeFileSync(f,h);
console.log('Responsive mobile CSS applied; viewport meta ensured; destructive mobile runtime disabled.');
