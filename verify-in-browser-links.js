import http from 'node:http';

const BASE = 'http://127.0.0.1:8765';
const CASES = [
  { path: '/', name: 'Comb home page', expectType: 'text/html' },
  { path: '/eta.json', name: 'ETA JSON', expectType: 'application/json' },
  { path: '/open-todos.json', name: 'Open todos JSON', expectType: 'application/json' },
  { path: '/product-lanes.json', name: 'Product lanes JSON', expectType: 'application/json' },
  { path: '/meetings.json', name: 'Meetings JSON', expectType: 'application/json' },
  { path: '/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf', name: 'BMSR114 study PDF (raw)', expectType: 'application/pdf' },
  { path: '/files/deadlines/briefs/2026-08-14/BMSR114-Written-Test-brief.docx', name: 'Sample test brief DOCX', expectType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { path: '/files/deadlines/briefs/Key-Functions-The-Interview/Consent%20Form_BMSR%20120.docx', name: 'Interview assignment DOCX', expectType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { path: '/preview/docx.html?file=/files/deadlines/briefs/Key-Functions-The-Interview/Consent%20Form_BMSR%20120.docx', name: 'DOCX preview page', expectType: 'text/html' },
  { path: '/preview/pdf.html?file=/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf', name: 'PDF preview wrapper', expectType: 'text/html' },
];

const KEEP_CELLS = [
  'Praeto Compliance Club',
  'Praeto Balance',
  'Project Tech',
  'Stella Indoor',
  'Stella Glenwood',
  'Digital Brain',
  'Video-Inbox',
  'ETA Work',
  'Football',
  'Personal',
  'Unethical',
  'Anialah',
  'PABOS',
  'praeto.co.za',
];

const DROP_CELLS = [
  'Padel eBook',
  'Tiespro PWA',
  'Backend Checklist',
  'AI-Benchmark',
  'Praeto Marketing',
  'fable-mode source',
];

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body }));
    }).on('error', reject);
  });
}

(async () => {
  let ok = 0, fail = 0;
  for (const c of CASES) {
    try {
      const r = await get(c.path);
      const typeOk = r.type.includes(c.expectType);
      const statusOk = r.status === 200;
      if (statusOk && typeOk) {
        console.log('PASS', c.name, `→ ${r.status} ${r.type.split(';')[0]}`);
        ok++;
      } else {
        console.log('FAIL', c.name, `→ ${r.status} ${r.type}`);
        fail++;
      }
    } catch (e) {
      console.log('FAIL', c.name, '→', e.message);
      fail++;
    }
  }

  try {
    const r = await get('/');
    const eta = await get('/eta.json');
    const etaBody = eta.body || '';
    const etaJson = JSON.parse(etaBody);
    const etaItems = Array.isArray(etaJson.items) ? etaJson.items : [];
    const assigns = etaItems.filter((it) => it.type === 'Assignment' && !/written\s*test/i.test(it.name || ''));
    const tests = etaItems.filter((it) => it.type === 'Test' || /written\s*test/i.test(it.name || ''));
    const todos = await get('/open-todos.json');
    const todosBody = todos.body || '';
    const lanes = await get('/product-lanes.json');
    const lanesBody = lanes.body || '';
    const sw = await get('/sw.js');
    const docx = await get('/preview/docx.html?file=/files/deadlines/briefs/Key-Functions-The-Interview/Consent%20Form_BMSR%20120.docx');
    const pdfWrap = await get('/preview/pdf.html?file=/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf');
    const rolePlay = assigns.find((it) => it.name === 'Learning Activity 1: Role-Play Scenarios');

    const checks = [
      ['ETA tests panel present', r.body.includes('id="etaTestsCard"')],
      ['Open todos panel present', r.body.includes('id="openTodosCard"')],
      ['Assignments rail present', r.body.includes('id="assignRailSvg"')],
      ['Meetings rail present', r.body.includes('id="meetRailSvg"')],
      ['Pipeline detail disclosure present', r.body.includes('id="pipelineDetails"')],
      ['Bottom meetings strip retired', !r.body.includes('id="meetingsCard"')],
      ['ETA JSON lists PDF', etaBody.includes('/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf')],
      ['ETA JSON has Assignment entries', assigns.length >= 2],
      ['ETA JSON lists Role-Play assignment', !!rolePlay],
      ['Role-Play PDF/word stay null', !!rolePlay && rolePlay.pdf == null && rolePlay.word == null],
      ['ETA JSON lists Interview assignment', assigns.some((it) => it.name === 'Key Functions - The Interview')],
      ['ETA JSON keeps BMSR114 Written Test', tests.some((it) => /BMSR 114 Written Test/i.test(it.name || ''))],
      ['BMSR114 Written Test is typed Test', tests.some((it) => it.type === 'Test' && /BMSR 114 Written Test/i.test(it.name || ''))],
      ['No written-test titles in Assignment type', !etaItems.some((it) => it.type === 'Assignment' && /written\s*test/i.test(it.name || ''))],
      ['Filter helpers present in shell', r.body.includes('function isEtaAssignment') && r.body.includes('function isEtaTest')],
      ['Open todos JSON has items', todosBody.includes('"todos"') && todosBody.includes('"name"')],
      ['Product lanes JSON has lanes', lanesBody.includes('"lanes"') && lanesBody.includes('https://compliance-club.vercel.app')],
      ['DOCX preview page linked', r.body.includes('/preview/docx.html?file=')],
      ['PDF preview wrapper linked', r.body.includes('/preview/pdf.html?file=')],
      ['PDF view helper present', r.body.includes('function pdfViewHref')],
      ['External open-in-panel helper present', r.body.includes('function openExternal')],
      ['SW cache bumped to v19', (sw.body || '').includes('comb-shell-v19')],
      ['DOCX has Back to Comb', (docx.body || '').includes('Back to Comb') && (docx.body || '').includes('href="/"')],
      ['PDF wrapper has Back to Comb', (pdfWrap.body || '').includes('Back to Comb') && (pdfWrap.body || '').includes('href="/"')],
      ['No target=_blank in index.html', !r.body.includes('target="_blank"')],
      ...KEEP_CELLS.map(name => [`SKELETON keeps ${name}`, r.body.includes(`Project:"${name}"`)]),
      ...DROP_CELLS.map(name => [`SKELETON drops ${name}`, !r.body.includes(`Project:"${name}"`)]),
    ];
    for (const [name, passed] of checks) {
      console.log(passed ? 'PASS' : 'FAIL', name);
      passed ? ok++ : fail++;
    }
  } catch (e) {
    console.log('FAIL', 'Home page markup checks →', e.message);
    fail += 4;
  }

  console.log(`\n${ok}/${ok + fail} checks passed`);
  process.exit(fail ? 1 : 0);
})();
