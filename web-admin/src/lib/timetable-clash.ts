import { sectionsMatch } from '@/lib/class-section-canonical';

export type TimetableEntryRow = {
  id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  user_id?: string | null;
  assignment_id?: string | null;
  group_id?: string | null;
};

export type ClashCode = 'CLASS_CLASH' | 'TEACHER_CLASH';

export type TimetableClashContext = {
  group_modes?: Record<string, 'parallel_rooms' | 'subgroups' | 'teacher_multi_class'>;
};

function coTeachSameSlotAllowed(a: TimetableEntryRow, b: TimetableEntryRow): boolean {
  return !!a.assignment_id && a.assignment_id === b.assignment_id;
}

function sameClassSection(a: string, b: string): boolean {
  return a === b || sectionsMatch(a, b);
}

function classClashBetween(a: TimetableEntryRow, b: TimetableEntryRow): boolean {
  if (!sameClassSection(a.class_section, b.class_section)) return false;
  return !coTeachSameSlotAllowed(a, b);
}

function teacherClashBetween(
  a: TimetableEntryRow,
  b: TimetableEntryRow,
  ctx?: TimetableClashContext,
): boolean {
  if (!a.user_id || !b.user_id || a.user_id !== b.user_id) return false;
  if (coTeachSameSlotAllowed(a, b)) return false;
  const gid = a.group_id && a.group_id === b.group_id ? a.group_id : null;
  if (!gid) return true;
  const mode = ctx?.group_modes?.[gid];
  if (mode === 'teacher_multi_class') return false;
  if (mode === 'subgroups' && !sameClassSection(a.class_section, b.class_section)) return false;
  if (mode === 'parallel_rooms') return false;
  return true;
}

export function clashAtSlot(
  entries: TimetableEntryRow[],
  entryId: string,
  day: number,
  lesson: number,
  excludeIds?: Set<string>,
  ctx?: TimetableClashContext,
): ClashCode | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return null;
  for (const other of entries) {
    if (other.id === entryId) continue;
    if (excludeIds?.has(other.id)) continue;
    if (other.day_of_week !== day || other.lesson_num !== lesson) continue;
    if (classClashBetween(entry, other)) return 'CLASS_CLASH';
    if (teacherClashBetween(entry, other, ctx)) return 'TEACHER_CLASH';
  }
  return null;
}

export function listClashes(
  entries: TimetableEntryRow[],
  ctx?: TimetableClashContext,
): Array<{
  entry_id: string;
  code: ClashCode;
  message: string;
  day_of_week: number;
  lesson_num: number;
}> {
  const out: Array<{
    entry_id: string;
    code: ClashCode;
    message: string;
    day_of_week: number;
    lesson_num: number;
  }> = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.day_of_week !== b.day_of_week || a.lesson_num !== b.lesson_num) continue;
      if (classClashBetween(a, b)) {
        const msg = `Sınıf çakışması (${a.class_section})`;
        out.push({
          entry_id: a.id,
          code: 'CLASS_CLASH',
          message: msg,
          day_of_week: a.day_of_week,
          lesson_num: a.lesson_num,
        });
        out.push({
          entry_id: b.id,
          code: 'CLASS_CLASH',
          message: msg,
          day_of_week: b.day_of_week,
          lesson_num: b.lesson_num,
        });
      }
      if (teacherClashBetween(a, b, ctx)) {
        const msg = 'Öğretmen çakışması';
        out.push({
          entry_id: a.id,
          code: 'TEACHER_CLASH',
          message: msg,
          day_of_week: a.day_of_week,
          lesson_num: a.lesson_num,
        });
        out.push({
          entry_id: b.id,
          code: 'TEACHER_CLASH',
          message: msg,
          day_of_week: b.day_of_week,
          lesson_num: b.lesson_num,
        });
      }
    }
  }
  return out;
}

export function clashEntryIds(entries: TimetableEntryRow[], ctx?: TimetableClashContext): Set<string> {
  const bad = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.day_of_week !== b.day_of_week || a.lesson_num !== b.lesson_num) continue;
      if (classClashBetween(a, b)) {
        bad.add(a.id);
        bad.add(b.id);
      }
      if (teacherClashBetween(a, b, ctx)) {
        bad.add(a.id);
        bad.add(b.id);
      }
    }
  }
  return bad;
}
