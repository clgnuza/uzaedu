/** Çoktan seçmeli cevap anahtarı metin / OMR sonucundan { "1": "A", ... } */

const CHOICE_SET = new Set(['A', 'B', 'C', 'D', 'E', 'F']);

export function normalizeChoiceLabel(raw: string): string | null {
  const u = raw.trim().toUpperCase().replace(/[^A-F]/g, '');
  if (u.length === 1 && CHOICE_SET.has(u)) return u;
  return null;
}

/** Satır formatları: "1 A", "1-A", "1: A", "1\tA", "Soru 1: B" */
export function parseAnswerKeyText(text: string, questionCount: number): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const m =
      line.match(/^(?:soru\s*)?(\d{1,3})\s*[-.:)\]]\s*([A-Fa-f])\b/i) ||
      line.match(/^(\d{1,3})\s+([A-Fa-f])\b/);
    if (m) {
      const q = Number(m[1]);
      const lbl = normalizeChoiceLabel(m[2]);
      if (q >= 1 && q <= questionCount && lbl) out[String(q)] = lbl;
      continue;
    }
    const parts = line.split(/[\s,;|]+/).filter(Boolean);
    if (parts.length >= 2) {
      const q = Number(parts[0]);
      const lbl = normalizeChoiceLabel(parts[1]);
      if (q >= 1 && q <= questionCount && lbl) out[String(q)] = lbl;
    }
  }

  if (Object.keys(out).length === 0 && lines.length === 1) {
    const compact = lines[0].replace(/[^A-Fa-f]/gi, '').toUpperCase();
    if (compact.length >= 1) {
      for (let i = 0; i < Math.min(compact.length, questionCount); i++) {
        const c = compact[i];
        if (CHOICE_SET.has(c)) out[String(i + 1)] = c;
      }
    }
  }

  return out;
}

export function omrRecordToAnswerKey(
  answers: Record<number, string>,
  questionCount: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (let q = 1; q <= questionCount; q++) {
    const lbl = answers[q];
    if (lbl) {
      const n = normalizeChoiceLabel(lbl);
      if (n) out[String(q)] = n;
    }
  }
  return out;
}

export function mergeAnswerKeys(
  base: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  return { ...base, ...patch };
}

export function answerKeyFilledCount(key: Record<string, string>, questionCount: number): number {
  let n = 0;
  for (let q = 1; q <= questionCount; q++) {
    if (key[String(q)]) n++;
  }
  return n;
}

export function formatAnswerKeyForPaste(key: Record<string, string>, questionCount: number): string {
  const lines: string[] = [];
  for (let q = 1; q <= questionCount; q++) {
    const lbl = key[String(q)];
    if (lbl) lines.push(`${q}\t${lbl}`);
  }
  return lines.join('\n');
}
