// Verify the deep-hive vault + tree API on the local Comb server.
// Usage: node Comb/scripts/verify-deep-hive.mjs   (server must be running on 8765)
// Exits non-zero on any failure; every check prints PASS/FAIL.

const BASE = process.env.COMB_BASE || 'http://127.0.0.1:8765';

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('PASS  ' + name);
  } else {
    failures++;
    console.log('FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

async function get(pathname) {
  const res = await fetch(BASE + pathname, { redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* binary or plain body */ }
  return { status: res.status, headers: res.headers, json, text };
}

const run = (async () => {
  // 1. Root listing: football present among whitelisted roots.
  const tree = await get('/api/tree');
  check('GET /api/tree → 200', tree.status === 200, 'status ' + tree.status);
  const roots = tree.json && Array.isArray(tree.json.roots) ? tree.json.roots : [];
  check('roots array non-empty', roots.length > 0, 'got ' + roots.length);
  const football = roots.find((r) => r.id === 'football');
  check('football root present', !!football, football ? '' : JSON.stringify(roots.map((r) => r.id)));

  // 2. Football curated sections with expected labels.
  const fb = await get('/api/tree?root=football');
  check('GET /api/tree?root=football → 200', fb.status === 200, 'status ' + fb.status);
  const sections = fb.json && Array.isArray(fb.json.sections) ? fb.json.sections : [];
  const byId = Object.fromEntries(sections.map((s) => [s.id, s]));
  for (const id of ['contracts', 'safa', 'equipment', 'ethekwini-city', 'manning-rangers', 'assets', 'player-profiles', 'trials']) {
    check('football section "' + id + '" present', !!byId[id], 'sections: ' + sections.map((s) => s.id).join(', '));
  }
  const profiles = (byId['player-profiles'] && byId['player-profiles'].files) || [];
  check('player-profiles has Profile Form artefact',
    profiles.some((f) => /Player-Profile-Form-2026\.(pdf|docx|html)$/i.test(f.label)),
    profiles.map((f) => f.label).join(' | ') || 'no files');
  for (const id of ['contracts', 'safa', 'equipment']) {
    const files = (byId[id] && byId[id].files) || [];
    check(id + ' has ≥1 pdf', files.some((f) => f.ext === '.pdf'), files.map((f) => f.label).join(' | ') || 'no files');
  }
  check('no build/ files leaked into tree',
    sections.every((s) => s.files.every((f) => !/(^|\/)build\//i.test(f.rel))),
    '');
  check('no _pdf-visual files leaked into tree',
    sections.every((s) => s.files.every((f) => !/_pdf-visual/i.test(f.rel))),
    '');

  // 3. Section query returns the same section alone.
  const contracts = await get('/api/tree?root=football&section=contracts');
  check('GET ?root=football&section=contracts → 200', contracts.status === 200, 'status ' + contracts.status);
  check('section query returns only contracts',
    contracts.json && contracts.json.sections && contracts.json.sections.length === 1
      && contracts.json.sections[0].id === 'contracts',
    '');
  const contractFiles = contracts.json ? contracts.json.sections[0].files : [];
  check('contracts files ≥1', contractFiles.length >= 1, '');

  // 4. A vault PDF serves inline with a PDF content type.
  const pdf = contractFiles.find((f) => f.ext === '.pdf');
  check('a contracts pdf was found to fetch', !!pdf, '');
  if (pdf) {
    check('pdf url is under /vault/football/', pdf.url.startsWith('/vault/football/'), pdf.url);
    const pv = await get(pdf.url);
    check('GET ' + pdf.url + ' → 200', pv.status === 200, 'status ' + pv.status);
    const ctype = pv.headers.get('content-type') || '';
    check('content-type is application/pdf', ctype.includes('application/pdf'), ctype);
    const cdisp = pv.headers.get('content-disposition') || '';
    check('pdf served inline', cdisp.includes('inline'), cdisp || '(none)');
    check('pdf body starts with %PDF', pv.text.slice(0, 4) === '%PDF', pv.text.slice(0, 8));
  }

  // 2b. ETA Work compartments: Study guide + Assignments.
  const eta = await get('/api/tree?root=eta-work');
  check('GET /api/tree?root=eta-work → 200', eta.status === 200, 'status ' + eta.status);
  const etaSections = eta.json && Array.isArray(eta.json.sections) ? eta.json.sections : [];
  const etaById = Object.fromEntries(etaSections.map((s) => [s.id, s]));
  check('eta section "study-guide" present', !!etaById['study-guide'],
    'sections: ' + etaSections.map((s) => s.id).join(', '));
  check('eta section "assignments" present', !!etaById['assignments'],
    'sections: ' + etaSections.map((s) => s.id).join(', '));
  check('eta study-guide has ≥1 artefact',
    ((etaById['study-guide'] && etaById['study-guide'].files) || []).length >= 1, '');
  check('eta assignments has ≥1 artefact',
    ((etaById['assignments'] && etaById['assignments'].files) || []).length >= 1, '');

  // 5. Path traversal is rejected (raw + encoded variants).
  const t1 = await get('/vault/football/../../Comb/serve.js');
  check('traversal ../../ rejected', t1.status === 404 || t1.status === 403, 'status ' + t1.status);
  const t2 = await get('/vault/football/..%2F..%2FComb%2Fserve.js');
  check('traversal ..%2F rejected', t2.status === 404 || t2.status === 403, 'status ' + t2.status);
  const t3 = await get('/vault/football/%2e%2e/%2e%2e/Comb/serve.js');
  check('traversal %2e%2e rejected', t3.status === 404 || t3.status === 403, 'status ' + t3.status);
  const t4 = await get('/vault/football/build/contracts/build.mjs');
  check('excluded build/ dir rejected', t4.status === 404 || t4.status === 403, 'status ' + t4.status);
  const t5 = await get('/vault/not-a-root/x.pdf');
  check('unknown root rejected', t5.status === 404 || t5.status === 403, 'status ' + t5.status);
  const t6 = await get('/vault/comb/.env.local');
  check('.env file rejected', t6.status === 404 || t6.status === 403, 'status ' + t6.status);

  // 6. Backward compatibility: /api/hive stub and /files/ mount still behave.
  const hive = await get('/api/hive');
  check('GET /api/hive → 200 (stub intact)', hive.status === 200, 'status ' + hive.status);
  const shell = await get('/');
  check('GET / → 200 (shell intact)', shell.status === 200, 'status ' + shell.status);
  const noVaultShell = await get('/vault/');
  check('GET /vault/ without root → 404', noVaultShell.status === 404, 'status ' + noVaultShell.status);

  // 7. System catalog returns 200 with the expected shape.
  const catalog = await get('/api/system-catalog');
  check('GET /api/system-catalog → 200', catalog.status === 200, 'status ' + catalog.status);
  check('system-catalog has docs array', Array.isArray(catalog.json && catalog.json.docs), '');
  check('system-catalog has env array', Array.isArray(catalog.json && catalog.json.env), '');
  check('system-catalog has skills array', Array.isArray(catalog.json && catalog.json.skills) && catalog.json.skills.length > 0, '');

  // 8. Project trees hide README/CHANGELOG/LICENSE/.env/SKILL.md meta files.
  let readmeLeaked = false;
  let envLeaked = false;
  let skillLeaked = false;
  for (const r of roots) {
    const t = await get('/api/tree?root=' + encodeURIComponent(r.id));
    if (!t.json || !Array.isArray(t.json.sections)) continue;
    for (const s of t.json.sections) {
      for (const f of (s.files || [])) {
        const base = f.rel.split('/').pop().toLowerCase();
        if (base.startsWith('readme') || base.startsWith('changelog') || base.startsWith('license')) readmeLeaked = true;
        if (base === '.env' || base.startsWith('.env.') || base.endsWith('.env')) envLeaked = true;
        if (base === 'skill.md') skillLeaked = true;
      }
    }
  }
  check('project trees hide README/CHANGELOG/LICENSE', !readmeLeaked, '');
  check('project trees hide .env files', !envLeaked, '');
  check('project trees hide SKILL.md', !skillLeaked, '');

  // 9. Vault GET still forbids .env bodies, and the catalog names them without content.
  const envs = catalog.json && Array.isArray(catalog.json.env) ? catalog.json.env : [];
  check('system-catalog env entries are name-only (no url/content)', envs.every((e) => !e.url && !e.content), '');
  if (envs.length) {
    const first = envs[0];
    const enc = first.rel.split('/').map(encodeURIComponent).join('/');
    const ev = await get('/vault/' + first.rootId + '/' + enc);
    check('vault .env GET forbidden (404/403)', ev.status === 404 || ev.status === 403, 'status ' + ev.status);
  }

  // 10. SW cache name was bumped.
  const sw = await get('/sw.js');
  check('GET /sw.js → 200', sw.status === 200, 'status ' + sw.status);
  check('sw.js cache bumped to v43', sw.text.includes('comb-shell-v43'), sw.text.slice(0, 120));
  check('shell locks scroll when deep-on', shell.text.includes('html.deep-on,body.deep-on') || shell.text.includes('html.deep-on'), '');
  check('fluid bee wander (rAF)', shell.text.includes('tickBeeWander') && shell.text.includes('DEEP_BEE_COUNT'), '');
  check('home bees fifteen', shell.text.includes('HOME_BEE_COUNT=15') || shell.text.includes('HOME_BEE_COUNT = 15'), '');
  check('twenty drift bees inside hive', shell.text.includes('DEEP_BEE_COUNT=20') || shell.text.includes('DEEP_BEE_COUNT = 20'), '');
  check('bee drama + queen', shell.text.includes('beginFight') && shell.text.includes('is-queen') && shell.text.includes('beginCoffee'), '');
  check('bees fly over hexes', shell.text.includes('id="deepBees"') && /deepStage[\s\S]*deepBees/.test(shell.text), '');
  check('home bee stage', shell.text.includes('id="homeBees"') && shell.text.includes('startHomeBees'), '');
  check('bee max dwell 4s', shell.text.includes('DEEP_BEE_MAX_DWELL=4000') || shell.text.includes('DEEP_BEE_MAX_DWELL = 4000'), '');
  check('bee dialogue bubbles', shell.text.includes('showBeeSay') && shell.text.includes('beginChat') && shell.text.includes('BEE_LINES'), '');
  check('queen yell locked once', shell.text.includes('yellShown') && shell.text.includes('QUEEN_LINES'), '');
  check('shell has dark deep-doc panel', shell.text.includes('deep-doc') && shell.text.includes('rgba(8,6,4'), '');

  // 11. Avoid list from HIVE/Avoid/sites.json
  const avoid = await get('/api/avoid-sites');
  check('GET /api/avoid-sites → 200', avoid.status === 200, 'status ' + avoid.status);
  check('avoid-sites has sites array', Array.isArray(avoid.json && avoid.json.sites), '');
  check('avoid-sites has ≥1 seed entry',
    avoid.json && Array.isArray(avoid.json.sites) && avoid.json.sites.length >= 1,
    avoid.json && avoid.json.sites ? 'len ' + avoid.json.sites.length : 'missing');
  const sectionMeta = await get('/section-meta.json');
  check('GET /section-meta.json → 200', sectionMeta.status === 200, 'status ' + sectionMeta.status);

  // 12. Shell L1 ring — ETA rename, no System on ring, no School work
  check('shell L1 has Avoid', shell.text.includes('label:"Avoid"') || shell.text.includes("label:'Avoid'"), '');
  check('shell L1 has ETA label', /id:"eta-work",label:"ETA"/.test(shell.text), '');
  check('shell L1 does not say School work', !shell.text.includes('School work'), '');
  check('shell does not put System on L1_NODES',
    !/L1_NODES\s*=\s*\[[^\]]*id:"system"/.test(shell.text),
    '');
  check('shell does not put digital-brain on L1_NODES',
    !/L1_NODES\s*=\s*\[[^\]]*digital-brain/.test(shell.text),
    '');
  check('shell center hub is System', shell.text.includes('renderDeepComb(nodes, "System"'), '');

  // 13. Stella / Praeto / Hermes — curated shelves, no code-dir hexes
  const CODE_DIR_IDS = new Set([
    'frontend', 'backend', 'infra', 'docs', 'root-files',
    'stella-admin-app', 'stella-admin-twa-final', 'stella-indoor-source',
    'testing-tools', 'tmp-audit', 'node-modules',
  ]);
  async function assertNoCodeDirs(rootId, expectIds) {
    const t = await get('/api/tree?root=' + encodeURIComponent(rootId));
    check('GET /api/tree?root=' + rootId + ' → 200', t.status === 200, 'status ' + t.status);
    const secs = (t.json && t.json.sections) || [];
    const ids = secs.map((s) => s.id);
    const leaked = ids.filter((id) => CODE_DIR_IDS.has(id));
    check(rootId + ' has no code-dir section ids', leaked.length === 0, 'leaked: ' + leaked.join(', '));
    for (const id of expectIds) {
      check(rootId + ' has section "' + id + '"', ids.includes(id), 'sections: ' + ids.join(', '));
    }
  }
  await assertNoCodeDirs('stella-project', ['guides', 'ads', 'indoor', 'play-store']);
  await assertNoCodeDirs('praeto-office-ai-portal', ['about']);
  await assertNoCodeDirs('hermes-bridge', ['about']);
  check('section-meta has stella guides', !!(sectionMeta.json && sectionMeta.json['stella-project:guides']), '');
  check('section-meta has praeto about', !!(sectionMeta.json && sectionMeta.json['praeto-office-ai-portal:about']), '');

  // 14. Panel-first + labeled doors (no flat data-work-file dump)
  check('shell defines openWorkPanel', shell.text.includes('function openWorkPanel'), '');
  check('shell uses labeled work doors', shell.text.includes('data-work-door'), '');
  check('shell has no flat data-work-file dump', !shell.text.includes('data-work-file'), '');
  check('shell Stella is panelFirst', /id:"stella"[^\}]*panelFirst:\s*true/.test(shell.text), '');
  check('shell Praeto is panelFirst', /id:"praeto"[^\}]*panelFirst:\s*true/.test(shell.text), '');
  check('shell has PAPERS_SHELVES for System', shell.text.includes('PAPERS_SHELVES'), '');
  check('shell Stella has Indoor Client app link', shell.text.includes('stella-indoor.web.app'), '');
  check('shell Stella has Indoor Admin app link', shell.text.includes('stella-indoor-admin.web.app'), '');
  check('shell Stella has Glenwood app link', shell.text.includes('stella-glenwood.vercel.app'), '');
  check('shell Praeto has Compliance Club link', shell.text.includes('compliance-club.vercel.app'), '');
  check('shell Praeto has Balance demo link', shell.text.includes('praeto-balance-demo.vercel.app'), '');
  check('shell apps rendered as App rows', shell.text.includes('row("App"'), '');
  check('OTHER_APPS does not list Balance as sole home',
    !/OTHER_APPS\s*=\s*\[[^\]]*praeto-balance/.test(shell.text),
    '');

  console.log('');
  if (failures) {
    console.log(failures + ' check(s) FAILED');
    process.exit(1);
  }
  console.log('All deep-hive checks PASSED');
})();

run.catch((err) => {
  console.log('FATAL  ' + (err && err.message ? err.message : err));
  process.exit(1);
});
