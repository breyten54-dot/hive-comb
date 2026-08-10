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
/* Project tree view hides meta/readme files so the deep-hive comb shows work
   rather than repository clutter. These files are still reachable via direct
   vault URLs when needed (e.g. the system catalog docs index). */
function isProjectBrowseExcluded(name) {
  const n = name.toLowerCase();
  if (n === 'skill.md') return true;
  if (n.startsWith('readme')) return true;
  if (n.startsWith('changelog')) return true;
  if (n.startsWith('license')) return true;
  return isExcludedFile(name);
}

/* Depth-capped recursive scan. Stops at MAX_FILES and flags truncation; rel
   paths use '/'. OneDrive Files-On-Demand placeholders report as symlinks
   (dirent.isSymbolicLink()), so links are resolved and kept only when the
   real path stays under the scanned root — outside targets are skipped. */
function scanTree(dir, relBase, depth, out, state) {
  if (depth > SCAN_DEPTH) return;
  if (state.count >= MAX_FILES) { state.truncated = true; return; }
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (state.count >= MAX_FILES) { state.truncated = true; return; }
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    const rel = relBase ? relBase + '/' + e.name : e.name;
    let isDir = e.isDirectory();
    let isFile = e.isFile();
    if (e.isSymbolicLink()) {
      try {
        const real = fs.realpathSync(abs);
        if (real !== state.realRoot && !real.startsWith(state.realRoot + path.sep)) continue;
        const st = fs.statSync(abs);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch { continue; }
    }
    if (isDir) {
      if (isExcludedDir(e.name)) continue;
      scanTree(abs, rel, depth + 1, out, state);
    } else if (isFile) {
      if (isProjectBrowseExcluded(e.name)) continue;
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
  { id: 'player-profiles', label: 'Player profiles', match: /^Player-Profiles\//i },
  { id: 'trials',          label: 'Trials',          match: /^ethekwini-city-fc-player-trials-15-aug-2026\.(png|html)$/i },
  { id: 'registration',    label: 'Registration forms', match: /^MYSAFA/i },
];

/** Human labels for Football vault stems — sellable OS: never dump raw filenames in the hex. */
const FOOTBALL_STEM_LABELS = {
  'ECFC-MRS_Player_Agreement_Under19_2026-1': 'Player Agreement — Under-19 (2026)',
  'ECFC-MRS_Player_Agreement_Under21_2026-2': 'Player Agreement — Under-21 (2026)',
  'ECFC-MRS_Player_Agreement_Over21_2026': 'Player Agreement — Over-21 / Senior (2026)',
  'Ethekwini-City-FC-Coaching-Agreement-Reece-Ogle-2026': 'Coaching Agreement — Reece Ogle (2026)',
  'Ethekwini-City-FC-Coaching-Agreement-Sthe-2026': 'Coaching Agreement — Sthe (2026)',
  'Ethekwini-City-FC-Player-Registration-Commitment-Agreement-2026': 'Player Registration & Commitment (2026)',
  'Player-Profile-Form-2026': 'Player Profile Form (2026)',
  'SAFA-Club-Name-Change-and-League-Placement-Request-2026': 'SAFA Club Name Change & League Placement (2026)',
  'Ethekwini-City-FC-Training-Equipment-Quote-Charmers-2026': 'Training Equipment Quote — Charmers (2026)',
  'ethekwini-city-fc-player-trials-15-aug-2026': 'Trials Poster — 15 Aug 2026',
  'MYSAFA+Registration+Form+v2 (1)': 'MYSAFA Registration Form',
  'ethekwini-city-fc-badge': 'Badge — Ethekwini City FC',
  'manning-rangers-sporting-badge': 'Badge — Manning Rangers Sporting',
  'Bryce Clearance and Travel Permission': 'Bryce — Clearance & Travel Permission',
  'Permission to Travel Bryce Naude Ethekwini City FC': 'Bryce — Permission to Travel (ECFC)',
  'Permission to Travel Bryce Naude Ethekwini City FC (SIGN HERE)': 'Bryce — Permission to Travel (ECFC, sign here)',
  'Clearance Bryce Naude': 'Bryce — Clearance (MRS)',
  'Permission to Travel Bryce Naude Manning Rangers': 'Bryce — Permission to Travel (MRS)',
  'Permission to Travel Bryce Naude Manning Rangers (SIGN HERE)': 'Bryce — Permission to Travel (MRS, sign here)',
};

function footballStemLabel(rel) {
  const stem = path.basename(rel, path.extname(rel));
  if (FOOTBALL_STEM_LABELS[stem]) return FOOTBALL_STEM_LABELS[stem];
  const hit = Object.keys(FOOTBALL_STEM_LABELS).find((k) => k.toLowerCase() === stem.toLowerCase());
  if (hit) return FOOTBALL_STEM_LABELS[hit];
  return stem
    .replace(/\+/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || stem;
}

/** Drop extract folders, page dumps, and OneDrive copy-soup from the Football OS surface. */
function isFootballSurfaceNoise(rel) {
  const base = path.basename(rel, path.extname(rel));
  if (/\/_/.test(rel.replace(/\\/g, '/'))) return true;
  if (/\bpage\s*\d+\b/i.test(base)) return true;
  if (/^r\d*$/i.test(base.trim())) return true;
  if (/\(\d+\)(\s*\(\d+\)){2,}/.test(base)) return true;
  return false;
}
/* ETA Work — Study guide (tests) vs Assignments; keep monitor noise out of primary hexes. */
const ETA_ARTEFACT_EXT = new Set(['.html', '.pdf', '.docx', '.md', '.png', '.jpg', '.jpeg', '.webp']);
const ETA_SECTIONS = [
  { id: 'study-guide',  label: 'Study guide',  match: /^(study-guide\/|BMSR114_Written_Test)/i },
  { id: 'assignments',  label: 'Assignments',  match: /^assessments\//i },
  { id: 'deadlines',    label: 'Deadlines',    match: /^deadlines\//i },
];

/* Need-to-know browse: papers/media only — never frontend/backend/tmp code dirs as hexes. */
const NEED_TO_KNOW_EXT = new Set(['.html', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp']);
/* Stella root guides (README* still excluded by isProjectBrowseExcluded). */
const STELLA_GUIDE_MD = /^(NOTIFICATION-GUIDE\.md|STELLA-ADMIN-APP-INSTALL\.md|play-store\/PLAY-SETUP\.md)$/i;
const STELLA_SECTIONS = [
  { id: 'guides',     label: 'Guides',           match: /^(NOTIFICATION-GUIDE\.md|STELLA-ADMIN-APP-INSTALL\.md)$/i },
  { id: 'ads',        label: 'Ads & posters',    match: /^stella-(poster|launch-ad)\.html$/i },
  { id: 'indoor',     label: 'Indoor app pages', match: /^stella-indoor-source\/(index\.html|admin\.html|public\/privacy\.html)$/i },
  { id: 'play-store', label: 'Play Store notes', match: /^play-store\/PLAY-SETUP\.md$/i },
];
const PRAETO_SECTIONS = [
  { id: 'about',  label: 'About',  match: /$a/, keepEmpty: true }, /* never matches; meta + links */
  { id: 'papers', label: 'Papers', match: /\.(pdf|docx)$/i },
];
const HERMES_SECTIONS = [
  { id: 'about', label: 'About', match: /$a/, keepEmpty: true },
];

function isEtaBrowseArtefact(fe) {
  return ETA_ARTEFACT_EXT.has(fe.ext);
}
function isNeedToKnowArtefact(fe, rootId) {
  if (NEED_TO_KNOW_EXT.has(fe.ext)) return true;
  if (rootId === 'stella-project' && fe.ext === '.md' && STELLA_GUIDE_MD.test(fe.rel)) return true;
  return false;
}

/** Football/ETA-style shelves; keepEmpty sections survive with zero files (About panels). */
function buildCuratedSections(entries, sectionDefs, { filter, includeOther = false } = {}) {
  const sections = sectionDefs.map((s) => ({
    id: s.id,
    label: s.label,
    files: [],
    keepEmpty: !!s.keepEmpty,
  }));
  const other = { id: 'other', label: 'Other files', files: [] };
  for (const fe of entries) {
    if (filter && !filter(fe)) continue;
    const idx = sectionDefs.findIndex((s) => s.match && s.match.test(fe.rel));
    if (idx === -1) {
      if (includeOther) other.files.push(fe);
      continue;
    }
    sections[idx].files.push(fe);
  }
  let out = sections.filter((s) => s.files.length || s.keepEmpty);
  if (includeOther && other.files.length) out.push(other);
  return out.map(({ id, label, files }) => ({ id, label, files }));
}

function fileEntry(rootId, f) {
  const baseName = path.basename(f.rel);
  const ext = path.extname(baseName).toLowerCase();
  const stem = path.basename(baseName, ext);
  const label =
    rootId === 'football' ? footballStemLabel(f.rel) : baseName;
  const url = '/vault/' + rootId + '/' + f.rel.split('/').map(encodeURIComponent).join('/');
  return {
    id: slugify(f.rel),
    label,
    stem,
    stemLabel: rootId === 'football' ? footballStemLabel(f.rel) : stem,
    ext,
    rel: f.rel,
    url,
    bytes: f.bytes,
    mtime: f.mtime,
  };
}

function buildRootTree(root) {
  const files = [];
  const state = { count: 0, truncated: false, realRoot: root.dir };
  try { state.realRoot = fs.realpathSync(root.dir); } catch { /* keep literal dir */ }
  scanTree(root.dir, '', 1, files, state);
  const entries = files
    .map((f) => fileEntry(root.id, f))
    .filter((fe) => !(root.id === 'football' && isFootballSurfaceNoise(fe.rel)));
  let sections;
  if (root.id === 'football') {
    sections = buildCuratedSections(entries, FOOTBALL_SECTIONS, { includeOther: true });
  } else if (root.id === 'eta-work') {
    sections = buildCuratedSections(entries, ETA_SECTIONS, {
      filter: isEtaBrowseArtefact,
      includeOther: true,
    });
  } else if (root.id === 'stella-project') {
    sections = buildCuratedSections(entries, STELLA_SECTIONS, {
      filter: (fe) => isNeedToKnowArtefact(fe, 'stella-project'),
    });
  } else if (root.id === 'praeto-office-ai-portal') {
    sections = buildCuratedSections(entries, PRAETO_SECTIONS, {
      filter: (fe) => isNeedToKnowArtefact(fe, root.id),
    });
  } else if (root.id === 'hermes-bridge') {
    sections = buildCuratedSections(entries, HERMES_SECTIONS, {
      filter: (fe) => isNeedToKnowArtefact(fe, root.id),
    });
  } else {
    /* Default: one Files shelf of need-to-know artefacts — never top-level code dirs. */
    sections = [{
      id: 'files',
      label: 'Files',
      files: entries.filter((fe) => isNeedToKnowArtefact(fe, root.id)),
    }];
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

/* Catalog scan: lists README*, .env*, and SKILL.md files across all whitelisted
   roots. READMEs are exposed with vault URLs; .env* only name/rel/root — bodies
   are still forbidden by the vault route. */
function scanAllFiles(dir, relBase, depth, out, state) {
  if (depth > SCAN_DEPTH) return;
  if (state.count >= MAX_FILES) { state.truncated = true; return; }
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (state.count >= MAX_FILES) { state.truncated = true; return; }
    if (e.name === '.' || e.name === '..') continue;
    const abs = path.join(dir, e.name);
    const rel = relBase ? relBase + '/' + e.name : e.name;
    let isDir = e.isDirectory();
    let isFile = e.isFile();
    if (e.isSymbolicLink()) {
      try {
        const real = fs.realpathSync(abs);
        if (real !== state.realRoot && !real.startsWith(state.realRoot + path.sep)) continue;
        const st = fs.statSync(abs);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch { continue; }
    }
    if (isDir) {
      if (isExcludedDir(e.name)) continue;
      scanAllFiles(abs, rel, depth + 1, out, state);
    } else if (isFile) {
      const n = e.name.toLowerCase();
      if (n === 'credentials.json') continue;
      if (n.includes('secret')) continue;
      let st;
      try { st = fs.statSync(abs); } catch { continue; }
      out.push({ rel, bytes: st.size, mtime: st.mtime.toISOString() });
      state.count++;
    }
  }
}

function buildSystemCatalog() {
  const docs = [];
  const env = [];
  const extraSkills = [];
  for (const root of Object.values(ROOTS)) {
    if (!fs.statSync(root.dir, { throwIfNoEntry: false })?.isDirectory()) continue;
    const files = [];
    const state = { count: 0, truncated: false, realRoot: root.dir };
    try { state.realRoot = fs.realpathSync(root.dir); } catch { /* keep literal */ }
    scanAllFiles(root.dir, '', 1, files, state);
    for (const f of files) {
      const segs = f.rel.split('/');
      const name = segs[segs.length - 1];
      const n = name.toLowerCase();
      if (n.startsWith('readme')) {
        docs.push({
          origin: root.label,
          label: name,
          rel: f.rel,
          rootId: root.id,
          url: '/vault/' + root.id + '/' + segs.map(encodeURIComponent).join('/'),
        });
      }
      if (n === '.env' || n.startsWith('.env.') || n.endsWith('.env')) {
        env.push({
          origin: root.label,
          name,
          rel: f.rel,
          rootId: root.id,
        });
      }
      if (n === 'skill.md' || n.endsWith('/skill.md')) {
        extraSkills.push({
          id: slugify(root.id + '-' + f.rel),
          label: name + ' · ' + root.label,
          note: 'SKILL.md found under ' + root.label + '/' + f.rel,
        });
      }
    }
  }
  const skills = [
    { id: 'model-routing', label: 'model-routing', note: 'Routes HIVE work across the full hive-* subagent roster by model traits.' },
    { id: 'digital-brain', label: 'digital-brain', note: 'HIVE Digital Brain (Obsidian vault) usage.' },
    { id: 'video-vision', label: 'video-vision', note: 'Give Cursor Agent eyes and ears on video.' },
    { id: 'anti-slop', label: 'anti-slop', note: 'Detect and rewrite generic AI writing patterns in HIVE deliverables.' },
    { id: 'fable-mode', label: 'fable-mode', note: 'Enforces staged execution discipline on large tasks.' },
    { id: 'execution-guardrails', label: 'execution-guardrails', note: 'Always-on verify-before-flag and safety habits.' },
  ].concat(extraSkills);
  return { generatedAt: new Date().toISOString(), docs, env, skills };
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

  // Live JSON panels change on disk / deploy — never let browsers keep a stale copy.
  if (ext === '.json') {
    headers['Cache-Control'] = 'no-store';
  }

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

/* ---------- live panel SSE: push when public/*.json changes on disk ---------- */
const LIVE_JSON = new Set([
  'open-todos.json', 'eta.json', 'meetings.json', 'portfolio-gates.json',
  'state-blurb.json', 'inbox-status.json', 'product-lanes.json',
]);
const liveClients = new Set();
let liveDebounce = null;
let lastLivePayload = '';

function broadcastLive(files) {
  const payload = JSON.stringify({
    type: 'panel',
    files: files || [],
    at: new Date().toISOString(),
  });
  if (payload === lastLivePayload) return;
  lastLivePayload = payload;
  for (const res of liveClients) {
    try {
      res.write('data: ' + payload + '\n\n');
    } catch {
      liveClients.delete(res);
    }
  }
}

function scheduleLiveBroadcast(fileName) {
  if (!LIVE_JSON.has(fileName)) return;
  clearTimeout(liveDebounce);
  liveDebounce = setTimeout(() => {
    broadcastLive([fileName]);
  }, 80);
}

try {
  fs.watch(PUBLIC, { persistent: true }, (eventType, filename) => {
    if (!filename) return;
    const base = path.basename(String(filename));
    if (base.endsWith('.json')) scheduleLiveBroadcast(base);
  });
  console.log('Watching public/*.json for live Comb panel updates');
} catch (err) {
  console.warn('Could not watch public/ for live updates:', err && err.message ? err.message : err);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return notFound(res, 'Bad path');
  }

  if (pathname === '/api/live') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': comb-live\n\n');
    res.write('data: ' + JSON.stringify({ type: 'hello', at: new Date().toISOString() }) + '\n\n');
    liveClients.add(res);
    req.on('close', () => {
      liveClients.delete(res);
    });
    return;
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

  /* System catalog: docs (README*), env files (.env* names only), and skills. */
  if (pathname === '/api/system-catalog') {
    return sendJson(res, 200, buildSystemCatalog());
  }

  /* Avoid list — HIVE/Avoid/sites.json (agent-maintained; Comb reflects). */
  if (pathname === '/api/avoid-sites') {
    const avoidPath = path.join(HIVE_ROOT, 'Avoid', 'sites.json');
    try {
      const raw = fs.readFileSync(avoidPath, 'utf8');
      const data = JSON.parse(raw);
      return sendJson(res, 200, {
        generatedAt: new Date().toISOString(),
        updatedAt: data.updatedAt || null,
        note: data.note || null,
        sites: Array.isArray(data.sites) ? data.sites : [],
      });
    } catch (err) {
      return sendJson(res, 200, {
        generatedAt: new Date().toISOString(),
        updatedAt: null,
        note: 'Avoid/sites.json missing or unreadable',
        sites: [],
        error: String(err && err.message || err),
      });
    }
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
