/* Shared UI for the Result Engine pages. Vanilla JS, no build step. */

/* ---------- icons from the design ---------- */
const I = {
  cap: '<path d="M12 3 2 8l10 5 10-5-10-5Z" fill="#4C0585"/><path d="M6 11v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V11" stroke="#4C0585" stroke-width="1.8" stroke-linecap="round"/><path d="M21 8.5v5" stroke="#DBB5EE" stroke-width="1.8" stroke-linecap="round"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  student: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round"/>',
  lists: '<path d="M9 5h11M9 12h11M9 19h11" stroke-linecap="round"/><path d="m3 5 1.6 1.6L7 4M3 12l1.6 1.6L7 11M3 19l1.6 1.6L7 18" stroke-linecap="round" stroke-linejoin="round"/>',
  results: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10h8M8 14h5" stroke-linecap="round"/>',
  classes: '<path d="M4 20V9l8-5 8 5v11" stroke-linejoin="round"/><path d="M9 20v-6h6v6"/>',
  rules: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke-linecap="round"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" stroke-linecap="round"/><path d="M10 8 6 12l4 4M6 12h9" stroke-linecap="round" stroke-linejoin="round"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z" stroke-linejoin="round"/><path d="M10.5 20a2 2 0 0 0 3 0" stroke-linecap="round"/>',
  warn: '<path d="M12 4.5 20 19H4l8-14.5Z" stroke-linejoin="round"/><path d="M12 10v4M12 16.6v.2" stroke-linecap="round"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.2v.2" stroke-linecap="round"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0" stroke-linecap="round"/><path d="M16 6.2a3.2 3.2 0 0 1 0 6M18 19a6 6 0 0 0-2-4.4" stroke-linecap="round"/>',
  tick: '<path d="m5 12.5 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round"/>',
  cross: '<path d="M7 7l10 10M17 7 7 17" stroke-linecap="round"/>',
  flag: '<path d="M4 19V5M4 6h13l-2.2 3.2L17 12.5H4" stroke-linejoin="round"/>',
};

function svg(name, opts) {
  const o = opts || {};
  return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (o.stroke || 'currentColor')
    + '" stroke-width="' + (o.w || 1.8) + '" width="' + (o.size || 18) + '" height="'
    + (o.size || 18) + '" aria-hidden="true">' + I[name] + '</svg>';
}

/* ---------- helpers ---------- */

function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function gp(v) { return Number(v).toFixed(2); }

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map(function (w) { return w[0]; }).join('').toUpperCase();
}

function letterChip(letter) {
  const cls = letter === 'F' ? ' is-fail' : letter === 'A+' ? ' is-top' : '';
  return '<span class="letter' + cls + '">' + esc(letter) + '</span>';
}

function ruleChip(ruleId) {
  const cls = ruleId === 'R-11' ? ' is-fail' : ruleId === 'R-12' ? ' is-absent' : '';
  return '<span class="rule' + cls + '">' + esc(ruleId) + '</span>';
}

function statusBadge(status) {
  const map = { pass: ['badge-pass', 'Passed'], fail: ['badge-fail', 'Failed'],
    absent: ['badge-absent', 'Absent'] };
  const v = map[status] || map.pass;
  return '<span class="badge ' + v[0] + '">' + v[1] + '</span>';
}

function whoCell(name, sub, href) {
  const inner = '<span class="avatar">' + esc(initials(name)) + '</span>'
    + '<span><b>' + esc(name) + '</b><span>' + esc(sub) + '</span></span>';
  return href
    ? '<a class="who-cell" href="' + href + '">' + inner + '</a>'
    : '<div class="who-cell">' + inner + '</div>';
}

/* ---------- session ---------- */

function session() {
  const token = sessionStorage.getItem('p08.token');
  if (!token) return null;
  try { return { token: token, user: JSON.parse(sessionStorage.getItem('p08.user') || 'null') }; }
  catch (e) { return null; }
}

function signOut() {
  sessionStorage.removeItem('p08.token');
  sessionStorage.removeItem('p08.user');
  window.location.href = 'index.html';
}

function requireSession(roles) {
  const s = session();
  if (!s || !s.user) { window.location.href = 'index.html'; return null; }
  if (roles && roles.indexOf(s.user.role) === -1) { window.location.href = s.user.home; return null; }
  return s.user;
}

function api(path, options) {
  const s = session();
  const opts = Object.assign({ headers: {} }, options || {});
  if (s) opts.headers.Authorization = 'Bearer ' + s.token;
  return fetch(path, opts).then(function (r) {
    if (r.status === 401) { signOut(); throw new Error('Your session expired.'); }
    if (!r.ok) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        throw new Error(b.error || 'Request failed (' + r.status + ')');
      });
    }
    return r.json();
  });
}

/* ---------- chrome ---------- */

