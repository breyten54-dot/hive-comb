// Offline check: eta.json assignments vs tests split (mirrors index.html filters).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eta = JSON.parse(readFileSync(path.join(root, 'public', 'eta.json'), 'utf8'));
const items = Array.isArray(eta.items) ? eta.items : [];

function isEtaTest(it) {
  if (!it) return false;
  if (it.type === 'Test') return true;
  return /written\s*test/i.test(it.name || '');
}
function isEtaAssignment(it) {
  if (!it) return false;
  if (it.type !== 'Assignment') return false;
  return !isEtaTest(it);
}

const tests = items.filter(isEtaTest);
const assigns = items.filter(isEtaAssignment);

console.log('ETA split verification');
console.log('======================');
console.log('Assignments (left rail):');
assigns.forEach((it) => console.log(`  - ${it.date || '????-??-??'} | ${it.name}`));
console.log('Tests (ETA tests card):');
tests.forEach((it) => console.log(`  - ${it.date || '????-??-??'} | ${it.name}`));

let fail = 0;
function check(name, ok) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) fail++;
}

check('>=2 real assignments', assigns.length >= 2);
check('Role-Play present', assigns.some((it) => it.name === 'Learning Activity 1: Role-Play Scenarios'));
check('Interview present', assigns.some((it) => it.name === 'Key Functions - The Interview'));
check('BMSR114 is a Test', tests.some((it) => /BMSR 114 Written Test/i.test(it.name || '') && it.type === 'Test'));
check('No written-test in assignments', !assigns.some((it) => /written\s*test/i.test(it.name || '')));
check('Interview word handout path set', assigns.some((it) =>
  it.name === 'Key Functions - The Interview'
  && /Key-Functions-The-Interview/.test(it.word || '')
));

process.exit(fail ? 1 : 0);
