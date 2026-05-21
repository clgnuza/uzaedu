import assert from 'node:assert/strict';
import type { OmrScanLayout } from './optik-api';
import { decodeOmrFromGray, pickAnswerFromMarks } from './optik-omr-decode';

function miniLayout(questionCount: number, choiceCount: number): OmrScanLayout {
  const bubbles: OmrScanLayout['bubbles'] = [];
  const cols = 2;
  const rows = Math.ceil(questionCount / cols);
  for (let q = 1; q <= questionCount; q++) {
    const col = Math.floor((q - 1) / rows);
    const row = (q - 1) % rows;
    for (let c = 0; c < choiceCount; c++) {
      bubbles.push({
        question: q,
        choice: c,
        label: ['A', 'B', 'C', 'D', 'E', 'F'][c]!,
        x: 0.2 + col * 0.35 + c * 0.04,
        y: 0.25 + row * 0.04,
        r: 0.008,
      });
    }
  }
  const ys = bubbles.map((b) => b.y);
  return {
    version: 'test',
    page_width: 595,
    page_height: 842,
    anchors: [],
    bubbles,
    question_count: questionCount,
    blocks: [{ label: 'CEVAPLAR', questionCount, choiceCount }],
    answers_region: { y_min: Math.min(...ys) - 0.02, y_max: 1 },
  };
}

function synthMarkedSheet(
  layout: OmrScanLayout,
  marks: Record<number, string>,
  w = 1100,
  h = Math.round(1100 * (841.89 / 595.28)),
): Uint8Array {
  const gray = new Uint8Array(w * h);
  gray.fill(248);
  for (const b of layout.bubbles) {
    const cx = Math.round(b.x * w);
    const cy = Math.round(b.y * h);
    const r = Math.max(5, Math.round(b.r * w * 1.1));
    const qMark = marks[b.question];
    const filled = qMark === b.label;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        gray[y * w + x] = filled ? 35 : 245;
      }
    }
  }
  return gray;
}

// Boş satır → cevap yok
{
  const row = pickAnswerFromMarks(
    [
      { choice: 0, label: 'A', mark: 0.05 },
      { choice: 1, label: 'B', mark: 0.04 },
      { choice: 2, label: 'C', mark: 0.06 },
    ],
    'student',
  );
  assert.equal(row.ambiguous, true);
  assert.equal(row.label, '');
}

// Tek dolu şık
{
  const row = pickAnswerFromMarks(
    [
      { choice: 0, label: 'A', mark: 0.08 },
      { choice: 1, label: 'B', mark: 0.72 },
      { choice: 2, label: 'C', mark: 0.1 },
    ],
    'student',
  );
  assert.equal(row.ambiguous, false);
  assert.equal(row.label, 'B');
}

// Sentetik 5 soru
{
  const layout = miniLayout(5, 4);
  const marks: Record<number, string> = { 1: 'A', 2: 'C', 3: 'B', 4: 'D', 5: 'A' };
  const w = 1100;
  const h = Math.round(w * (841.89 / 595.28));
  const gray = synthMarkedSheet(layout, marks, w, h);
  const decoded = decodeOmrFromGray(gray, w, h, layout, { maxQuestion: 5, mode: 'student' });
  assert.equal(decoded.answers[1], 'A');
  assert.equal(decoded.answers[2], 'C');
  assert.equal(decoded.answers[3], 'B');
  assert.equal(decoded.answers[4], 'D');
  assert.equal(decoded.answers[5], 'A');
  assert.equal(Object.keys(decoded.answers).length, 5);
}

// Gürültülü boş sayfa → çoğu boş
{
  const layout = miniLayout(10, 4);
  const w = 1100;
  const h = Math.round(w * (841.89 / 595.28));
  const gray = new Uint8Array(w * h);
  gray.fill(240);
  for (let i = 0; i < 400; i++) gray[(i * 17) % gray.length] = 200;
  const decoded = decodeOmrFromGray(gray, w, h, layout, { maxQuestion: 10, mode: 'student' });
  assert.ok(Object.keys(decoded.answers).length <= 2, `expected few marks, got ${Object.keys(decoded.answers).length}`);
}

console.log('optik-omr-decode.test.ts OK');
