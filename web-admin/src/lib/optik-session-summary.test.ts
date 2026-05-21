import assert from 'node:assert/strict';
import {
  countAnswerKeyFilled,
  filterMcTemplatesBySubject,
  isAnswerKeyReady,
} from './optik-session-summary';

assert.equal(countAnswerKeyFilled({ 1: 'A', 2: 'B' }, 10), 2);
assert.equal(isAnswerKeyReady({ 1: 'A' }, 20), false);
const key16 = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i + 1), 'A']));
assert.equal(isAnswerKeyReady(key16, 20), true);

const tpls = [
  { id: '1', name: 'Genel', slug: 'g', formType: 'multiple_choice', questionCount: 10, choiceCount: 4 },
  {
    id: '2',
    name: 'Mat',
    slug: 'm',
    formType: 'multiple_choice',
    questionCount: 10,
    choiceCount: 4,
    subjectHint: 'Matematik',
  },
];
assert.equal(filterMcTemplatesBySubject(tpls, 's1', 'Matematik').length, 2);
assert.equal(filterMcTemplatesBySubject(tpls, 's1', 'Fizik').length, 1);
console.log('optik-session-summary.test OK');
