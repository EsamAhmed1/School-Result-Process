/**
 * Engine assertions. Run with: npm test
 *
 * These are the eleven hard-edge students from the brief plus rule-order
 * checks. No test framework, no dependencies — node runs this directly.
 */

const store = require('../lib/store');
const { evaluateSubject } = require('../lib/engine');

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = String(actual) === String(expected);
  if (ok) { passed += 1; console.log(`  pass  ${label}`); } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        expected ${expected}, got ${actual}`);
  }
}

function trace(code) {
  const t = store.traceFor(code);
  if (!t) throw new Error(`no student ${code}`);
  return t;
}

const row = (t, name) => t.rows.find((r) => r.subject === name);

console.log('\nR-11  theory and practical');
{
  const s = { id: 1, name: 'Physics', hasPractical: true };
  check('theory 24 fails', evaluateSubject(s, { theory: 24, practical: 20 }).gp, 0);
  check('practical 7 fails', evaluateSubject(s, { theory: 60, practical: 7 }).gp, 0);
  check('25 and 8 passes', evaluateSubject(s, { theory: 25, practical: 8 }).gp, 1);
  check('rule id on practical fail',
    evaluateSubject(s, { theory: 60, practical: 7 }).ruleId, 'R-11');
  const t = { id: 2, name: 'Bangla', hasPractical: false };
  check('theory-only 32 fails', evaluateSubject(t, { theory: 32 }).gp, 0);
  check('theory-only 33 passes', evaluateSubject(t, { theory: 33 }).gp, 1);
  check('theory-only 80 gives 5.00', evaluateSubject(t, { theory: 80 }).gp, 5);
}

console.log('\nR-12  absent takes priority over a low mark');
{
  const s = { id: 1, name: 'Physics', hasPractical: true };
  const r = evaluateSubject(s, { theoryAbsent: true, theory: 10, practical: 2 });
  check('absent reports R-12 not R-11', r.ruleId, 'R-12');
  check('absent displays AB', r.display, 'AB');
  check('absent grade point 0', r.gp, 0);
}

console.log('\nS001  strong average, one compulsory failure');
{
  const t = trace('S001');
  check('chemistry failed', row(t, 'Chemistry').gp, 0);
  check('chemistry rule', row(t, 'Chemistry').ruleId, 'R-11');
  check('uncancelled average stays visible', t.rawGpa > 3.5, true);
  check('final GPA cancelled', t.finalGpa, 0);
  check('letter F', t.letter, 'F');
  check('failure cause named', t.failedCompulsory[0].subject, 'Chemistry');
}

console.log('\nS002  practical fail with a passing theory');
{
  const t = trace('S002');
  const r = row(t, 'Physics');
  check('theory passed', r.theory >= 25, true);
  check('subject still 0', r.gp, 0);
  check('flagged on practical list', t.flags.practicalList, true);
  check('overall F', t.letter, 'F');
}

console.log('\nS003 / S004 / S005  the optional subject rule');
{
  const a = trace('S003');
  check('S003 optional exactly 2.00', a.optionalGp, 2);
  check('S003 contributes nothing', a.optionalContribution, 0);
  check('S003 on the optional list', a.flags.optionalList, true);

  const b = trace('S004');
  check('S004 optional 1.00', b.optionalGp, 1);
  check('S004 contributes nothing', b.optionalContribution, 0);

  const c = trace('S005');
  check('S005 optional 3.00', c.optionalGp, 3);
  check('S005 contributes 1.00', c.optionalContribution, 1);
  check('S005 not on the optional list', c.flags.optionalList, false);
}

console.log('\nS006 / S007  absence');
{
  const a = trace('S006');
  check('compulsory AB displays AB', row(a, 'Mathematics').display, 'AB');
  check('compulsory AB gives F', a.letter, 'F');
  check('compulsory AB cancels the GPA', a.finalGpa, 0);
  check('on the absent list', a.flags.absentList, true);

  const b = trace('S007');
  check('optional AB keeps a real GPA', b.finalGpa > 0, true);
  check('optional AB is not an overall failure', b.letter !== 'F', true);
  check('optional AB on the optional list', b.flags.optionalList, true);
  check('optional AB on the absent list', b.flags.absentList, true);
}

console.log('\nS008  the GPA cap');
{
  const t = trace('S008');
  check('cap applied', t.capApplied, true);
  check('capped to 5.00', t.finalGpa, 5);
  check('letter A+', t.letter, 'A+');
}

console.log('\nS009 / S011  boundaries');
{
  const a = trace('S009');
  check('25 + 8 passes the subject', row(a, 'ICT').gp, 1);
  check('S009 passes overall', a.passed, true);

  const b = trace('S011');
  check('lands exactly on 3.50', b.finalGpa, 3.5);
  check('3.50 reads A- not B', b.letter, 'A-');
}

console.log('\nS010  multiple conditions');
{
  const t = trace('S010');
  check('on the practical list', t.flags.practicalList, true);
  check('on the absent list', t.flags.absentList, true);
}

console.log('\nDataset and checking lists');
{
  const s = store.summary();
  check('at least 60 students', s.students >= 60, true);
  check('two classes', s.classes, 2);
  check('at least 8 edge cases', s.edgeCases >= 8, true);

  const l = store.checklists();
  check('optional list populated', l.optionalList.length > 0, true);
  check('practical list populated', l.practicalList.length > 0, true);
  check('absent list populated', l.absentList.length > 0, true);
  check('overlaps detected', l.overlaps.length > 0, true);

  const every = store.allResults().every(
    (r) => r.finalGpa >= 0 && r.finalGpa <= 5 && r.letter
  );
  check('every student has a valid GPA and letter', every, true);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
