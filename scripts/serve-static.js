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
  console.log(`Static legacy portal server listening on http://${host}:${port}`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
