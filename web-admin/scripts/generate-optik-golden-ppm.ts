/**
 * Sentetik altın görüntüleri PPM olarak yazar.
 * Kullanım: npx tsx scripts/generate-optik-golden-ppm.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeOmrScanLayout } from '../../backend/src/optik/optik-omr-layout';
import { OPTIK_OMR_GOLDEN_CASES } from '../src/lib/optik-omr-golden-cases';
import { synthOmrV4AlignedGray } from '../src/lib/optik-omr-golden-synth';

const outDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../test-fixtures/optik-omr-golden');
mkdirSync(outDir, { recursive: true });

function grayToPpm(gray: Uint8Array, w: number, h: number): Buffer {
  const header = Buffer.from(`P6\n${w} ${h}\n255\n`, 'ascii');
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0, o = 0; i < gray.length; i++, o += 3) {
    const v = gray[i]!;
    rgb[o] = v;
    rgb[o + 1] = v;
    rgb[o + 2] = v;
  }
  return Buffer.concat([header, rgb]);
}

for (const c of OPTIK_OMR_GOLDEN_CASES) {
  const layout = computeOmrScanLayout(c.template);
  const { gray, w, h } = synthOmrV4AlignedGray(layout, c.marks, {
    noise: c.noise,
    doubleMarks: c.doubleMarks,
  });
  const path = join(outDir, `synth-${c.id}.ppm`);
  writeFileSync(path, grayToPpm(gray, w, h));
  console.log('wrote', path);
}

console.log('done', outDir);
