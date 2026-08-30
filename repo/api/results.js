const store = require('../lib/store');
const { requireRole } = require('../lib/auth');

/** The single rule a reader most needs to see for this student. */
function decidingRule(r) {
  const failed = r.rows.filter((x) => !x.isOptional && x.gp === 0);
  if (failed.length) {
    const f = failed[0];
    if (f.ruleId === 'R-12') return { ruleId: 'R-12', text: 'Absent in ' + f.subject };
    const part = f.ruleText.indexOf('Practical') === 0
      ? 'Practical ' + f.practical + '/' + f.practicalMax
      : 'Theory ' + f.theory + '/' + f.theoryMax;
    return { ruleId: 'R-11', text: part + ' in ' + f.subject };
  }
  const opt = r.rows.filter((x) => x.isOptional)[0];
  if (opt && opt.status === 'absent') return { ruleId: 'R-12', text: 'Absent in optional' };
  if (opt && opt.gp <= 2) return { ruleId: 'R-13', text: 'Optional gave 0' };
  if (r.capApplied) return { ruleId: 'R-13', text: 'Capped at 5.00' };
  return { ruleId: 'R-10', text: 'Grade from the band table' };
}

module.exports = (req, res) => {
  if (!requireRole(req, res, ['ops', 'executive', 'teacher'])) return;
  const url = new URL(req.url, 'http://localhost');
  const classId = url.searchParams.get('classId');
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const status = url.searchParams.get('status');

  let rows = store.allResults().map((r) => ({
    code: r.code, name: r.name, classId: r.classId, roll: r.roll,
    subjects: r.rows.map((x) => ({
      subject: x.subject, display: x.display, gp: x.gp,
      status: x.status, isOptional: x.isOptional,
    })),
    rawGpa: r.rawGpa, finalGpa: r.finalGpa, letter: r.letter,
    passed: r.passed, overrideApplied: r.overrideApplied,
    failedCompulsory: r.failedCompulsory.map((f) => f.subject),
    flagged: r.flags.optionalList || r.flags.practicalList || r.flags.absentList,
    decidedBy: decidingRule(r),
  }));

  if (classId) rows = rows.filter((r) => String(r.classId) === String(classId));
  if (status === 'pass') rows = rows.filter((r) => r.passed);
  if (status === 'fail') rows = rows.filter((r) => !r.passed);
  if (q) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(q)
      || r.code.toLowerCase().includes(q));
  }

  // dashboard view: the students whose result the rules changed, first
  if (url.searchParams.get('flagged')) {
    // failures first, then results a checking-list rule changed, then the rest
    const rank = (r) => (!r.passed ? 2 : r.flagged ? 1 : 0);
    rows.sort((a, b) => (rank(b) - rank(a)) || (b.rawGpa - a.rawGpa));
  }
  const limit = parseInt(url.searchParams.get('limit'), 10);
  if (limit > 0) rows = rows.slice(0, limit);

  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify({ classes: store.data().classes, results: rows }));
};