const NAV = {
  ops: [
    { label: 'Results', head: true },
    { href: 'dashboard.html', label: 'Dashboard', icon: 'dashboard' },
    { href: 'results.html', label: 'All results', icon: 'results' },
    { href: 'student.html', label: 'Student result', icon: 'student' },
    { href: 'lists.html', label: 'Checking lists', icon: 'lists' },
    { label: 'School', head: true },
    { href: 'results.html?classId=1', label: 'Classes', icon: 'classes' },
    { href: 'rules.html', label: 'Grading rules', icon: 'rules' },
  ],
  executive: [
    { label: 'Results', head: true },
    { href: 'dashboard.html', label: 'Dashboard', icon: 'dashboard' },
    { href: 'results.html', label: 'All results', icon: 'results' },
    { href: 'student.html', label: 'Student result', icon: 'student' },
    { href: 'lists.html', label: 'Checking lists', icon: 'lists' },
    { label: 'School', head: true },
    { href: 'rules.html', label: 'Grading rules', icon: 'rules' },
  ],
  teacher: [
    { label: 'Results', head: true },
    { href: 'results.html', label: 'All results', icon: 'results' },
    { href: 'student.html', label: 'Student result', icon: 'student' },
    { label: 'School', head: true },
    { href: 'rules.html', label: 'Grading rules', icon: 'rules' },
  ],
  student: [
    { label: 'Results', head: true },
    { href: 'student.html', label: 'My result', icon: 'student' },
    { href: 'rules.html', label: 'Grading rules', icon: 'rules' },
  ],
  guardian: [
    { label: 'Results', head: true },
    { href: 'student.html', label: 'My children', icon: 'student' },
    { href: 'rules.html', label: 'Grading rules', icon: 'rules' },
  ],
};

function brandBlock() {
  return '<div class="brand">'
    + '<div class="brand-mark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none">'
    + I.cap + '</svg></div>'
    + '<div><div class="brand-name">Result Engine</div>'
    + '<div class="brand-sub">Byte Bandits</div></div></div>';
}

function renderSidebar(active, footNote) {
  const user = (session() || {}).user;
  if (!user) return;
  const items = (NAV[user.role] || NAV.ops).map(function (n) {
    if (n.head) return '<div class="nav-label">' + esc(n.label) + '</div>';
    const on = n.href.split('?')[0] === active ? ' class="is-active"' : '';
    return '<a' + on + ' href="' + n.href + '">' + svg(n.icon) + esc(n.label) + '</a>';
  }).join('');

  const side = document.querySelector('.sidebar');
  if (!side) return;
  side.innerHTML = brandBlock()
    + '<nav class="nav">' + items
    + '<a href="#" id="signout">' + svg('out') + 'Sign out</a></nav>'
    + '<div class="sidebar-foot"><div class="run-card"><b>Half yearly 2026</b>'
    + esc(footNote || 'Results calculated live from the marks.') + '</div></div>';

  document.getElementById('signout').addEventListener('click', function (e) {
    e.preventDefault(); signOut();
  });
}

function renderTopbar(placeholder) {
  const user = (session() || {}).user;
  const bar = document.querySelector('.topbar');
  if (!bar || !user) return;
  bar.innerHTML =
    '<div class="search">' + svg('search', { stroke: '#A794B8', w: 2 })
    + '<input type="search" id="topsearch" placeholder="'
    + esc(placeholder || 'Search a student, roll or subject') + '"></div>'
    + '<button class="icon-btn" aria-label="Notices">'
    + svg('bell', { stroke: '#4C0585', size: 20 }) + '</button>'
    + '<div class="user-chip"><div class="avatar">' + esc(initials(user.name)) + '</div>'
    + '<div><div class="who">' + esc(user.name) + '</div>'
    + '<div class="role">' + esc(roleLabel(user.role)) + '</div></div></div>';
}

function roleLabel(role) {
  return { ops: 'Exam office', executive: 'School authority', teacher: 'Teacher',
    student: 'Student', guardian: 'Guardian' }[role] || role;
}

/** The grading-scale strip used at the foot of several pages. */
function scaleStrip() {
  const bands = [['A+', 'exactly 5.00'], ['A', '4.00 – 4.99'], ['A−', '3.50 – 3.99'],
    ['B', '3.00 – 3.49'], ['C', '2.00 – 2.99'], ['D', '1.00 – 1.99'], ['F', 'fail']];
  return '<section class="scale"><h3>Letter grade from final GPA '
    + '<span class="rule" style="background:rgba(255,255,255,.2);color:#fff;'
    + 'border-color:rgba(255,255,255,.3)">R-10</span></h3><div class="scale-items">'
    + bands.map(function (b) {
      return '<div class="scale-item"><b>' + b[0] + '</b>' + b[1] + '</div>';
    }).join('') + '</div></section>';
}

function fail(node, message) {
  node.innerHTML = '<div class="card"><div class="err">' + esc(message) + '</div></div>';
}
