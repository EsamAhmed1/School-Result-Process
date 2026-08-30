# P08 — School Result Processing and GPA Engine
### Build plan for `lsh26-t013-p08` · Team LSH26-T013

Stack: HTML, CSS, vanilla JS, PHP 8, MySQL 8. No frontend framework.

---

## 0. Scope warning, read this first

The brief describes a system that would normally take a team two weeks. The hackathon
judges four required items on the live app:

| | Required item | Where it lives |
|---|---|---|
| R1 | 60+ students, two classes, 6 compulsory + 1 optional, 8+ edge cases | `database/seed.sql` + Students page |
| R2 | Subject grade points, final GPA, letter grade | `src/engine/` + Results page |
| R3 | Per-student trace: mark used, grade point, deciding rule | Trace page |
| R4 | Three checking lists | Checking lists page |

Everything else in the brief — the four panels, challenges, audit log, reports, notifications —
is Difficulty credit, and Difficulty only pays out for required items that already work.
Build in the phase order in section 7. Do not start the challenge workflow until R1–R4 are
live on the deployed URL.

---

## 1. Project folder structure

```
lsh26-t013-p08/
├── EVENT.md                       first event-work commit
├── README.md                      team ID, live URL, setup, proof per requirement
├── LICENSES.md                    every library, font, icon, asset
├── evaluation-manifest.json
├── Dockerfile                     php:8.2-apache, for Railway/Render
├── .env.example                   DB_HOST, DB_NAME, DB_USER, DB_PASS  (never .env)
│
├── config/
│   ├── db.php                     PDO singleton, reads env vars
│   ├── grading.php                THE grading policy. Bands, pass marks, letter bands.
│   └── app.php                    session bootstrap, base path, error mode
│
├── src/                           not web-accessible
│   ├── engine/
│   │   ├── GradePolicy.php        loads config/grading.php, mark -> grade point
│   │   ├── SubjectResult.php      value object: gp, status, rule id, rule text
│   │   ├── GpaEngine.php          subject + student evaluation. THE only GPA logic.
│   │   └── ChecklistBuilder.php   the three checking lists
│   ├── repo/
│   │   ├── StudentRepo.php  MarkRepo.php  SubjectRepo.php
│   │   ├── ChallengeRepo.php  AuditRepo.php  NotificationRepo.php
│   ├── auth/
│   │   ├── Auth.php               login, logout, current user
│   │   └── Guard.php              require_role(), require_own_student()
│   └── lib/
│       ├── Validate.php  Csv.php  Flash.php  Html.php (escaping helper)
│
├── partials/
│   ├── head.php  sidebar.php  topbar.php  foot.php
│   └── components/ stat_card.php  status_badge.php  data_table.php
│
├── public/                        document root
│   ├── index.php                  landing: role entry
│   ├── login.php  logout.php
│   ├── ops/       students.php teachers.php classes.php subjects.php
│   │               marks_control.php results.php trace.php checklists.php
│   │               challenges.php reports.php audit.php
│   ├── teacher/   dashboard.php mark_entry.php preview.php challenges.php
│   ├── student/   result.php trace.php challenge_new.php challenges.php
│   ├── exec/      dashboard.php monitoring.php reports.php
│   ├── api/       recalc.php search.php mark_save.php   (JSON, same guards)
│   └── assets/
│       ├── css/  tokens.css  base.css  layout.css  components.css
│       ├── js/   table-filter.js  mark-entry.js  confirm.js
│       └── img/
│
├── database/
│   ├── schema.sql                 DDL only
│   ├── seed.sql                   60+ students, subjects, users, marks
│   └── reset.php                  re-runs schema + seed  (judges' reset button)
│
└── docs/  PLAN.md  ERD.png  screenshots/
```

Rule that keeps the code honest: **no file outside `src/engine/` may compute a grade point
or a GPA.** Pages call the engine and render what it returns.

---

## 2. Database schema

### Relationships in words

A class has many subjects and many students. A student belongs to one class and optionally
links to a user account. A guardian is a user linked to one or more students through a join
table. A teacher is a user assigned to (class, subject) pairs. Marks are one row per
(exam, student, subject). A challenge targets one component of one mark and moves through a
status machine. Every mark change writes an audit row.

