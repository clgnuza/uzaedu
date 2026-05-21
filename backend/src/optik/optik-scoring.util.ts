export type McScoreDetail = {
  question: number;
  student: string;
  key: string;
  status: 'correct' | 'wrong' | 'blank';
};

export type McScoreResult = {
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  details: McScoreDetail[];
};

export function normalizeKeyRecord(
  raw: Record<string, string> | Array<{ question: number; label: string }>,
  questionCount: number,
): Record<number, string> {
  const out: Record<number, string> = {};
  if (Array.isArray(raw)) {
    for (const a of raw) {
      const q = Number(a.question);
      if (q >= 1 && q <= questionCount) {
        out[q] = String(a.label ?? '').trim().toUpperCase();
      }
    }
    return out;
  }
  for (let q = 1; q <= questionCount; q++) {
    const v = raw[String(q)] ?? raw[q as unknown as string];
    if (v) out[q] = String(v).trim().toUpperCase();
  }
  return out;
}

export function studentAnswersToRecord(
  answers: Array<{ question: number; label: string }>,
  questionCount: number,
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const a of answers) {
    const q = Number(a.question);
    if (q >= 1 && q <= questionCount) {
      const lbl = String(a.label ?? '').trim().toUpperCase();
      if (lbl) out[q] = lbl;
    }
  }
  return out;
}

export function scoreMcAnswers(
  student: Record<number, string>,
  key: Record<number, string>,
  questionCount: number,
  scoringMode: 'standard' | 'penalty_4_1' = 'standard',
): McScoreResult {
  const details: McScoreDetail[] = [];
  let correct = 0;
  let wrong = 0;
  let blank = 0;

  for (let q = 1; q <= questionCount; q++) {
    const k = (key[q] ?? '').toUpperCase();
    const s = (student[q] ?? '').toUpperCase();
    if (!k) continue;
    if (!s) {
      blank += 1;
      details.push({ question: q, student: '', key: k, status: 'blank' });
    } else if (s === k) {
      correct += 1;
      details.push({ question: q, student: s, key: k, status: 'correct' });
    } else {
      wrong += 1;
      details.push({ question: q, student: s, key: k, status: 'wrong' });
    }
  }

  let net = correct;
  if (scoringMode === 'penalty_4_1' && wrong > 0) {
    net = Math.max(0, correct - wrong / 4);
  }

  return {
    correct,
    wrong,
    blank,
    net: Math.round(net * 100) / 100,
    details,
  };
}

export function itemAnalysisFromScans(
  scans: Array<{ answers: Array<{ question: number; label: string }> }>,
  key: Record<number, string>,
  questionCount: number,
): Array<{
  question: number;
  key: string;
  correct_pct: number;
  wrong_pct: number;
  blank_pct: number;
  top_wrong_choice: string | null;
}> {
  const n = scans.length || 1;
  const result: Array<{
    question: number;
    key: string;
    correct_pct: number;
    wrong_pct: number;
    blank_pct: number;
    top_wrong_choice: string | null;
  }> = [];

  for (let q = 1; q <= questionCount; q++) {
    const k = (key[q] ?? '').toUpperCase();
    if (!k) continue;
    let c = 0;
    let w = 0;
    let b = 0;
    const wrongChoices = new Map<string, number>();
    for (const scan of scans) {
      const rec = studentAnswersToRecord(scan.answers ?? [], questionCount);
      const s = rec[q] ?? '';
      if (!s) b += 1;
      else if (s === k) c += 1;
      else {
        w += 1;
        wrongChoices.set(s, (wrongChoices.get(s) ?? 0) + 1);
      }
    }
    let topWrong: string | null = null;
    let topN = 0;
    for (const [lbl, cnt] of wrongChoices) {
      if (cnt > topN) {
        topN = cnt;
        topWrong = lbl;
      }
    }
    result.push({
      question: q,
      key: k,
      correct_pct: Math.round((c / n) * 1000) / 10,
      wrong_pct: Math.round((w / n) * 1000) / 10,
      blank_pct: Math.round((b / n) * 1000) / 10,
      top_wrong_choice: topWrong,
    });
  }
  return result;
}
