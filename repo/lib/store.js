/**
 * Store layer.
 *
 * Builds the dataset once per serverless instance and evaluates it through the
 * engine on demand. No grade point or GPA is ever stored — every read runs the
 * engine, so a rule change or a mark revision can never leave a stale result
 * behind.
 */

const { buildDataset } = require('./seed');
const { evaluateStudent, buildChecklists } = require('./engine');

let dataset = null;
let published = true;   // office publishes results; students see them only when true
let marksOpenFlag = false;

function data() {
  if (!dataset) dataset = buildDataset();
  return dataset;
}

/** Reset to the published fixture. Backs the judges' reset control. */
function reset() {
  dataset = buildDataset();
  published = true;
  marksOpenFlag = false;
  return { ok: true, students: dataset.students.length };
}

function isPublished() { return published; }
function setPublished(value) { published = !!value; return published; }
function marksOpen() { return marksOpenFlag; }

function subjectsForClass(classId) {
  return data().subjects.filter((s) => s.classId === classId);
}

function evaluateOne(student) {
  const d = data();
  return evaluateStudent(student, subjectsForClass(student.classId), d.marks[student.code] || {});
}

function allResults() {
  return data().students.filter((s) => s.active).map(evaluateOne);
}

function findStudent(code) {
  return data().students.find((s) => s.code === code) || null;
}

function traceFor(code) {
  const student = findStudent(code);
  if (!student) return null;
  const result = evaluateOne(student);
  const cls = data().classes.find((c) => c.id === student.classId);
  return { ...result, className: cls ? cls.name : '', why: student.why || null };
}

function checklists() {
  return buildChecklists(allResults());
}

/** Dashboard counters. */
function summary() {
  const results = allResults();
  const lists = checklists();
  const distribution = {};
  for (const r of results) distribution[r.letter] = (distribution[r.letter] || 0) + 1;

  const passing = results.filter((r) => r.passed);
  const passed = passing.length;
  const batchGpa = passed
    ? Math.round((passing.reduce((sum, r) => sum + r.finalGpa, 0) / passed) * 100) / 100
    : 0;
  return {
    batchGpa,
    students: results.length,
    classes: data().classes.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? Math.round((passed / results.length) * 1000) / 10 : 0,
    distribution,
    lists: {
      optional: lists.optionalList.length,
      practical: lists.practicalList.length,
      absent: lists.absentList.length,
      overlaps: lists.overlaps.length,
    },
    edgeCases: data().students.filter((s) => s.isEdgeCase).length,
  };
}

/** Students with class name attached, for the roster page. */
function roster() {
  const d = data();
  return d.students.map((s) => ({
    ...s,
    className: (d.classes.find((c) => c.id === s.classId) || {}).name || '',
    subjectCount: subjectsForClass(s.classId).length,
  }));
}

module.exports = {
  data, reset, allResults, findStudent, traceFor, checklists, summary, roster, subjectsForClass,
  isPublished, setPublished, marksOpen,
};
