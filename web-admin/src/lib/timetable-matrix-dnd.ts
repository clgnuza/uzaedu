import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export type MatrixAxis = 'teacher' | 'class' | 'room';

function teacherRowKey(e: { user_id?: string | null; teacher_label?: string | null }): string {
  if (e.user_id) return `u:${e.user_id}`;
  const lb = (e.teacher_label ?? '').trim();
  return lb ? `l:${lb}` : 'l:?';
}

export function matrixDropId(rowKey: string, day: number, lesson: number): string {
  return `matrix|${rowKey}|${day}|${lesson}`;
}

export function parseMatrixDropId(id: string): { rowKey: string; day: number; lesson: number } | null {
  const m = /^matrix\|(.+)\|(\d+)\|(\d+)$/.exec(id);
  if (!m) return null;
  return { rowKey: m[1]!, day: Number(m[2]), lesson: Number(m[3]) };
}

export function entryMatchesMatrixRow(entry: EditorEntry, rowKey: string, axis: MatrixAxis): boolean {
  if (axis === 'teacher') return teacherRowKey(entry) === rowKey;
  if (axis === 'class') return `c:${entry.class_section.trim()}` === rowKey;
  const rk = entry.room_id ? `r:${entry.room_id}` : 'r:__none__';
  return rk === rowKey;
}

export function poolRowMatches(
  rowKey: string,
  axis: MatrixAxis,
  classSection: string,
  userId: string | null,
): boolean {
  if (axis === 'class') return `c:${classSection.trim()}` === rowKey;
  if (axis === 'teacher') return !!userId && `u:${userId}` === rowKey;
  return true;
}

/** Matris sürüklemede yalnızca hedef satır droppable — binlerce hücre ölçümü önlenir. */
export function matrixDragTargetRowKey(
  dragSource: { type: 'entry'; entry: EditorEntry } | { type: 'pool'; classSection: string; userId?: string | null } | null,
  axis: MatrixAxis,
): string | null {
  if (!dragSource) return null;
  if (dragSource.type === 'entry') {
    const e = dragSource.entry;
    if (axis === 'teacher') return teacherRowKey(e);
    if (axis === 'class') return `c:${e.class_section.trim()}`;
    return e.room_id ? `r:${e.room_id}` : 'r:__none__';
  }
  if (axis === 'class') return `c:${dragSource.classSection.trim()}`;
  if (axis === 'teacher' && dragSource.userId) return `u:${dragSource.userId}`;
  return null;
}

/** Sürükleme sırasında droppable olacak satırlar (null = matriste bırakma kapalı). */
export function matrixDragTargetRowKeys(
  dragSource: { type: 'entry'; entry: EditorEntry } | { type: 'pool'; classSection: string; userId?: string | null } | null,
  axis: MatrixAxis,
  entries?: EditorEntry[],
): Set<string> | null {
  if (!dragSource) return null;
  const one = matrixDragTargetRowKey(dragSource, axis);
  if (one) return new Set([one]);
  // Öğretmensiz havuz ataması: öğretmen matrisinde onlarca satır droppable açmamak için kapalı.
  if (dragSource.type === 'pool' && axis === 'teacher' && !dragSource.userId) {
    return null;
  }
  return null;
}
