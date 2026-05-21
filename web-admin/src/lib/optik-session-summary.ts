import type { ExamSession } from '@/lib/optik-sessions-api';
import type { OptikFormTemplate } from '@/lib/optik-form-templates';

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

export type SessionBadgeKind = 'closed' | 'key_missing' | 'await_scan' | 'in_progress' | 'done';

export function sessionBadgeKind(s: ExamSession): SessionBadgeKind {
  if (s.status === 'closed') return 'closed';
  const ready = s.keyReady ?? isAnswerKeyReady(s.answerKey ?? {}, s.questionCount);
  const mc = s.mcScanCount ?? 0;
  if (!ready) return 'key_missing';
  if (mc === 0) return 'await_scan';
  return 'in_progress';
}

const BADGE_LABELS: Record<SessionBadgeKind, string> = {
  closed: 'Kapalı',
  key_missing: 'Anahtar eksik',
  await_scan: 'Tara',
  in_progress: 'Tarama var',
  done: 'Tamam',
};

export function sessionBadgeLabel(kind: SessionBadgeKind): string {
  return BADGE_LABELS[kind];
}

export function sessionBadgeClass(kind: SessionBadgeKind): string {
  switch (kind) {
    case 'closed':
      return 'bg-muted text-muted-foreground';
    case 'key_missing':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-200';
    case 'await_scan':
      return 'bg-violet-500/15 text-violet-900 dark:text-violet-200';
    case 'in_progress':
      return 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200';
    case 'done':
      return 'bg-sky-500/15 text-sky-900 dark:text-sky-200';
  }
}

function normSubject(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

/** Ders seçilince: subjectHint eşleşen + genel (hint boş) şablonlar */
export function filterMcTemplatesBySubject(
  templates: OptikFormTemplate[],
  subjectId: string,
  subjectName: string | null,
): OptikFormTemplate[] {
  if (!subjectId) return templates;
  const name = normSubject(subjectName ?? '');
  if (!name) return templates;
  return templates.filter((t) => {
    const hint = t.subjectHint?.trim();
    if (!hint) return true;
    const h = normSubject(hint);
    return name.includes(h) || h.includes(name);
  });
}
