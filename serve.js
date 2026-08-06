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
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
};

/* ---------- deep-hive vault: whitelisted HIVE roots + live tree scan ---------- */
const HIVE_ROOT = path.resolve(__dirname, '..');
const ROOT_WHITELIST = [
  'AI-Benchmark', 'Anialah', 'Backend Checklist', 'Boss-Questionnaire', 'Comb',
  'council-reports', 'Digital Brain', 'ETA Work', 'Football', 'Hand-Over central',
  'Hermes-Bridge', 'Million dollar 90 day plan', 'Notion-Access', 'Personal',
  'Praeto Office AI Portal', 'praeto-balance-app_2 (1)', 'Project Tech',
  'Stella Project', 'Stella@Glenwood Webapp', 'Tiespro proj', 'Video-Inbox',
  'fable-mode-main',
];
/* Directory names never indexed or served (case-insensitive). */
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.venv', '.venv-webtest', 'venv', '__pycache__',
  '.postgres', 'dist', 'build', '.cursor', '.obsidian', '.kimi-memory',
  'coverage', '.next', 'target', 'vendor',
]);
const SCAN_DEPTH = 4;   // from each project root; deeper files stay out of the static tree
const MAX_FILES = 200;  // per /api/tree response
const TREE_TTL_MS = 10000; // in-memory cache so OneDrive changes appear within seconds

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const ROOTS = {}; // id -> { id, label, dir }
for (const name of ROOT_WHITELIST) {
  const id = slugify(name);
  ROOTS[id] = { id, label: name, dir: path.join(HIVE_ROOT, name) };
}

function isExcludedDir(name) {
  const n = name.toLowerCase();
  return EXCLUDE_DIRS.has(n) || n.startsWith('_pdf-visual');
}
function isExcludedFile(name) {
  const n = name.toLowerCase();
  if (n === 'credentials.json') return true;
  if (n.includes('secret')) return true;
  if (n === '.env' || n.endsWith('.env') || n.startsWith('.env.')) return true;
  if (n.endsWith('.pem') || n.endsWith('.key')) return true;
  return false;
}

/* Depth-capped recursive scan. Never follows symlinks, never enters excluded
   dirs, stops at MAX_FILES and flags truncation. rel paths use '/'. */
function scanTree(dir, relBase, depth, out, state) {
  if (depth > SCAN_DEPTH) return;
  if (state.count >= MAX_FILES) { state.truncated = true; return; }
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (state.count >= MAX_FILES) { state.truncated = true; return; }
    if (e.isSymbolicLink()) continue;
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    const rel = relBase ? relBase + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (isExcludedDir(e.name)) continue;
      scanTree(abs, rel, depth + 1, out, state);
    } else if (e.isFile()) {
      if (isExcludedFile(e.name)) continue;
      let st;
      try { st = fs.statSync(abs); } catch { continue; }
      out.push({ rel, bytes: st.size, mtime: st.mtime.toISOString() });
      state.count++;
    }
  }
}

/* Football labels match user language even where disk folders differ. */
const FOOTBALL_SECTIONS = [
  { id: 'contracts',       label: 'Contracts',       match: /^Contracts\/2026-season\/[^/]+\.(pdf|docx|html)$/i },
  { id: 'safa',            label: 'SAFA letters',    match: /^SAFA\/[^/]+\.(pdf|docx|html)$/i },
  { id: 'equipment',       label: 'Equipment',       match: /^Equipment\/[^/]+\.(pdf|docx|html)$/i },
  { id: 'ethekwini-city',  label: 'Ethekwini City',  match: /^Ethekwini City\/.+/i },
  { id: 'manning-rangers', label: 'Manning Rangers', match: /^Manning Rangers\/.+/i },
  { id: 'assets',          label: 'Assets',          match: /^assets\/[^/]+$/i },
  { id: 'trials',          label: 'Trials',          match: /^ethekwini-city-fc-player-trials-15-16-aug-2026\.png$/i },
];

function fileEntry(rootId, f) {
  const label = f.rel.split('/').pop();
  const url = '/vault/' + rootId + '/' + f.rel.split('/').map(encodeURIComponent).join('/');
  return {
    id: slugify(f.rel),
    label,
    ext: path.extname(label).toLowerCase(),
    rel: f.rel,
    url,
    bytes: f.bytes,
    mtime: f.mtime,
  };
}

