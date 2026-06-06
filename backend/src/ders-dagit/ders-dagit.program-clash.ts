import { sectionIdentityKey, sectionsEquivalent } from './class-section-canonical';
import type { DersDagitGroupMode } from './ders-dagit.groups';

export type ProgramEntryLike = {
  id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  user_id: string | null;
  assignment_id?: string | null;
  group_id?: string | null;
};

export type ProgramClashContext = {
  group_modes?: Map<string, DersDagitGroupMode> | Record<string, DersDagitGroupMode>;
};

function getGroupMode(ctx: ProgramClashContext | undefined, gid: string): DersDagitGroupMode | undefined {
  if (!ctx?.group_modes) return undefined;
  if (ctx.group_modes instanceof Map) return ctx.group_modes.get(gid);
  return ctx.group_modes[gid];
}

function coTeachSameSlot(a: ProgramEntryLike, b: ProgramEntryLike): boolean {
  return !!a.assignment_id && a.assignment_id === b.assignment_id;
}

function sameClassSection(a: string, b: string): boolean {
  return a === b || sectionsEquivalent(a, b);
}

export function classClashBetween(a: ProgramEntryLike, b: ProgramEntryLike): boolean {
  if (!sameClassSection(a.class_section, b.class_section)) return false;
  return !coTeachSameSlot(a, b);
}

export function teacherClashBetween(
  a: ProgramEntryLike,
  b: ProgramEntryLike,
  ctx?: ProgramClashContext,
): boolean {
  if (!a.user_id || !b.user_id || a.user_id !== b.user_id) return false;
  if (coTeachSameSlot(a, b)) return false;
  const gid = a.group_id && a.group_id === b.group_id ? a.group_id : null;
  if (!gid) return true;
  const mode = getGroupMode(ctx, gid);
  if (mode === 'teacher_multi_class') return false;
  if (mode === 'subgroups' && !sameClassSection(a.class_section, b.class_section)) return false;
  if (mode === 'parallel_rooms') return false;
  return true;
}

export type SlotClash = {
  entry_id: string;
  day_of_week: number;
  lesson_num: number;
  code: 'CLASS_CLASH' | 'TEACHER_CLASH';
  message: string;
  other_entry_id?: string;
};

export function wouldClashAt(
  entries: ProgramEntryLike[],
  probe: ProgramEntryLike,
  day: number,
  lesson: number,
  excludeEntryIds: string[] = [],
  ctx?: ProgramClashContext,
): SlotClash | null {
  const atSlot = { ...probe, day_of_week: day, lesson_num: lesson };
  for (const other of entries) {
    if (other.id === probe.id || excludeEntryIds.includes(other.id)) continue;
    if (other.day_of_week !== day || other.lesson_num !== lesson) continue;
    if (classClashBetween(atSlot, other)) {
      return {
        entry_id: probe.id,
        day_of_week: day,
        lesson_num: lesson,
        code: 'CLASS_CLASH',
        message: 'Sınıf çakışması',
        other_entry_id: other.id,
      };
    }
    if (teacherClashBetween(atSlot, other, ctx)) {
      return {
        entry_id: probe.id,
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

export function computeProgramClashes(
  entries: ProgramEntryLike[],
  ctx?: ProgramClashContext,
): SlotClash[] {
  const out: SlotClash[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.day_of_week !== b.day_of_week || a.lesson_num !== b.lesson_num) continue;
      if (classClashBetween(a, b)) {
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
      if (teacherClashBetween(a, b, ctx)) {
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
  ctx?: ProgramClashContext,
): SlotClash | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return null;
  const exclude = excludeEntryId ? [excludeEntryId] : [];
  return wouldClashAt(entries, entry, day, lesson, exclude, ctx);
}

export function classSlotKey(section: string, day: number, lesson: number): string {
  return `${sectionIdentityKey(section)}\0${day}\0${lesson}`;
}
