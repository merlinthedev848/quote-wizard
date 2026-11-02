import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8082;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Disallow serving internal server/config/test files over HTTP
const BLOCKED_PREFIXES = ['.git', '.env', 'node_modules', 'test', 'server.js', 'package.json', 'package-lock.json'];

function serveFile(filePath, req, res) {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        res.end('500 Internal Server Error');
      }
      return;
    }

    if (stats.isDirectory()) {
      serveFile(path.join(filePath, 'index.html'), req, res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Last-Modified': stats.mtime.toUTCString(),
      ...SECURITY_HEADERS
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    res.writeHead(200, headers);
    stream.pipe(res);

    const abortStream = () => {
      if (!stream.destroyed && !stream.readableEnded) stream.destroy();
    };
    res.on('close', abortStream);

    stream.on('error', () => {
      abortStream();
      if (res.writableEnded) return;
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        res.end('500 Server Stream Error');
        return;
      }
      res.destroy();
    });
  });
}

const server = http.createServer((req, res) => {
  // Only allow GET and HEAD requests for static file serving
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD', ...SECURITY_HEADERS });
    res.end('405 Method Not Allowed');
    return;
  }

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const decodedPathname = decodeURIComponent(parsedUrl.pathname);
    const pathname = decodedPathname === '/' ? '/index.html' : decodedPathname;

    // Resolve full path and strictly enforce root directory boundary
    const filePath = path.resolve(__dirname, '.' + pathname);
    const relative = path.relative(__dirname, filePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      res.end('403 Forbidden');
      return;
    }

    const topSegment = relative.split(path.sep)[0];
    if ( topSegment.startsWith('.') || BLOCKED_PREFIXES.includes(topSegment) ) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      res.end('403 Forbidden');
      return;
    }

    serveFile(filePath, req, res);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end('400 Bad Request');
  }
});

server.listen(PORT, () => {
  console.log(`[Quote-Wizard] Server running securely at http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
