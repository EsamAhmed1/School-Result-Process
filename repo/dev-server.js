/* Local dev server. Vercel serves public/ and api/ itself in production;
   this reproduces the same routing with no dependencies: node dev-server.js */

const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml',
};

function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
    return res.end(buf);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.replace('/api/', '').replace(/\.js$/, '');
    const mod = path.join(__dirname, 'api', `${name}.js`);
    if (!fs.existsSync(mod)) { res.writeHead(404); return res.end('{"error":"No such route"}'); }
    res.status = (code) => { res.statusCode = code; return res; };
    return require(mod)(req, res);
  }

  let file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!path.extname(file)) file += '.html';
  return sendFile(res, file);
}).listen(3000, () => console.log('http://localhost:3000'));
