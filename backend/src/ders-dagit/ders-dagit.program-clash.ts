export type ProgramEntryLike = {
  id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  user_id: string | null;
};

export type SlotClash = {
  entry_id: string;
  day_of_week: number;
  lesson_num: number;
  code: 'CLASS_CLASH' | 'TEACHER_CLASH';
  message: string;
  other_entry_id?: string;
};

export function computeProgramClashes(entries: ProgramEntryLike[]): SlotClash[] {
  const out: SlotClash[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.day_of_week !== b.day_of_week || a.lesson_num !== b.lesson_num) continue;
      if (a.class_section === b.class_section) {
        out.push({
          entry_id: a.id,
          day_of_week: a.day_of_week,
          lesson_num: a.lesson_num,
          code: 'CLASS_CLASH',
          message: 'Sınıf çakışması',
          other_entry_id: b.id,
        });
        out.push({
          entry_id: b.id,
          day_of_week: b.day_of_week,
          lesson_num: b.lesson_num,
          code: 'CLASS_CLASH',
          message: 'Sınıf çakışması',
          other_entry_id: a.id,
        });
      }
      if (a.user_id && b.user_id && a.user_id === b.user_id) {
        out.push({
          entry_id: a.id,
          day_of_week: a.day_of_week,
          lesson_num: a.lesson_num,
          code: 'TEACHER_CLASH',
          message: 'Öğretmen çakışması',
          other_entry_id: b.id,
        });
        out.push({
          entry_id: b.id,
          day_of_week: b.day_of_week,
          lesson_num: b.lesson_num,
          code: 'TEACHER_CLASH',
          message: 'Öğretmen çakışması',
          other_entry_id: a.id,
        });
      }
    }
  }
  return out;
}

export function wouldClash(
  entries: ProgramEntryLike[],
  entryId: string,
  day: number,
  lesson: number,
  excludeEntryId?: string,
): SlotClash | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return null;
  for (const other of entries) {
    if (other.id === entryId || other.id === excludeEntryId) continue;
    if (other.day_of_week !== day || other.lesson_num !== lesson) continue;
    if (other.class_section === entry.class_section) {
      return {
        entry_id: entryId,
        day_of_week: day,
        lesson_num: lesson,
        code: 'CLASS_CLASH',
        message: 'Sınıf çakışması',
        other_entry_id: other.id,
      };
    }
    if (entry.user_id && other.user_id === entry.user_id) {
      return {
        entry_id: entryId,
        day_of_week: day,
        lesson_num: lesson,
        code: 'TEACHER_CLASH',
        message: 'Öğretmen çakışması',
        other_entry_id: other.id,
      };
    }
  }
  return null;
}
