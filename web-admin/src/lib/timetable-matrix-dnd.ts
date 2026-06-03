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
