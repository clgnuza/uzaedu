import assert from 'node:assert/strict';
import { resolveOmrDecodeParams, DEFAULT_OMR_DECODE_PARAMS } from './omr-decode-params';

assert.equal(resolveOmrDecodeParams({}).blank_min, DEFAULT_OMR_DECODE_PARAMS.blank_min);
assert.ok(resolveOmrDecodeParams({ examType: 'lgs' }).margin_min < DEFAULT_OMR_DECODE_PARAMS.margin_min);
assert.ok(resolveOmrDecodeParams({ slug: 'tyt-optik' }).blank_min <= DEFAULT_OMR_DECODE_PARAMS.blank_min);
console.log('omr-decode-params.test.ts OK');
