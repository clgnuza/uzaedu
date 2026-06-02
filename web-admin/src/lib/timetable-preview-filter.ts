import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export function filterEntriesForPreview(
  entries: EditorEntry[],
  mode: 'class' | 'teacher' | 'room',
  id: string,
): EditorEntry[] {
  if (mode === 'class') return entries.filter((e) => e.class_section === id);
  if (mode === 'teacher') return entries.filter((e) => e.user_id === id);
  return entries.filter((e) => e.room_id === id);
}
