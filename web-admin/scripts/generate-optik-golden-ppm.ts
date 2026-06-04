/**
 * Sentetik altin PPM: test-fixtures/optik-omr-golden/<id>.ppm
 * npx tsx scripts/generate-optik-golden-ppm.ts [caseId]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeOmrScanLayout } from '../../backend/src/optik/optik-omr-layout';
import { OPTIK_OMR_GOLDEN_CASES, type GoldenCase } from '../src/lib/optik-omr-golden-cases';
import { synthOmrV4AlignedGray } from '../src/lib/optik-omr-golden-synth';

const here = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = join(here, '../test-fixtures/optik-omr-golden');

function grayToPpm(gray: Uint8Array, w: number, h: number): Buffer {
  const header = Buffer.from(`P6\n${w} ${h}\n255\n`, 'ascii');
  const rgb = Buffer.alloc(w * h * 3);
  for (let p = 0; p < gray.length; p++) {
    const v = gray[p]!;
    rgb[p * 3] = v;
    rgb[p * 3 + 1] = v;
    rgb[p * 3 + 2] = v;
  }
  return Buffer.concat([header, rgb]);
}

function runCase(c: GoldenCase) {
  const layout = computeOmrScanLayout(c.template);
  const { gray, w, h } = synthOmrV4AlignedGray(layout, c.marks, {
    noise: c.noise,
    doubleMarks: c.doubleMarks,
  });
  const outPath = join(FIXTURES, `${c.id}.ppm`);
  writeFileSync(outPath, grayToPpm(gray, w, h));
  console.log('wrote', outPath, `${w}x${h}`);
}

const id = process.argv[2] ?? 'file-25x4-abcd';
const builtin = OPTIK_OMR_GOLDEN_CASES.find((c) => c.id === id);
if (builtin) {
  runCase(builtin);
} else {
  runCase({
    id,
    template: { questionCount: 25, choiceCount: 4 },
    marks: Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [i + 1, ['A', 'B', 'C', 'D'][i % 4]!]),
    ),
    expected: Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [i + 1, ['A', 'B', 'C', 'D'][i % 4]!]),
    ),
  });
}
