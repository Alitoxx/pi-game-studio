#!/usr/bin/env node
/**
 * scripts/serve-web.js — Zero-dependency local static server for Web/WASM
 * Injects required Cross-Origin Isolation headers:
 * - Cross-Origin-Opener-Policy: same-origin
 * - Cross-Origin-Embedder-Policy: require-corp
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = parseInt(process.env.PORT || '8080', 10);
const WEB_DIR = path.resolve(__dirname, '../dist/web');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.bmp': 'image/bmp',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.css': 'text/css; charset=utf-8',
  '.data': 'application/octet-stream',
  '.pck': 'application/octet-stream'
};

if (!fs.existsSync(WEB_DIR)) {
  fs.mkdirSync(WEB_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  // Enforce Cross-Origin Isolation for SharedArrayBuffer / WASM multithreading
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Access-Control-Allow-Origin', '*');

  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(WEB_DIR, reqPath);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`File not found: ${reqPath}\nDid you run 'npm run build:web' first?`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════════════════════════╗');
    console.log('\x1b[36m%s\x1b[0m', '║      PI GAME STUDIO — LOCAL WEB / WASM DEV SERVER          ║');
    console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════════════════════════╝');
    console.log(`\x1b[32m✔ Serving directory:\x1b[0m ${WEB_DIR}`);
    console.log(`\x1b[32m✔ Local URL:\x1b[0m         \x1b[1mhttp://localhost:${PORT}\x1b[0m`);
    console.log('\x1b[33m✔ Headers injected:\x1b[0m  COOP=same-origin, COEP=require-corp (WASM threads ready)\n');
  });
}

module.exports = { server, PORT, WEB_DIR };
