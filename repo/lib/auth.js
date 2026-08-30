/**
 * Authentication and role guards.
 *
 * Sessions are stateless signed tokens, because serverless instances do not
 * share memory. A token carries the username, role and expiry, and is signed
 * with HMAC-SHA256 so it cannot be edited by the client — a student cannot
 * turn their own token into an operations token.
 *
 * Every API route calls requireRole(). Hiding a nav link is never the control.
 */

const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'lsh26-t013-p08-demo-secret';
const TTL_MINUTES = 240;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Demo accounts. Passwords are stored as hashes, never in plain text.
 * These are fictional accounts for the judged demo and are listed in the
 * README so a judge can sign in as any role.
 */
const USERS = [
  {
    username: 'ops.admin', role: 'ops', name: 'Operations desk',
    hash: sha256('ops1234'), home: 'dashboard.html',
  },
  {
    username: 'exec.head', role: 'executive', name: 'School authority',
    hash: sha256('exec1234'), home: 'dashboard.html',
  },
  {
    username: 'teacher.shirin', role: 'teacher', name: 'Shirin Akter',
    hash: sha256('teach1234'), home: 'results.html', subjectIds: [104, 105],
  },
  {
    username: 'teacher.mahbub', role: 'teacher', name: 'Mahbub Alam',
    hash: sha256('teach1234'), home: 'results.html', subjectIds: [106, 206, 207],
  },
  {
    username: 'student.s001', role: 'student', name: 'Nusrat Jahan Mim',
    hash: sha256('stud1234'), home: 'student.html', studentCode: 'S001',
  },
  {
    username: 'student.s008', role: 'student', name: 'Arif Mahmud',
    hash: sha256('stud1234'), home: 'student.html', studentCode: 'S008',
  },
  {
    username: 'guardian.s001', role: 'guardian', name: 'Guardian of Nusrat Jahan Mim',
    hash: sha256('guard1234'), home: 'student.html', children: ['S001', 'S007'],
  },
];

const publicUser = (u) => ({
  username: u.username, role: u.role, name: u.name, home: u.home,
  studentCode: u.studentCode || null,
  children: u.children || null,
  subjectIds: u.subjectIds || null,
});

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    const user = USERS.find((u) => u.username === payload.username);
    return user || null;
  } catch (err) {
    return null;
  }
}

function login(username, password) {
  const user = USERS.find((u) => u.username === String(username || '').trim().toLowerCase());
  if (!user || user.hash !== sha256(String(password || ''))) return null;
  const token = sign({
    username: user.username, role: user.role, exp: Date.now() + TTL_MINUTES * 60000,
  });
  return { token, user: publicUser(user) };
}

/** Read the bearer token off a request. */
function currentUser(req) {
  const header = req.headers.authorization || '';
  return verify(header.replace(/^Bearer\s+/i, ''));
}

/**
 * Guard a route. Returns the user, or writes 401/403 and returns null —
 * callers must stop when it returns null.
 */
function requireRole(req, res, roles) {
  const user = currentUser(req);
  res.setHeader('Content-Type', 'application/json');
  if (!user) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Sign in to continue.' }));
    return null;
  }
  if (roles && roles.indexOf(user.role) === -1) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: 'Your role cannot view this.' }));
    return null;
  }
  return user;
}

/** Which student codes may this user see? null means all. */
function visibleStudents(user) {
  if (user.role === 'student') return [user.studentCode];
  if (user.role === 'guardian') return user.children || [];
  return null;
}

module.exports = { USERS, login, currentUser, requireRole, visibleStudents, publicUser };
