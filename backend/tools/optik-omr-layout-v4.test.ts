import assert from 'node:assert/strict';
import { computeOmrScanLayout } from '../src/optik/optik-omr-layout';
import {
  OMR_LAYOUT_VERSION,
  computeAnswerBubbleSize,
  computeAnswerRowHeight,
} from '../src/optik/optik-omr-geometry';

const layout = computeOmrScanLayout({ questionCount: 25, choiceCount: 4 });

assert.equal(layout.version, OMR_LAYOUT_VERSION);
assert.equal(layout.bubbles.length, 25 * 4);

const r = layout.bubbles[0]!.r;
assert.ok(r > 0.006, `bubble r too small: ${r}`);
assert.ok(r < 0.02, `bubble r too large: ${r}`);

const rowH = computeAnswerRowHeight(400, 60, 13);
const bubble = computeAnswerBubbleSize(rowH);
assert.ok(bubble >= 4.2, `expected larger bubble, got ${bubble}`);

console.log('optik-omr-layout-v4.test OK', { version: layout.version, bubbleR: r, sampleBubblePt: bubble });
