/** Oturum listesi rozetleri ve anahtar yeterliliği */

export function countAnswerKeyFilled(key: Record<string, string>, questionCount: number): number {
  let n = 0;
  for (let q = 1; q <= questionCount; q++) {
    if (key[String(q)]?.trim()) n++;
  }
  return n;
}

export function isAnswerKeyReady(key: Record<string, string>, questionCount: number): boolean {
  const filled = countAnswerKeyFilled(key, questionCount);
  const min = Math.min(5, questionCount);
  return filled >= min || filled >= Math.ceil(questionCount * 0.8);
}

export type SessionListSummary = {
  mc_scan_count: number;
  scan_count: number;
  key_filled_count: number;
  key_ready: boolean;
};
