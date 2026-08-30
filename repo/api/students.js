const store = require('../lib/store');
const { requireRole } = require('../lib/auth');

module.exports = (req, res) => {
  if (!requireRole(req, res, ['ops', 'executive'])) return;
  const url = new URL(req.url, 'http://localhost');
  const classId = url.searchParams.get('classId');
  const q = (url.searchParams.get('q') || '').toLowerCase();

  let rows = store.roster();
  if (classId) rows = rows.filter((s) => String(s.classId) === String(classId));
  if (q) {
    rows = rows.filter((s) => s.name.toLowerCase().includes(q)
      || s.code.toLowerCase().includes(q) || String(s.roll) === q);
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify({
    classes: store.data().classes,
    subjects: store.data().subjects,
    students: rows,
  }));
};
