import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const ETA_WORK = path.resolve(__dirname, '..', 'ETA Work');
const PORT = 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const ALLOWED_ROOTS = [PUBLIC, ETA_WORK];

function notFound(res, msg) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(msg || 'Not found');
}

function serveFile(res, filePath) {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat || !stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': type };

  // PDFs should display in the browser tab, not download.
  if (ext === '.pdf') {
    headers['Content-Disposition'] = 'inline';
  }
  // DOCX is served raw so the preview page can fetch it.
  if (ext === '.docx') {
    headers['Content-Disposition'] = 'inline; filename="' + path.basename(filePath) + '"';
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function safePath(root, rel) {
  const target = path.normalize(path.join(root, rel));
  if (!target.startsWith(root + path.sep) && target !== root) return null;
  return target;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/hive') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ projects: [], tasks: [], fetchedAt: new Date().toISOString() }));
    return;
  }

  let filePath = null;

  if (pathname.startsWith('/files/')) {
    const rel = pathname.slice('/files/'.length);
    filePath = safePath(ETA_WORK, rel);
  } else {
    if (pathname.endsWith('/')) pathname += 'index.html';
    filePath = safePath(PUBLIC, pathname);
  }

  if (!filePath) return notFound(res, 'Forbidden');
  if (serveFile(res, filePath)) return;

  // If the path is a directory without a trailing slash, try index.html inside it.
  const dirStat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (dirStat && dirStat.isDirectory()) {
    const index = path.join(filePath, 'index.html');
    if (serveFile(res, index)) return;
  }

  notFound(res, 'Not found: ' + pathname);
});

server.listen(PORT, () => {
  console.log('Comb local server running at http://127.0.0.1:' + PORT);
  console.log('Public root: ' + PUBLIC);
  console.log('ETA Work root: ' + ETA_WORK);
});
