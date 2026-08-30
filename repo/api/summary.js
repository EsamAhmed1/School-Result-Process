const store = require('../lib/store');
const { requireRole } = require('../lib/auth');

module.exports = (req, res) => {
  if (!requireRole(req, res, ['ops', 'executive'])) return;
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify(store.summary()));
};
