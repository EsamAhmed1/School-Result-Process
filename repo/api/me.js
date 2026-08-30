const { requireRole, publicUser } = require('../lib/auth');

module.exports = (req, res) => {
  const user = requireRole(req, res, null);
  if (!user) return;
  res.statusCode = 200;
  res.end(JSON.stringify(publicUser(user)));
};
