import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import type { EditorContext } from '@/lib/ders-dagit-timetable-api';
import { resolvePlacementHint } from '@/lib/timetable-assignment-blocks';

export function sameAssignmentGroup(a: EditorEntry, b: EditorEntry): boolean {
  if (a.assignment_id && b.assignment_id) return a.assignment_id === b.assignment_id;
  return (
    a.class_section === b.class_section &&
    a.subject === b.subject &&
    (a.user_id ?? '') === (b.user_id ?? '') &&
    (a.teacher_label ?? '') === (b.teacher_label ?? '')
  );
}

/** Ardışık ders sırasındaki eş kart (çiftli blok). */
export function findConsecutivePartner(entry: EditorEntry, entries: EditorEntry[]): EditorEntry | null {
  const next = entries.find(
    (e) =>
      e.id !== entry.id &&
      e.day_of_week === entry.day_of_week &&
      e.lesson_num === entry.lesson_num + 1 &&
      sameAssignmentGroup(e, entry),
  );
  if (next) return next;
  return (
    entries.find(
      (e) =>
        e.id !== entry.id &&
        e.day_of_week === entry.day_of_week &&
        e.lesson_num === entry.lesson_num - 1 &&
        sameAssignmentGroup(e, entry),
    ) ?? null
  );
}

/** Aynı günde ardışık blok — sürüklemede birlikte taşınır. */
export function sameDayBlockRun(
  entry: EditorEntry,
  entries: EditorEntry[],
  assignmentHints?: EditorContext['assignment_hints'],
): EditorEntry[] {
  const hint = resolvePlacementHint(entry, assignmentHints, entries);
  const needsBlock = (hint?.block_size ?? 0) >= 2;

  const sameDay = entries
    .filter(
      (e) =>
        !e.is_locked &&
        sameAssignmentGroup(e, entry) &&
        e.day_of_week === entry.day_of_week,
    )
    .sort((a, b) => a.lesson_num - b.lesson_num);

  if (sameDay.length <= 1) {
    const partner = findConsecutivePartner(entry, entries);
    if (partner && !partner.is_locked) return [entry, partner].sort((a, b) => a.lesson_num - b.lesson_num);
    return [entry];
  }

  const idx = sameDay.findIndex((e) => e.id === entry.id);
  if (idx < 0) return [entry];

  let start = idx;
  let end = idx;
  while (start > 0 && sameDay[start - 1]!.lesson_num === sameDay[start]!.lesson_num - 1) start--;
  while (end < sameDay.length - 1 && sameDay[end + 1]!.lesson_num === sameDay[end]!.lesson_num + 1) end++;

  const run = sameDay.slice(start, end + 1);
  if (run.length >= 2) return run;
  if (needsBlock) {
    const partner = findConsecutivePartner(entry, entries);
    if (partner && !partner.is_locked) return [entry, partner].sort((a, b) => a.lesson_num - b.lesson_num);
  }
  return [entry];
}

/** Çiftlinin ilk (üst) kartı. */
export function doubleBlockLead(entry: EditorEntry, entries: EditorEntry[]): EditorEntry | null {
  const partner = findConsecutivePartner(entry, entries);
  if (!partner) return null;
  return entry.lesson_num < partner.lesson_num ? entry : partner;
}

export function isDoubleBlockContinuation(entry: EditorEntry, entries: EditorEntry[]): boolean {
  const lead = doubleBlockLead(entry, entries);
  return lead != null && lead.id !== entry.id;
}
