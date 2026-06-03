import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import type { TimetablePreviewTarget } from '@/lib/timetable-preview-types';

export type TimetableMatrixAxis = 'teacher' | 'class' | 'room';

export type TimetablePreviewContext = {
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
};

export type TimetableCellMenuHandlers = {
  rooms?: Array<{ id: string; name: string }>;
  preview?: TimetablePreviewContext;
  onEdit: (entry: EditorEntry) => void;
  onLock?: (entryId: string, locked: boolean) => void;
  onDelete?: (entryId: string) => void;
  onRemoveAssignmentSlots?: (entry: EditorEntry) => void;
  onClearSlots?: (entryIds: string[]) => void;
  onChangeRoom?: (entryId: string, roomId: string | null) => void;
  onNavigateView?: (mode: 'class' | 'teacher' | 'room', id: string) => void;
  onOpenPreview?: (target: TimetablePreviewTarget) => void;
  onOpenAssignments?: (entry: EditorEntry) => void;
  onOpenValidation?: () => void;
  onMergeDoubles?: (entry: EditorEntry) => void;
  onSplitDoubles?: (entry: EditorEntry) => void;
  onFindTeacher?: (entry: EditorEntry) => void;
  onFindClass?: (entry: EditorEntry) => void;
  onFindRoom?: (entry: EditorEntry) => void;
};

export type TimetableEmptySlotMenuHandlers = {
  preview?: TimetablePreviewContext;
  filterMode?: 'class' | 'teacher' | 'room';
  filterId?: string;
  onPlaceAt?: (day: number, lesson: number) => void;
  onClearColumn?: (day: number) => void;
  onClearSlots?: (entryIds: string[]) => void;
  /** Grid tarafından ders satırı için doldurulur */
  onClearLessonRow?: () => void;
  onNavigateView?: (mode: 'class' | 'teacher' | 'room', id: string) => void;
  onOpenPreview?: (target: TimetablePreviewTarget) => void;
  onOpenConstraints?: () => void;
};

export function matrixTeacherRowKey(e: EditorEntry): string {
  if (e.user_id) return `u:${e.user_id}`;
  const lb = (e.teacher_label ?? '').trim();
  return lb ? `l:${lb}` : 'l:?';
}

export function parseMatrixTeacherRowKey(rowKey: string): { userId: string | null; label: string | null } {
  if (rowKey.startsWith('u:')) return { userId: rowKey.slice(2), label: null };
  if (rowKey.startsWith('l:')) return { userId: null, label: rowKey.slice(2) || null };
  return { userId: null, label: null };
}

export type TimetableMatrixRowMenuHandlers = {
  onFocusTeacher?: (teacherId: string | null, label: string) => void;
  onLockAll?: (entryIds: string[], locked: boolean) => void | Promise<void>;
  onClearAll?: (entryIds: string[]) => void | Promise<void>;
  onOpenAssignments?: (teacherId: string | null, label: string) => void;
  onFocusClash?: (entryId: string, slotKey: string) => void;
};

export function entriesForMatrixRow(
  entries: EditorEntry[],
  rowKey: string,
  axis: TimetableMatrixAxis,
): EditorEntry[] {
  if (axis === 'teacher') return entries.filter((e) => matrixTeacherRowKey(e) === rowKey);
  if (axis === 'class') return entries.filter((e) => `c:${e.class_section.trim()}` === rowKey);
  if (rowKey === 'r:__none__') return entries.filter((e) => !e.room_id);
  return entries.filter((e) => e.room_id && `r:${e.room_id}` === rowKey);
}

function teacherRowKey(e: EditorEntry): string {
  return matrixTeacherRowKey(e);
}

export function entriesInMatrixLessonRow(
  entries: EditorEntry[],
  entry: EditorEntry,
  axis: TimetableMatrixAxis,
): EditorEntry[] {
  return entries.filter((e) => {
    if (e.lesson_num !== entry.lesson_num) return false;
    if (axis === 'teacher') return teacherRowKey(e) === teacherRowKey(entry);
    if (axis === 'class') return e.class_section === entry.class_section;
    const rid = entry.room_id ?? '';
    return (e.room_id ?? '') === rid && rid !== '';
  });
}

export function entriesInGridLessonRow(entries: EditorEntry[], entry: EditorEntry): EditorEntry[] {
  return entries.filter((e) => e.lesson_num === entry.lesson_num);
}

export function entriesInGridDayColumn(
  entries: EditorEntry[],
  day: number,
  filter?: { mode: 'class' | 'teacher' | 'room'; id: string },
): EditorEntry[] {
  let list = entries.filter((e) => e.day_of_week === day);
  if (!filter) return list;
  if (filter.mode === 'class') list = list.filter((e) => e.class_section === filter.id);
  else if (filter.mode === 'teacher') list = list.filter((e) => e.user_id === filter.id);
  else if (filter.id === '__none__') list = list.filter((e) => !e.room_id);
  else list = list.filter((e) => e.room_id === filter.id);
  return list;
}
