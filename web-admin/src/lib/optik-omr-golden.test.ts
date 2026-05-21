import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeOmrScanLayout } from '../../../backend/src/optik/optik-omr-layout';
import { OMR_LAYOUT_VERSION } from '../../../backend/src/optik/optik-omr-geometry';
import { decodeOmrFromGray } from './optik-omr-decode';
import { OPTIK_OMR_GOLDEN_CASES, type GoldenCase } from './optik-omr-golden-cases';
import { synthOmrV4AlignedGray } from './optik-omr-golden-synth';

const here = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = resolve(here, '../../test-fixtures/optik-omr-golden');

function runCase(c: GoldenCase) {
  const layout = computeOmrScanLayout(c.template);
  assert.equal(layout.version, OMR_LAYOUT_VERSION, `${c.id}: layout version`);

  const { gray, w, h } = synthOmrV4AlignedGray(layout, c.marks, {
    noise: c.noise,
    doubleMarks: c.doubleMarks,
  });
  const decoded = decodeOmrFromGray(gray, w, h, layout, {
    maxQuestion: c.maxQuestion ?? layout.question_count,
    mode: 'student',
  });

  for (const [qStr, label] of Object.entries(c.expected)) {
    const q = Number(qStr);
    assert.equal(
      decoded.answers[q],
      label,
      `${c.id}: Q${q} expected ${label}, got ${decoded.answers[q] ?? '(yok)'}`,
    );
  }

  for (const q of Object.keys(decoded.answers).map(Number)) {
    if (c.expected[q] != null) continue;
    assert.fail(`${c.id}: false positive Q${q}=${decoded.answers[q]}`);
  }

  const maxFp = c.maxFalsePositives ?? 0;
  if (maxFp === 0) {
    assert.equal(Object.keys(decoded.answers).length, Object.keys(c.expected).length, `${c.id}: count`);
  } else {
    assert.ok(
      Object.keys(decoded.answers).length <= Object.keys(c.expected).length + maxFp,
      `${c.id}: too many marks ${JSON.stringify(decoded.answers)}`,
    );
  }
}

for (const c of OPTIK_OMR_GOLDEN_CASES) {
  runCase(c);
}

type FileGolden = {
  id: string;
  template: GoldenCase['template'];
  expected: Record<number, string>;
  maxQuestion?: number;
  maxFalsePositives?: number;
};

function loadFileGoldens(): FileGolden[] {
  const manifestPath = join(FIXTURES_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { cases?: FileGolden[] };
  return Array.isArray(manifest.cases) ? manifest.cases : [];
}

/** Gerçek foto: manifest + .ppm (scripts/generate-optik-golden-ppm.ts ile üretilebilir) */
function readPpmGray(path: string): { gray: Uint8Array; w: number; h: number } | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path);
  const headEnd = raw.indexOf('\n255\n');
  if (headEnd < 0) return null;
  const header = raw.subarray(0, headEnd).toString('ascii');
  const m = header.match(/P6\s+(\d+)\s+(\d+)/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  const pix = raw.subarray(headEnd + 5);
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < gray.length; i += 3, p++) {
    gray[p] = Math.round(0.299 * pix[i]! + 0.587 * pix[i + 1]! + 0.114 * pix[i + 2]!);
  }
  return { gray, w, h };
}

for (const fc of loadFileGoldens()) {
  const ppmPath = join(FIXTURES_DIR, `${fc.id}.ppm`);
  const loaded = readPpmGray(ppmPath);
  assert.ok(loaded, `file golden ${fc.id}: missing ${ppmPath}`);
  const layout = computeOmrScanLayout(fc.template);
  const decoded = decodeOmrFromGray(loaded.gray, loaded.w, loaded.h, layout, {
    maxQuestion: fc.maxQuestion ?? layout.question_count,
    mode: 'student',
  });
  for (const [qStr, label] of Object.entries(fc.expected)) {
    assert.equal(decoded.answers[Number(qStr)], label, `file ${fc.id} Q${qStr}`);
  }
  const maxFp = fc.maxFalsePositives ?? 0;
  const extra = Object.keys(decoded.answers).length - Object.keys(fc.expected).length;
  assert.ok(extra <= maxFp, `file ${fc.id}: extra marks`);
}

const ppmCount = existsSync(FIXTURES_DIR)
  ? readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.ppm')).length
  : 0;

console.log(
  'optik-omr-golden.test.ts OK',
  { synthetic: OPTIK_OMR_GOLDEN_CASES.length, filePpm: ppmCount, fileManifest: loadFileGoldens().length },
);
