const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 3000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const previewDist = path.resolve(root, 'apps', 'web', 'dist');

if (!fs.existsSync(previewDist) || !fs.existsSync(path.resolve(previewDist, 'index.html'))) {
  try {
    const { execSync } = require('node:child_process');
    console.log('Building React preview app (apps/web)...');
    execSync('npm --prefix apps/web run build', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to build apps/web:', err);
  }
}

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(root, `.${requested}`);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

const bannerHtml = `
<div id="preview-switch-banner" style="background:#1d4ed8;color:#ffffff;padding:10px 16px;text-align:center;font-size:13px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;position:relative;z-index:99999;box-shadow:0 2px 6px rgba(0,0,0,0.15)">
  <span>🚀 <strong>Web Baru SDLG (React SPA):</strong> Siap diuji di rute preview</span>
  <a href="/preview/" style="background:#fde047;color:#1e3a8a;padding:4px 12px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px">Buka React Preview →</a>
</div>`;

const server = http.createServer((request, response) => {
  const rawUrl = request.url || '/';
  const pathname = decodeURIComponent(rawUrl.split('?')[0]);

  // Redirect /preview to /preview/
  if (pathname === '/preview' || pathname === '/Esahuda-Rizqi-Nugraha/preview') {
    response.writeHead(302, { Location: '/preview/' });
    response.end();
    return;
  }

  // Handle React preview SPA
  const isPreview = pathname.startsWith('/preview/') || pathname.startsWith('/Esahuda-Rizqi-Nugraha/preview/');
  if (isPreview) {
    const subPath = pathname.replace(/^(\/Esahuda-Rizqi-Nugraha)?\/preview/, '') || '/';
    const cleanSub = subPath === '/' ? '/index.html' : subPath;
    let target = path.resolve(previewDist, `.${cleanSub}`);

    if (!target.startsWith(previewDist + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      // SPA fallback to preview index.html
      target = path.resolve(previewDist, 'index.html');
    }

    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      response.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(target).pipe(response);
      return;
    }
  }

  // Handle preview assets if requested directly
  if (pathname.startsWith('/assets/') || pathname.startsWith('/Esahuda-Rizqi-Nugraha/assets/')) {
    const cleanAsset = pathname.replace(/^(\/Esahuda-Rizqi-Nugraha)?/, '');
    const assetTarget = path.resolve(previewDist, `.${cleanAsset}`);
    if (assetTarget.startsWith(previewDist + path.sep) && fs.existsSync(assetTarget) && fs.statSync(assetTarget).isFile()) {
      response.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': mimeTypes[path.extname(assetTarget).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(assetTarget).pipe(response);
      return;
    }
  }

  // Handle legacy production files
  const filePath = safePath(rawUrl);
  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    // In dev server, inject preview banner into legacy index.html so users can easily test React preview
    if (filePath.endsWith('index.html')) {
      fs.readFile(filePath, 'utf8', (readErr, content) => {
        if (readErr) {
          response.writeHead(500, { 'Content-Type': 'text/plain' });
          response.end('Error loading page');
          return;
        }
        const modified = content.replace('<body>', '<body>' + bannerHtml);
        response.writeHead(200, {
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(modified);
      });
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    process.exit(1);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Static preview server listening on port ${port}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
