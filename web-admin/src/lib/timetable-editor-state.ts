import { clashEntryIds } from '@/lib/timetable-clash';
import type { EditorContext, EditorEntry } from '@/lib/ders-dagit-timetable-api';

export function clashesForEntries(entries: EditorEntry[]): EditorContext['clashes'] {
  const ids = clashEntryIds(entries);
  return [...ids].map((entry_id) => ({
    entry_id,
    code: 'CLASH',
    severity: 'warning',
    message: 'Çakışma',
  }));
}

export function mergeEntryInContext(prev: EditorContext, updated: EditorEntry): EditorContext {
  const entries = prev.entries.map((e) => (e.id === updated.id ? { ...e, ...updated } : e));
  return { ...prev, entries, clashes: clashesForEntries(entries) };
}

export function removeEntriesFromContext(prev: EditorContext, removedIds: Set<string>): EditorContext {
  const removed = prev.entries.filter((e) => removedIds.has(e.id));
  let unplaced = prev.unplaced;
  for (const e of removed) {
    if (e.assignment_id) unplaced = adjustUnplaced(unplaced, e.assignment_id, -1);
  }
  const entries = prev.entries.filter((e) => !removedIds.has(e.id));
  return { ...prev, entries, unplaced, clashes: clashesForEntries(entries) };
}

export function addEntryToContext(prev: EditorContext, entry: EditorEntry): EditorContext {
  const entries = [...prev.entries, entry];
  const unplaced = entry.assignment_id
    ? adjustUnplaced(prev.unplaced, entry.assignment_id, 1)
    : prev.unplaced;
  return { ...prev, entries, unplaced, clashes: clashesForEntries(entries) };
}

export function swapEntriesInContext(prev: EditorContext, idA: string, idB: string): EditorContext {
  const a = prev.entries.find((e) => e.id === idA);
  const b = prev.entries.find((e) => e.id === idB);
  if (!a || !b) return prev;
  const entries = prev.entries.map((e) => {
    if (e.id === idA) return { ...e, day_of_week: b.day_of_week, lesson_num: b.lesson_num };
    if (e.id === idB) return { ...e, day_of_week: a.day_of_week, lesson_num: a.lesson_num };
    return e;
  });
  return { ...prev, entries, clashes: clashesForEntries(entries) };
}

function adjustUnplaced(
  unplaced: EditorContext['unplaced'],
  assignmentId: string,
  placedDelta: number,
): EditorContext['unplaced'] {
  const idx = unplaced.findIndex((u) => u.assignment_id === assignmentId);
  if (idx < 0) return unplaced;
  const row = unplaced[idx]!;
  const placed_hours = row.placed_hours + placedDelta;
  const remaining_hours = row.remaining_hours - placedDelta;
  if (remaining_hours <= 0) return unplaced.filter((_, i) => i !== idx);
  const next = [...unplaced];
  next[idx] = { ...row, placed_hours, remaining_hours };
  return next;
}
