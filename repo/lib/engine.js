/**
 * P08 GPA engine.
 *
 * The only module in the project that turns marks into grade points, GPAs
 * and letter grades. Every page and every API route calls into here.
 *
 * Rule IDs travel with the result so the trace renders exactly what the
 * engine decided and can never drift from the calculation.
 */

const {
  POLICY, RULES, gradePointForTotal, letterForGpa, roundGpa, theoryLimits,
} = require('./grading');

/**
 * Evaluate one subject for one student.
 *
 * Rule order matters: absence is reported before a low mark, because
 * absence is the more specific fact about the same row.
 */
function evaluateSubject(subject, mark) {
  const limits = theoryLimits(subject.hasPractical);
  const base = {
    subjectId: subject.id,
    subject: subject.name,
    isOptional: !!subject.isOptional,
    hasPractical: !!subject.hasPractical,
    theory: mark.theory,
    practical: mark.practical,
    theoryMax: limits.max,
    practicalMax: subject.hasPractical ? POLICY.practical.max : null,
  };

  // R-12 — absent in either component
  if (mark.theoryAbsent || mark.practicalAbsent) {
    return {
      ...base,
      display: 'AB',
      total: null,
      gp: 0.0,
      status: 'absent',
      ruleId: 'R-12',
      ruleText: mark.theoryAbsent
        ? 'Absent in theory. Subject grade point 0.00.'
        : 'Absent in practical. Subject grade point 0.00.',
    };
  }

  const theory = mark.theory ?? 0;
  const practical = subject.hasPractical ? (mark.practical ?? 0) : 0;
  const total = theory + practical;
  const display = subject.hasPractical
    ? `${theory} + ${practical} = ${total}`
    : `${theory}`;

  // R-11 — theory below the pass mark
  if (theory < limits.pass) {
    return {
      ...base,
      display,
      total,
      gp: 0.0,
      status: 'fail',
      ruleId: 'R-11',
      ruleText: `Theory ${theory} is below the pass mark of ${limits.pass}.`,
    };
  }

  // R-11 — practical below the pass mark
  if (subject.hasPractical && practical < POLICY.practical.pass) {
    return {
      ...base,
      display,
      total,
      gp: 0.0,
      status: 'fail',
      ruleId: 'R-11',
      ruleText: `Practical ${practical} is below the pass mark of ${POLICY.practical.pass}.`,
    };
  }

  // R-10 — band lookup
  const gp = gradePointForTotal(total);
  const band = POLICY.bands.find((b) => total >= b.min);
  return {
    ...base,
    display,
    total,
    gp,
    status: 'pass',
    ruleId: 'R-10',
    ruleText: `Total ${total} falls in the ${band.min} and above band.`,
  };
}

/**
 * Evaluate a whole student.
 *
 * `subjects` is the class's subject list, `marks` is a map of subjectId -> mark.
 * Returns the full result plus every intermediate value the trace needs.
 */
function evaluateStudent(student, subjects, marks) {
  const rows = subjects.map((s) => evaluateSubject(s, marks[s.id] || {
    theoryAbsent: true, practicalAbsent: false,
  }));

  const compulsory = rows.filter((r) => !r.isOptional);
  const optional = rows.find((r) => r.isOptional) || null;

  const compulsorySum = compulsory.reduce((sum, r) => sum + r.gp, 0);
  const optionalGp = optional ? optional.gp : 0;
  const optionalContribution = Math.max(0, optionalGp - POLICY.optionalDeduction);

  const uncapped = (compulsorySum + optionalContribution) / POLICY.divisor;
  const capApplied = uncapped > POLICY.gpaCap;
  const rawGpa = roundGpa(Math.min(uncapped, POLICY.gpaCap));

  // R-13 override — any compulsory subject at grade point 0 fails the student
  const failedCompulsory = compulsory.filter((r) => r.gp === 0);
  const overrideApplied = failedCompulsory.length > 0;

  const finalGpa = overrideApplied ? 0.0 : rawGpa;
  const letter = overrideApplied ? 'F' : letterForGpa(finalGpa);

  // Checking-list flags
  const absentSubjects = rows.filter((r) => r.status === 'absent').map((r) => r.subject);
  const practicalFails = rows
    .filter((r) => r.hasPractical && r.status !== 'absent'
      && (r.practical ?? 0) < POLICY.practical.pass)
    .map((r) => r.subject);
  const optionalFlagged = optional
    ? (optional.status === 'absent' || optional.gp <= POLICY.optionalDeduction)
    : false;

  return {
    studentId: student.id,
    code: student.code,
    name: student.name,
    classId: student.classId,
    roll: student.roll,
    rows,
    compulsorySum: roundGpa(compulsorySum),
    optionalSubject: optional ? optional.subject : null,
    optionalGp,
    optionalContribution: roundGpa(optionalContribution),
    formula: `(${compulsory.map((r) => r.gp.toFixed(2)).join(' + ')}`
      + ` + max(0, ${optionalGp.toFixed(2)} - ${POLICY.optionalDeduction})) / ${POLICY.divisor}`,
    rawGpa,
    capApplied,
    overrideApplied,
    failedCompulsory: failedCompulsory.map((r) => ({
      subject: r.subject, ruleId: r.ruleId, ruleText: r.ruleText,
    })),
    finalGpa,
    letter,
    passed: !overrideApplied && finalGpa > 0,
    flags: {
      optionalList: optionalFlagged,
      practicalList: practicalFails.length > 0,
      absentList: absentSubjects.length > 0,
      absentSubjects,
      practicalFails,
    },
  };
}

/** Build the three checking lists from evaluated results. */
function buildChecklists(results) {
  const optionalList = results
    .filter((r) => r.flags.optionalList)
    .map((r) => ({
      code: r.code, name: r.name, classId: r.classId,
      subject: r.optionalSubject,
      optionalGp: r.optionalGp,
      note: r.flags.absentSubjects.includes(r.optionalSubject)
        ? 'Absent in the optional subject, contributes 0.00'
        : `Grade point ${r.optionalGp.toFixed(2)} is at or below `
          + `${POLICY.optionalDeduction.toFixed(2)}, contributes 0.00`,
    }));

  const practicalList = results
    .filter((r) => r.flags.practicalList)
    .map((r) => ({
      code: r.code, name: r.name, classId: r.classId,
      subjects: r.flags.practicalFails,
      note: `Practical below ${POLICY.practical.pass} in `
        + `${r.flags.practicalFails.join(', ')}`,
    }));

  const absentList = results
    .filter((r) => r.flags.absentList)
    .map((r) => ({
      code: r.code, name: r.name, classId: r.classId,
      subjects: r.flags.absentSubjects,
      note: `Marked AB in ${r.flags.absentSubjects.join(', ')}`,
    }));

  const codesOn = (list) => new Set(list.map((x) => x.code));
  const o = codesOn(optionalList); const p = codesOn(practicalList); const a = codesOn(absentList);
  const overlaps = results
    .filter((r) => [o.has(r.code), p.has(r.code), a.has(r.code)].filter(Boolean).length > 1)
    .map((r) => ({
      code: r.code,
      name: r.name,
      lists: [
        o.has(r.code) ? 'Optional' : null,
        p.has(r.code) ? 'Practical' : null,
        a.has(r.code) ? 'Absent' : null,
      ].filter(Boolean),
    }));

  return { optionalList, practicalList, absentList, overlaps };
}

module.exports = { evaluateSubject, evaluateStudent, buildChecklists, RULES };