```sql
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('ops','teacher','student','guardian','executive') NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE classes (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(60) NOT NULL,          -- 'Class 10 — Science'
  section VARCHAR(10) DEFAULT NULL,
  UNIQUE KEY uq_class (name, section)
) ENGINE=InnoDB;

CREATE TABLE subjects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  class_id      INT NOT NULL,
  name          VARCHAR(80) NOT NULL,
  code          VARCHAR(20) NOT NULL,
  is_optional   TINYINT(1) NOT NULL DEFAULT 0,
  has_practical TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_subject (class_id, code),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE students (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT DEFAULT NULL,
  student_code VARCHAR(20) NOT NULL UNIQUE,   -- 'S045'
  full_name  VARCHAR(120) NOT NULL,
  class_id   INT NOT NULL,
  roll       INT NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_roll (class_id, roll),
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE SET NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB;

CREATE TABLE guardian_student (
  guardian_user_id INT NOT NULL,
  student_id       INT NOT NULL,
  relation         VARCHAR(30) DEFAULT NULL,
  PRIMARY KEY (guardian_user_id, student_id),
  FOREIGN KEY (guardian_user_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (student_id)       REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE teacher_assignments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  teacher_user_id INT NOT NULL,
  class_id        INT NOT NULL,
  subject_id      INT NOT NULL,
  UNIQUE KEY uq_assign (teacher_user_id, class_id, subject_id),
  FOREIGN KEY (teacher_user_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (class_id)        REFERENCES classes(id)  ON DELETE CASCADE,
  FOREIGN KEY (subject_id)      REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE exams (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(80) NOT NULL,
  marks_open         TINYINT(1) NOT NULL DEFAULT 1,
  results_published  TINYINT(1) NOT NULL DEFAULT 0,
  challenge_open     TINYINT(1) NOT NULL DEFAULT 0,
  challenge_deadline DATETIME DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE marks (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_id         INT NOT NULL,
  student_id      INT NOT NULL,
  subject_id      INT NOT NULL,
  theory          TINYINT UNSIGNED DEFAULT NULL,   -- 0..75, NULL when absent
  practical       TINYINT UNSIGNED DEFAULT NULL,   -- 0..25, NULL when absent or no practical
  theory_absent   TINYINT(1) NOT NULL DEFAULT 0,
  practical_absent TINYINT(1) NOT NULL DEFAULT 0,
  is_revised      TINYINT(1) NOT NULL DEFAULT 0,
  entered_by      INT DEFAULT NULL,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mark (exam_id, student_id, subject_id),
  FOREIGN KEY (exam_id)    REFERENCES exams(id)    ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (entered_by) REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE challenges (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_id           INT NOT NULL,
  student_id        INT NOT NULL,
  subject_id        INT NOT NULL,
  component         ENUM('theory','practical') NOT NULL,
  reason            TEXT NOT NULL,
  status            ENUM('submitted','pending_review','approved','rejected',
                         'rechecking','resolved') NOT NULL DEFAULT 'submitted',
  submitted_by      INT NOT NULL,              -- student or guardian user
  assigned_teacher  INT DEFAULT NULL,
  original_mark     TINYINT UNSIGNED DEFAULT NULL,
  final_mark        TINYINT UNSIGNED DEFAULT NULL,
  grade_changed     TINYINT(1) NOT NULL DEFAULT 0,
  decision_note     TEXT DEFAULT NULL,
  submitted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at       DATETIME DEFAULT NULL,
  UNIQUE KEY uq_subject_lock (exam_id, student_id, subject_id),
  FOREIGN KEY (exam_id)          REFERENCES exams(id),
  FOREIGN KEY (student_id)       REFERENCES students(id),
  FOREIGN KEY (subject_id)       REFERENCES subjects(id),
  FOREIGN KEY (submitted_by)     REFERENCES users(id),
  FOREIGN KEY (assigned_teacher) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id    INT NOT NULL,
  subject_id    INT NOT NULL,
  component     ENUM('theory','practical') NOT NULL,
  original_mark VARCHAR(10) DEFAULT NULL,      -- string so 'AB' fits
  updated_mark  VARCHAR(10) DEFAULT NULL,
  changed_by    INT NOT NULL,
  reason        VARCHAR(255) NOT NULL,
  challenge_id  BIGINT DEFAULT NULL,
  changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (changed_by) REFERENCES users(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  message    VARCHAR(255) NOT NULL,
  link       VARCHAR(255) DEFAULT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Two design notes worth defending to a judge:

- **No GPA column anywhere.** Results are computed by the engine on read. A rule fix can never
  leave stale grades in the database, and challenge recalculation becomes automatic rather than
  a cascade of UPDATE statements.
- **`uq_subject_lock`** on `challenges` implements the subject-level challenge lock as a database
  constraint, not a UI check. One challenge per subject per exam per student, enforced at the
  bottom of the stack.

---

## 3. Pages

**Public** — `index.php` (landing, role entry), `login.php`, `logout.php`

**Operations** — students (list, add, edit, deactivate, search, filter by class) ·
teachers (list, add, edit, assign to class+subject) · classes · subjects (mark optional,
mark has-practical) · marks control (open/close submission, per-teacher submission monitor) ·
results (search, filter, subject-wise view, GPA, letter, pass/fail) · trace (per student) ·
checking lists (three tabs + overlaps) · publication toggle · challenges (queue, detail,
approve, reject, assign) · challenge window control · reports (4 report types, CSV export) ·
audit log

**Teacher** — dashboard (assigned classes, subjects, student counts, pending submissions,
pending challenges) · mark entry (grid per class+subject, theory 0–75, practical 0–25 only
when the subject has one, AB toggle) · subject result preview (live grade point and pass/fail) ·
challenges (recheck, keep or update mark, submit decision)

**Student / Guardian** — result (blocked until published) · trace (subject rules + GPA
arithmetic) · new challenge (subject, component, reason; only while window open) ·
challenge tracking (status timeline) · notifications

**Executive** — dashboard (totals, pass/fail percentage, grade distribution, challenge stats) ·
monitoring (challenges by subject, by teacher, changed vs unchanged) · reports (read-only)

---

## 4. Role permission matrix

| Capability | Ops | Teacher | Student | Guardian | Exec |
|---|:--:|:--:|:--:|:--:|:--:|
| Manage students, teachers, classes, subjects | ✔ | — | — | — | — |
| Assign teachers to class+subject | ✔ | — | — | — | — |
| Open/close mark submission | ✔ | — | — | — | — |
| Enter or edit marks | — | own assignments only | — | — | — |
| View all results and traces | ✔ | own subjects only | own only | linked child only | ✔ read-only |
| View unpublished results | ✔ | own subjects | — | — | ✔ |
| Publish results | ✔ | — | — | — | — |
| Checking lists | ✔ | — | — | — | ✔ |
| Submit challenge | — | — | ✔ | ✔ | — |
| Approve / reject challenge | ✔ | — | — | — | — |
| Recheck and change mark | — | assigned challenges only | — | — | — |
| Audit log | ✔ | — | — | — | ✔ |
| Reports and CSV export | ✔ | — | — | — | ✔ |

Enforcement: every page begins with `Guard::require_role([...])`. Every data query that touches
a student is additionally scoped — `Guard::teacher_owns($subject_id)`,
`Guard::can_view_student($student_id)`. Hiding a nav link is never the control.

---

## 5. GPA engine logic

All of it lives in `src/engine/`, configured from `config/grading.php`:

```php
return [
  'theory'    => ['max' => 75, 'pass' => 25],
  'practical' => ['max' => 25, 'pass' => 8],
  'bands'     => [   // total out of 100, descending; first match wins
    ['min' => 80, 'gp' => 5.00], ['min' => 70, 'gp' => 4.00],
    ['min' => 60, 'gp' => 3.50], ['min' => 50, 'gp' => 3.00],
    ['min' => 40, 'gp' => 2.00], ['min' => 33, 'gp' => 1.00],
    ['min' => 0,  'gp' => 0.00],
  ],
  'letters'   => [   // applied to the FINAL gpa, descending
    ['min' => 5.00, 'letter' => 'A+'], ['min' => 4.00, 'letter' => 'A'],
    ['min' => 3.50, 'letter' => 'A-'], ['min' => 3.00, 'letter' => 'B'],
    ['min' => 2.00, 'letter' => 'C'],  ['min' => 1.00, 'letter' => 'D'],
    ['min' => 0.00, 'letter' => 'F'],
  ],
  'optional_deduction' => 2.0,
  'divisor'            => 6,
  'gpa_cap'            => 5.00,
];
```

### Per subject — first matching rule wins, and its ID is recorded

1. Theory or practical absent → GP `0.00`, display `AB`, rule **R-12**
2. Theory below 25 → GP `0.00`, failed, rule **R-11** ("theory 22, below 25")
3. Subject has a practical and practical below 8 → GP `0.00`, failed, rule **R-11**
4. Otherwise → GP from the band table on `theory + practical`, rule **R-10**

The order matters. A student who is absent *and* below the pass mark reports R-12, because
absence is the more specific fact.

### Per student

```
compulsorySum = sum of the 6 compulsory grade points
optionalContribution = max(0, optionalGP - 2)                    [R-13]
rawGpa = min(5.00, (compulsorySum + optionalContribution) / 6)
rawGpa = round(rawGpa, 2)                                        half-up

