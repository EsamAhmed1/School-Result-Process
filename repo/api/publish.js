const store = require('../lib/store');
const { requireRole } = require('../lib/auth');

module.exports = (req, res) => {
  const user = requireRole(req, res, ['ops']);
  if (!user) return;
  const url = new URL(req.url, 'http://localhost');
  const to = url.searchParams.get('published');
  const value = to === null ? !store.isPublished() : to === 'true';
  res.statusCode = 200;
  res.end(JSON.stringify({ published: store.setPublished(value) }));
};
