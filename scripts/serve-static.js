const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

let port = 3000;
if (process.env.PORT) {
  const parsedPort = parseInt(process.env.PORT, 10);
  if (!isNaN(parsedPort) && parsedPort > 0) {
    port = parsedPort;
  }
}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    const parsedPort = parseInt(process.argv[i + 1], 10);
    if (!isNaN(parsedPort) && parsedPort > 0) {
      port = parsedPort;
    }
  }
}

let host = '0.0.0.0';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--host' && process.argv[i + 1]) {
    host = process.argv[i + 1];
  }
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

const previewDist = path.resolve(root, 'apps', 'web', 'dist');
let isBuilding = false;

function ensurePreviewBuilt() {
  if (fs.existsSync(path.resolve(previewDist, 'index.html'))) {
    return;
  }
  if (isBuilding) return;
  isBuilding = true;
  console.log('Building React preview app (apps/web) in background...');
  const { exec } = require('node:child_process');
  exec('npm --prefix apps/web run build', (err) => {
    isBuilding = false;
    if (err) {
      console.error('Failed to build apps/web:', err);
    } else {
      console.log('React preview app (apps/web) build ready.');
    }
  });
}

function safePath(urlPath) {
  try {
    const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
    const requested = pathname === '/' ? '/index.html' : pathname;
    const resolved = path.resolve(root, `.${requested}`);
    return resolved.startsWith(root + path.sep) ? resolved : null;
  } catch {
    return null;
  }
}

function streamFile(targetPath, response, isHead) {
  const ext = path.extname(targetPath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.stat(targetPath, (err, stats) => {
    if (err || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'X-Content-Type-Options': 'nosniff',
    });

    if (isHead) {
      response.end();
      return;
    }

    const stream = fs.createReadStream(targetPath);
    stream.on('error', (streamErr) => {
      console.error('Stream error:', streamErr);
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      response.end();
    });

    response.on('close', () => {
      stream.destroy();
    });

    stream.pipe(response);
  });
}

const bannerHtml = `
<div id="preview-switch-banner" style="background:#1d4ed8;color:#ffffff;padding:10px 16px;text-align:center;font-size:13px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;position:relative;z-index:99999;box-shadow:0 2px 6px rgba(0,0,0,0.15)">
  <span>🚀 <strong>Web Baru SDLG (React SPA):</strong> Siap diuji di rute preview</span>
  <a href="/preview/" style="background:#fde047;color:#1e3a8a;padding:4px 12px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px">Buka React Preview →</a>
</div>`;

const server = http.createServer((request, response) => {
  const rawUrl = request.url || '/';
  const isHead = request.method === 'HEAD';
  let pathname = '/';
  try {
    pathname = decodeURIComponent(rawUrl.split('?')[0]);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain' });
    response.end('Bad Request');
    return;
  }

  // Health checks
  if (pathname === '/healthz' || pathname === '/_health' || pathname === '/ping') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('OK');
    return;
  }

  // Redirect /preview to /preview/
  if (pathname === '/preview' || pathname === '/Esahuda-Rizqi-Nugraha/preview') {
    response.writeHead(302, { Location: '/preview/' });
    response.end();
    return;
  }

  // Handle React preview SPA
  const isPreview = pathname.startsWith('/preview/') || pathname.startsWith('/Esahuda-Rizqi-Nugraha/preview/');
  if (isPreview) {
    if (!fs.existsSync(previewDist) || !fs.existsSync(path.resolve(previewDist, 'index.html'))) {
      ensurePreviewBuilt();
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html><head><meta http-equiv="refresh" content="2"><title>Loading Preview...</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 24px;"><h2>Menyiapkan React Preview...</h2><p style="color:#64748b;">Halaman akan dimuat otomatis dalam beberapa detik.</p></body></html>`);
      return;
    }

    const subPath = pathname.replace(/^(\/Esahuda-Rizqi-Nugraha)?\/preview/, '') || '/';
    const cleanSub = subPath === '/' ? '/index.html' : subPath;
    let target = path.resolve(previewDist, `.${cleanSub}`);

    if (!target.startsWith(previewDist + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      target = path.resolve(previewDist, 'index.html');
    }

    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      streamFile(target, response, isHead);
      return;
    }
  }

  // Handle preview assets if requested directly
  if (pathname.startsWith('/assets/') || pathname.startsWith('/Esahuda-Rizqi-Nugraha/assets/')) {
    const cleanAsset = pathname.replace(/^(\/Esahuda-Rizqi-Nugraha)?/, '');
    const assetTarget = path.resolve(previewDist, `.${cleanAsset}`);
    if (assetTarget.startsWith(previewDist + path.sep) && fs.existsSync(assetTarget) && fs.statSync(assetTarget).isFile()) {
      streamFile(assetTarget, response, isHead);
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

    // In dev server, inject preview banner into legacy index.html and app.html
    if (filePath.endsWith('index.html') || filePath.endsWith('app.html')) {
      fs.readFile(filePath, 'utf8', (readErr, content) => {
        if (readErr) {
          response.writeHead(500, { 'Content-Type': 'text/plain' });
          response.end('Error loading page');
          return;
        }
        const modified = content.replace('<body>', '<body>' + bannerHtml);
        const buffer = Buffer.from(modified, 'utf-8');
        response.writeHead(200, {
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': buffer.length,
          'X-Content-Type-Options': 'nosniff',
        });
        if (isHead) {
          response.end();
        } else {
          response.end(buffer);
        }
      });
      return;
    }

    streamFile(filePath, response, isHead);
  });
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    process.exit(1);
  }
});

server.listen(port, host, () => {
  console.log(`Static preview server listening on http://${host}:${port}`);
});

ensurePreviewBuilt();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