if any compulsory subject GP == 0:
    finalGpa = 0.00, letter = 'F', failedSubjects = [those subjects]   [R-13 override]
else:
    finalGpa = rawGpa, letter = band(finalGpa)
```

`rawGpa` is always kept and always rendered in the trace, including when the override fires.
Optional absence sets the optional contribution to 0 but never triggers the override.

### Documented assumptions

- The brief does not give a mark-to-grade-point table. The standard 80/70/60/50/40/33 bands are
  used, matching the 25 + 8 = 33 pass total implied by the pass marks. Configurable in one place.
- Theory-only subjects are marked out of 100 with a pass mark of 33, keeping the band table
  uniform. Otherwise a theory-only subject could never exceed GP 4.00.
- Letter bands are applied after rounding to 2 dp, so 3.495 rounds to 3.50 and reads A-.
- The brief's letter list has a typo where A- and B run together; A- = 3.50–3.99 and
  B = 3.00–3.49 is the reading used.

### Edge-case students to seed (11, exceeding the 8 required)

1. One compulsory failure, other six averaging ~4.7 → raw 3.9x, final 0.00 F
2. Theory 61, practical 6 → practical fail, R-11
3. Optional GP exactly 2.00 → contributes 0, on the optional list
4. Optional GP 1.00 → contributes 0
5. Optional GP 3.00 → contributes 1.00, visibly lifts the GPA
6. AB in a compulsory subject → R-12, F
7. AB in the optional subject → real GPA, on the absent and optional lists
8. All six at 5.00 with optional 5.00 → raw 5.50, capped to 5.00, A+
9. Theory exactly 25, practical exactly 8 → passes at 33, GP 1.00
10. Practical fail in one subject, AB in another → two lists
11. GPA landing on exactly 3.50 and exactly 3.49 → proves the band boundaries

---

## 6. Challenge workflow

```
student/guardian submits  ──▶  submitted
                                  │  ops opens the queue
                                  ▼
                            pending_review
                    ┌─────────────┴─────────────┐
              ops rejects                  ops approves
                    ▼                            ▼
                rejected                    approved ──▶ assigned to the
                                                          subject's teacher
                                                              │
                                                              ▼
                                                        rechecking
                                        teacher keeps mark  ／  ＼  teacher updates mark
                                                          ▼      ▼
                                                       resolved (grade_changed 0 / 1)
