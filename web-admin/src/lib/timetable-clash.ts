export type TimetableEntryRow = {
  id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  user_id?: string | null;
};

export type ClashCode = 'CLASS_CLASH' | 'TEACHER_CLASH';

export function clashAtSlot(
  entries: TimetableEntryRow[],
  entryId: string,
  day: number,
  lesson: number,
  excludeId?: string,
): ClashCode | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return null;
  for (const other of entries) {
    if (other.id === entryId || other.id === excludeId) continue;
    if (other.day_of_week !== day || other.lesson_num !== lesson) continue;
    if (other.class_section === entry.class_section) return 'CLASS_CLASH';
    if (entry.user_id && other.user_id === entry.user_id) return 'TEACHER_CLASH';
  }
  return null;
}

export function clashEntryIds(entries: TimetableEntryRow[]): Set<string> {
  const bad = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.day_of_week !== b.day_of_week || a.lesson_num !== b.lesson_num) continue;
      if (a.class_section === b.class_section) {
        bad.add(a.id);
        bad.add(b.id);
      }
      if (a.user_id && b.user_id && a.user_id === b.user_id) {
        bad.add(a.id);
        bad.add(b.id);
      }
    }
  }
  return bad;
}
