const assert = require('assert');
const {
  countAnswerKeyFilled,
  isAnswerKeyReady,
} = require('../dist/optik/optik-session-summary.util');

assert.strictEqual(countAnswerKeyFilled({ '1': 'A', '2': 'B' }, 20), 2);
assert.strictEqual(isAnswerKeyReady({ '1': 'A' }, 20), false);
const key20 = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i + 1), 'A']));
assert.strictEqual(isAnswerKeyReady(key20, 20), true);
console.log('optik-session-summary.test OK');
