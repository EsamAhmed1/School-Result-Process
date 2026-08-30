const store = require('../lib/store');
const { requireRole } = require('../lib/auth');

module.exports = (req, res) => {
  if (!requireRole(req, res, ['ops', 'executive', 'teacher'])) return;
  const url = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('code');
  res.setHeader('Content-Type', 'application/json');

  if (!code) {
    const list = store.roster().map((s) => ({
      code: s.code, name: s.name, className: s.className, isEdgeCase: s.isEdgeCase,
    }));
    return res.status(200).end(JSON.stringify({ students: list }));
  }

  const trace = store.traceFor(code);
  if (!trace) return res.status(404).end(JSON.stringify({ error: 'Student not found' }));
  return res.status(200).end(JSON.stringify(trace));
};