function buildRootTree(root) {
  const files = [];
  const state = { count: 0, truncated: false };
  scanTree(root.dir, '', 1, files, state);
  const entries = files.map((f) => fileEntry(root.id, f));
  let sections;
  if (root.id === 'football') {
    sections = FOOTBALL_SECTIONS.map((s) => ({ id: s.id, label: s.label, files: [] }));
    const other = { id: 'other', label: 'Other files', files: [] };
    for (const fe of entries) {
      const idx = FOOTBALL_SECTIONS.findIndex((s) => s.match.test(fe.rel));
      (idx === -1 ? other : sections[idx]).files.push(fe);
    }
    sections = sections.filter((s) => s.files.length);
    if (other.files.length) sections.push(other);
  } else {
    const byDir = new Map();
    const rootFiles = [];
    for (const fe of entries) {
      const seg = fe.rel.includes('/') ? fe.rel.split('/')[0] : null;
      if (!seg) { rootFiles.push(fe); continue; }
      const id = slugify(seg);
      if (!byDir.has(id)) byDir.set(id, { id, label: seg, files: [] });
      byDir.get(id).files.push(fe);
    }
    sections = [...byDir.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (rootFiles.length) sections.push({ id: 'root-files', label: 'Root files', files: rootFiles });
  }
  sections.forEach((s) => s.files.sort((a, b) => a.label.localeCompare(b.label)));
  const out = {
    generatedAt: new Date().toISOString(),
    root: { id: root.id, label: root.label },
    sections,
  };
  if (state.truncated) out.truncated = true;
  return out;
}

const treeCache = new Map(); // rootId -> { at, data }
function getRootTree(root) {
  const c = treeCache.get(root.id);
  if (c && Date.now() - c.at < TREE_TTL_MS) return c.data;
  const data = buildRootTree(root);
  treeCache.set(root.id, { at: Date.now(), data });
  return data;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

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
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return notFound(res, 'Bad path');
  }

  if (pathname === '/api/hive') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ projects: [], tasks: [], fetchedAt: new Date().toISOString() }));
    return;
  }

  /* Live tree of whitelisted HIVE roots for the deep-hive view. */
  if (pathname === '/api/tree') {
    const rootId = url.searchParams.get('root');
    if (!rootId) {
      const roots = Object.values(ROOTS)
        .filter((r) => fs.statSync(r.dir, { throwIfNoEntry: false })?.isDirectory())
        .map((r) => ({ id: r.id, label: r.label, pathKey: r.label }));
      return sendJson(res, 200, { generatedAt: new Date().toISOString(), roots });
    }
    const root = ROOTS[rootId];
    if (!root || !fs.statSync(root.dir, { throwIfNoEntry: false })?.isDirectory()) {
      return sendJson(res, 404, { error: 'unknown_root', root: rootId });
    }
    const tree = getRootTree(root);
    const sectionId = url.searchParams.get('section');
    if (sectionId) {
      const section = tree.sections.find((s) => s.id === sectionId);
      if (!section) return sendJson(res, 404, { error: 'unknown_section', root: rootId, section: sectionId });
      const out = { generatedAt: tree.generatedAt, root: tree.root, sections: [section] };
      if (tree.truncated) out.truncated = true;
      return sendJson(res, 200, out);
    }
    return sendJson(res, 200, tree);
  }

  /* File mount: /vault/<rootId>/<rel> — whitelist + safePath + realpath jail. */
  if (pathname.startsWith('/vault/')) {
    const rest = pathname.slice('/vault/'.length);
    const slash = rest.indexOf('/');
    const rootId = slash === -1 ? rest : rest.slice(0, slash);
    const rel = slash === -1 ? '' : rest.slice(slash + 1);
    const root = ROOTS[rootId];
    if (!root || !rel) return notFound(res, 'Not found');
    const segs = rel.split('/');
    if (segs.some((s) => !s || s === '.' || s === '..' || isExcludedDir(s))) {
      return notFound(res, 'Forbidden');
    }
    if (isExcludedFile(segs[segs.length - 1])) return notFound(res, 'Forbidden');
    const target = safePath(root.dir, rel);
    if (!target) return notFound(res, 'Forbidden');
    try {
      const realRoot = fs.realpathSync(root.dir);
      const realFile = fs.realpathSync(target);
      if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) {
        return notFound(res, 'Forbidden');
      }
    } catch {
      return notFound(res, 'Not found');
    }
    if (serveFile(res, target)) return;
    return notFound(res, 'Not found');
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

// The logon task re-runs this every 15 minutes as a self-heal; an already
// running server is not an error, so exit quietly instead of crashing.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Comb server already running on port ' + PORT);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log('Comb local server running at http://127.0.0.1:' + PORT);
  console.log('Public root: ' + PUBLIC);
  console.log('ETA Work root: ' + ETA_WORK);
  const mounted = Object.values(ROOTS)
    .filter((r) => fs.statSync(r.dir, { throwIfNoEntry: false })?.isDirectory())
    .map((r) => r.id);
  console.log('Vault roots (' + mounted.length + ') at /vault/<id>/ : ' + mounted.join(', '));
});
