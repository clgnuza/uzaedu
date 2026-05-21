import assert from 'node:assert/strict';
import {
  manualScoresFromOpenGrades,
  pickActiveStudentId,
  reportStudentIdsForClass,
} from './optik-session-report-load';

assert.deepEqual(reportStudentIdsForClass(null, [{ id: 'a' }]), undefined);
assert.deepEqual(reportStudentIdsForClass('c1', [{ id: 'a' }, { id: 'b' }]), ['a', 'b']);

assert.equal(pickActiveStudentId([{ id: 'a' }, { id: 'b' }], 'b'), 'b');
assert.equal(pickActiveStudentId([{ id: 'a' }], 'x'), 'a');

const manual = manualScoresFromOpenGrades(
  { q1: { score: 0, max: 10 } },
  [{ question_id: 'q1', score: 7, max_score: 10 }],
);
assert.equal(manual.q1?.score, 7);

console.log('optik-session-report-load.test: ok');