```

On a teacher decision that changes the mark, one transaction does all of:
update `marks`, set `marks.is_revised = 1`, write `audit_log` with old and new values and
`challenge_id`, set the challenge to `resolved` with `final_mark` and `grade_changed`, and insert
a notification for the student and every linked guardian. GPA needs no update because it is
computed on read — that is the payoff of the no-stored-GPA decision.

Constraints: submission only while `challenge_open = 1` and before `challenge_deadline`;
one challenge per subject per student per exam (`uq_subject_lock`); a teacher may only act on
challenges where `assigned_teacher = current user`.

---

## 7. Development plan in phases

Times assume the 6:00 pm to midnight window and three people working in parallel.

| Phase | Time | Work | Owner |
|---|---|---|---|
| 0 | 6:00–6:30 | Repo, EVENT.md first commit, Dockerfile, deploy hello-world + DB connection to the live host | Esam |
| 1 | 6:30–7:15 | `config/grading.php`, `GpaEngine`, `SubjectResult`; a CLI test script asserting all 11 edge cases | Esam |
| 2 | 6:30–7:30 | `schema.sql`, then `seed.sql` — classes, subjects, 60 students, marks, the 11 edge cases, demo users | Shaishab |
| 3 | 6:30–7:30 | `tokens.css`, layout, sidebar, table and badge components from the design system | Tanzil |
| 4 | 7:30–8:45 | **R1 + R2** — students list, results list with GPA and letter | Tanzil + Shaishab |
| 5 | 8:00–9:00 | **R3** — the trace page, subject rules + GPA arithmetic + failure cause | Esam |
| 6 | 8:45–9:30 | **R4** — three checking lists and the overlap section | Shaishab |
| 7 | 9:30–10:00 | Deploy, screenshot each requirement, write README proof section | all |
| 8 | 10:00–10:45 | Login, roles, guards, the four panels wired to existing pages | Esam + Tanzil |
| 9 | 10:45–11:20 | Mark entry, publication toggle, challenge submit → approve → recheck → resolve, audit log | all |
| 10 | 11:20–11:40 | manifest, LICENSES.md, CSV export, reset.php | Shaishab |
| 11 | 11:40–12:00 | Final deploy, verify live, paste 40-char SHA, submit | Esam |

**Checkpoint at 9:30.** If R1–R4 are not all working on the deployed URL, stop building panels
and fix them. Four working required items plus a login screen beats eight half-finished panels.
