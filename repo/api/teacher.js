const store = require('../lib/store');
const { requireRole } = require('../lib/auth');

module.exports = (req, res) => {
  const user = requireRole(req, res, ['teacher']);
  if (!user) return;

  const ids = user.subjectIds || [];
  const subjects = store.data().subjects.filter((s) => ids.indexOf(s.id) > -1);

  const groups = subjects.map((subject) => {
    const cls = store.data().classes.find((c) => c.id === subject.classId);
    const rows = store.allResults()
      .filter((r) => r.classId === subject.classId)
      .map((r) => {
        const row = r.rows.find((x) => x.subjectId === subject.id);
        return {
          code: r.code, name: r.name, roll: r.roll,
          display: row.display, gp: row.gp, status: row.status,
          ruleId: row.ruleId, ruleText: row.ruleText,
        };
      })
      .sort((a, b) => a.roll - b.roll);
    return {
      subjectId: subject.id,
      subject: subject.name,
      className: cls ? cls.name : '',
      hasPractical: subject.hasPractical,
      isOptional: subject.isOptional,
      students: rows,
      failing: rows.filter((r) => r.status !== 'pass').length,
    };
  });

  res.statusCode = 200;
  res.end(JSON.stringify({ teacher: user.name, groups, marksOpen: store.marksOpen() }));
};
