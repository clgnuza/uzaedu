/** Altın set — sentetik omr-v4 senaryoları (backend layout ile aynı şablon parametreleri) */

export type GoldenCase = {
  id: string;
  template: {
    questionCount?: number;
    choiceCount?: number;
    gradeLevel?: string | null;
    slug?: string;
  };
  marks: Record<number, string>;
  doubleMarks?: Record<number, string>;
  noise?: number;
  /** Beklenen cevaplar; belirsiz sorular burada olmamalı */
  expected: Record<number, string>;
  maxQuestion?: number;
  /** En fazla kaç yanlış pozitif kabul edilir */
  maxFalsePositives?: number;
  /** H1–H5: digit_index → 0-9 */
  idDigitMarks?: Record<number, number>;
  expectedStudentCode?: string;
};

export const OPTIK_OMR_GOLDEN_CASES: GoldenCase[] = [
  {
    id: 'std-20x5-cycle',
    template: { questionCount: 20, choiceCount: 5 },
    marks: Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [i + 1, ['A', 'B', 'C', 'D', 'E'][i % 5]!]),
    ),
    expected: Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [i + 1, ['A', 'B', 'C', 'D', 'E'][i % 5]!]),
    ),
  },
  {
    id: 'std-25x4-abcd',
    template: { questionCount: 25, choiceCount: 4 },
    marks: Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [i + 1, ['A', 'B', 'C', 'D'][i % 4]!]),
    ),
    expected: Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [i + 1, ['A', 'B', 'C', 'D'][i % 4]!]),
    ),
  },
  {
    id: 'sparse-40x4',
    template: { questionCount: 40, choiceCount: 4 },
    marks: { 1: 'A', 5: 'B', 10: 'C', 20: 'D', 30: 'A', 40: 'B' },
    expected: { 1: 'A', 5: 'B', 10: 'C', 20: 'D', 30: 'A', 40: 'B' },
    maxQuestion: 40,
  },
  {
    id: 'lgs-turkce-20',
    template: { gradeLevel: 'LGS', slug: 'lgs-deneme' },
    marks: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'C'])),
    expected: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'C'])),
    maxQuestion: 20,
  },
  {
    id: 'blank-25x4',
    template: { questionCount: 25, choiceCount: 4 },
    marks: {},
    expected: {},
    maxFalsePositives: 1,
  },
  {
    id: 'double-q7-ambiguous',
    template: { questionCount: 15, choiceCount: 4 },
    marks: Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [i + 1, i + 1 === 7 ? 'B' : ['A', 'B', 'C', 'D'][i % 4]!]),
    ),
    doubleMarks: { 7: 'C' },
    expected: Object.fromEntries(
      Array.from({ length: 15 }, (_, i) =>
        i + 1 === 7 ? [] : [[i + 1, ['A', 'B', 'C', 'D'][i % 4]!]],
      ).flat() as [number, string][],
    ),
  },
  {
    id: 'noisy-blank-10x4',
    template: { questionCount: 10, choiceCount: 4 },
    marks: {},
    expected: {},
    noise: 0.35,
    maxFalsePositives: 2,
  },
  {
    id: 'edge-10x6-ef',
    template: { questionCount: 10, choiceCount: 6 },
    marks: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, i % 2 === 0 ? 'E' : 'F'])),
    expected: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, i % 2 === 0 ? 'E' : 'F'])),
  },
  {
    id: 'yks-tyt-first-20',
    template: { gradeLevel: 'YKS', slug: 'yks-tyt-120' },
    marks: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'D'])),
    expected: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'D'])),
    maxQuestion: 20,
  },
  {
    id: 'id-digit-12345',
    template: { questionCount: 10, choiceCount: 4 },
    marks: { 1: 'A', 2: 'B' },
    idDigitMarks: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 },
    expected: { 1: 'A', 2: 'B' },
    expectedStudentCode: '12345',
    maxQuestion: 10,
  },
  {
    id: 'heavy-60x5-partial',
    template: { questionCount: 60, choiceCount: 5 },
    marks: Object.fromEntries(
      [1, 2, 3, 10, 11, 30, 31, 59, 60].map((q, i) => [q, ['A', 'B', 'C', 'D', 'E'][i % 5]!]),
    ),
    expected: Object.fromEntries(
      [1, 2, 3, 10, 11, 30, 31, 59, 60].map((q, i) => [q, ['A', 'B', 'C', 'D', 'E'][i % 5]!]),
    ),
    maxQuestion: 60,
  },
];
