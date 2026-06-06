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
      !e.is_locked &&
      e.day_of_week === entry.day_of_week &&
      e.lesson_num === entry.lesson_num + 1 &&
      sameAssignmentGroup(e, entry),
  );
  if (next) return next;
  return (
    entries.find(
      (e) =>
        e.id !== entry.id &&
        !e.is_locked &&
        e.day_of_week === entry.day_of_week &&
        e.lesson_num === entry.lesson_num - 1 &&
        sameAssignmentGroup(e, entry),
    ) ?? null
  );
}

/** Aynı günde ardışık tüm kartlar (2, 4, …). */
export function expandConsecutiveRun(entry: EditorEntry, entries: EditorEntry[]): EditorEntry[] {
  if (entry.is_locked) return [entry];

  const run: EditorEntry[] = [entry];
  let cur = entry;

  while (true) {
    const prev = entries.find(
      (e) =>
        !e.is_locked &&
        e.id !== cur.id &&
        sameAssignmentGroup(e, entry) &&
        e.day_of_week === entry.day_of_week &&
        e.lesson_num === cur.lesson_num - 1,
    );
    if (!prev) break;
    run.unshift(prev);
    cur = prev;
  }

  cur = entry;
  while (true) {
    const next = entries.find(
      (e) =>
        !e.is_locked &&
        e.id !== cur.id &&
        sameAssignmentGroup(e, entry) &&
        e.day_of_week === entry.day_of_week &&
        e.lesson_num === cur.lesson_num + 1,
    );
    if (!next) break;
    run.push(next);
    cur = next;
  }

  return run;
}

/** Aynı günde ardışık blok — sürüklemede birlikte taşınır. */
export function sameDayBlockRun(
  entry: EditorEntry,
  entries: EditorEntry[],
  assignmentHints?: EditorContext['assignment_hints'],
): EditorEntry[] {
  const run = expandConsecutiveRun(entry, entries);
  if (run.length >= 2) return run;

  const hint = resolvePlacementHint(entry, assignmentHints, entries);
  if ((hint?.block_size ?? 0) >= 2) {
    const partner = findConsecutivePartner(entry, entries);
    if (partner) return expandConsecutiveRun(entry, entries);
  }

  const partner = findConsecutivePartner(entry, entries);
  if (partner) return expandConsecutiveRun(entry, entries);

  return [entry];
}

export function blockRunIds(entry: EditorEntry, entries: EditorEntry[], hints?: EditorContext['assignment_hints']): string[] {
  const run = sameDayBlockRun(entry, entries, hints);
  return run.length > 1 ? run.map((e) => e.id) : [];
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
