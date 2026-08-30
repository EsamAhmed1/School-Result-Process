const { login } = require('../lib/auth');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Use POST.' }));
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  return req.on('end', () => {
    let creds = {};
    try { creds = JSON.parse(body || '{}'); } catch (err) { creds = {}; }
    const out = login(creds.username, creds.password);
    if (!out) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'That username and password do not match.' }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(out));
  });
};
