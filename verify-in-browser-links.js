import http from 'node:http';

const BASE = 'http://127.0.0.1:8765';
const CASES = [
  { path: '/', name: 'Comb home page', expectType: 'text/html' },
  { path: '/eta.json', name: 'ETA JSON', expectType: 'application/json' },
  { path: '/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf', name: 'BMSR114 study PDF', expectType: 'application/pdf' },
  { path: '/files/deadlines/briefs/2026-08-14/BMSR114-Written-Test-brief.docx', name: 'Sample assignment DOCX', expectType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { path: '/preview/docx.html?file=/files/deadlines/briefs/2026-08-14/BMSR114-Written-Test-brief.docx', name: 'DOCX preview page', expectType: 'text/html' },
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
    const checks = [
      ['ETA panel present', r.body.includes('id="etaCard"')],
      ['ETA JSON lists PDF', etaBody.includes('/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf')],
      ['ETA JSON lists DOCX', etaBody.includes('/files/deadlines/briefs/2026-08-14/BMSR114-Written-Test-brief.docx')],
      ['DOCX preview page linked', r.body.includes('/preview/docx.html?file=')],
      ['No target=_blank in index.html', !r.body.includes('target="_blank"')],
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
