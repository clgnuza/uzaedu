import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

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
