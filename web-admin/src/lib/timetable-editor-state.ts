import { listClashes } from '@/lib/timetable-clash';
import type { EditorContext, EditorEntry } from '@/lib/ders-dagit-timetable-api';

export function clashesForEntries(
  entries: EditorEntry[],
  ctx?: Pick<EditorContext, 'group_modes'>,
): EditorContext['clashes'] {
  return listClashes(entries, ctx?.group_modes ? { group_modes: ctx.group_modes } : undefined);
}

export function mergeEntryInContext(prev: EditorContext, updated: EditorEntry): EditorContext {
  const entries = prev.entries.map((e) => (e.id === updated.id ? { ...e, ...updated } : e));
  return { ...prev, entries, clashes: clashesForEntries(entries, prev) };
}

export function removeEntriesFromContext(prev: EditorContext, removedIds: Set<string>): EditorContext {
  const removed = prev.entries.filter((e) => removedIds.has(e.id));
  let unplaced = prev.unplaced;
  for (const e of removed) {
    if (e.assignment_id) {
      unplaced = adjustUnplaced(unplaced, e.assignment_id, e.class_section, -1);
    }
  }
  const entries = prev.entries.filter((e) => !removedIds.has(e.id));
  return { ...prev, entries, unplaced, clashes: clashesForEntries(entries, prev) };
}

export function addEntryToContext(
  prev: EditorContext,
  entry: EditorEntry,
  opts?: { removePoolId?: string },
): EditorContext {
  const entries = [...prev.entries, entry];
  let unplaced = prev.unplaced;
  if (opts?.removePoolId) {
    unplaced = unplaced.filter((u) => u.pool_id !== opts.removePoolId);
  }
  return { ...prev, entries, unplaced, clashes: clashesForEntries(entries, prev) };
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
  return { ...prev, entries, clashes: clashesForEntries(entries, prev) };
}

function adjustUnplaced(
  unplaced: EditorContext['unplaced'],
  assignmentId: string,
  classSection: string,
  placedDelta: number,
): EditorContext['unplaced'] {
  const idx = unplaced.findIndex(
    (u) => u.assignment_id === assignmentId && u.class_section === classSection,
  );
  if (idx < 0) return unplaced;
  const row = unplaced[idx]!;
  const placed_hours = (row.placed_hours ?? 0) + placedDelta;
  const remaining_hours = row.remaining_hours - placedDelta;
  if (remaining_hours <= 0) return unplaced.filter((_, i) => i !== idx);
  const next = [...unplaced];
  next[idx] = { ...row, placed_hours, remaining_hours };
  return next;
}
