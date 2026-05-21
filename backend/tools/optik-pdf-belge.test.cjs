const assert = require('node:assert/strict');
const {
  inferAcademicYearFromDate,
  resolveOptikPdfBranding,
} = require('../dist/optik/optik-pdf-belge.util');

assert.equal(inferAcademicYearFromDate(new Date('2025-10-01')), '2025-2026');
assert.equal(inferAcademicYearFromDate(new Date('2026-03-15')), '2025-2026');

const b = resolveOptikPdfBranding(
  { name: 'Test Okulu', principalName: 'Müdür' },
  [{ evrakDefaults: { ogretim_yili: '2024-2025' } }],
);
assert.match(b.academicYear, /2024-2025/);
assert.match(b.academicYear, /EĞİTİM/i);
assert.equal(b.schoolName, 'Test Okulu');

console.log('optik-pdf-belge.test: ok');
