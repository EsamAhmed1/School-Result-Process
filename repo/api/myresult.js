const store = require('../lib/store');
const { requireRole, visibleStudents } = require('../lib/auth');

module.exports = (req, res) => {
  const user = requireRole(req, res, ['student', 'guardian']);
  if (!user) return;

  const allowed = visibleStudents(user) || [];
  const url = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('code') || allowed[0];

  if (allowed.indexOf(code) === -1) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'You can only view your own result.' }));
  }

  const children = allowed.map((c) => {
    const st = store.findStudent(c);
    return { code: c, name: st ? st.name : c };
  });

  if (!store.isPublished()) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ published: false, allowed, children }));
  }

  const trace = store.traceFor(code);
  if (!trace) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Result not found.' }));
  }
  const cls = store.data().classes.find((c) => c.id === trace.classId);
  const teacher = (store.data().teachers.find((t) => (t.subjects || [])
    .some((id) => trace.rows.some((r) => r.subjectId === id))) || {}).name || null;

  res.statusCode = 200;
  return res.end(JSON.stringify({
    published: true,
    allowed,
    children,
    trace,
    className: cls ? cls.name : '',
    classTeacher: teacher,
  }));
};
