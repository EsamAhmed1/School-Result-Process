/**
 * Central grading policy for P08.
 *
 * Every rule the engine applies is configured here and nowhere else.
 * No other file in this project may contain a grade-point band, a pass
 * mark, a letter-grade boundary or the GPA formula constants.
 */

const POLICY = {
  theory: { maxWithPractical: 75, maxTheoryOnly: 100, pass: 25, passTheoryOnly: 33 },
  practical: { max: 25, pass: 8 },

  // Applied to (theory + practical) out of 100. Descending; first match wins.
  bands: [
    { min: 80, gp: 5.0 },
    { min: 70, gp: 4.0 },
    { min: 60, gp: 3.5 },
    { min: 50, gp: 3.0 },
    { min: 40, gp: 2.0 },
    { min: 33, gp: 1.0 },
    { min: 0, gp: 0.0 },
  ],

  // Applied to the FINAL gpa after rounding. Descending; first match wins.
  letters: [
    { min: 5.0, letter: 'A+' },
    { min: 4.0, letter: 'A' },
    { min: 3.5, letter: 'A-' },
    { min: 3.0, letter: 'B' },
    { min: 2.0, letter: 'C' },
    { min: 1.0, letter: 'D' },
    { min: 0.0, letter: 'F' },
  ],

  optionalDeduction: 2.0,
  divisor: 6,
  gpaCap: 5.0,
  decimals: 2,
};

const RULES = {
  'R-10': 'Grade point taken from the mark band.',
  'R-11': 'Failing either theory or practical fails the whole subject.',
  'R-12': 'Absent. Compulsory absence fails the student overall.',
  'R-13': 'GPA formula, optional-subject contribution and compulsory-failure override.',
};

/** Highest band whose minimum the total reaches. */
function gradePointForTotal(total) {
  for (const band of POLICY.bands) if (total >= band.min) return band.gp;
  return 0.0;
}

/** Letter for a final GPA. */
function letterForGpa(gpa) {
  for (const row of POLICY.letters) if (gpa >= row.min) return row.letter;
  return 'F';
}

/** Round half-up to the configured precision. Avoids float artefacts. */
function roundGpa(value) {
  const f = Math.pow(10, POLICY.decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Theory maximum and pass mark depend on whether the subject has a practical part. */
function theoryLimits(hasPractical) {
  return hasPractical
    ? { max: POLICY.theory.maxWithPractical, pass: POLICY.theory.pass }
    : { max: POLICY.theory.maxTheoryOnly, pass: POLICY.theory.passTheoryOnly };
}

module.exports = { POLICY, RULES, gradePointForTotal, letterForGpa, roundGpa, theoryLimits };
