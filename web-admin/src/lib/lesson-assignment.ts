/** Program Stüdyosu ders ataması — öğretmen + ders + sınıf + saat + derslik */

import { roomCoversSection } from '@/lib/class-section-canonical';
import {
  distributionOptionsForHours,
  distributionToPlacementHints,
  formatDayDistribution,
  inferDayDistribution,
  isValidDayDistribution,
} from '@/lib/lesson-distribution';

export type RoomForAssignment = {
  id: string;
  name: string;
  allowed_subjects?: string[] | null;
  allowed_class_sections?: string[] | null;
  allowed_teacher_ids?: string[] | null;
};

export type LessonPeriodFormat = 'single' | 'double' | 'biweekly';

export type RoomPickMode = 'class' | 'teacher' | 'shared' | 'subject';

export type LessonAssignmentRow = {
  id: string;
  subject_id?: string | null;
  subject_name: string;
  class_sections: string[];
  weekly_hours: number;
  teacher_ids?: string[];
  room_ids?: string[];
  group_id?: string | null;
  biweekly?: boolean;
  place_first?: boolean;
  min_days_per_week?: number | null;
  max_per_day?: number | null;
  max_days_per_week?: number | null;
  fixed_slots?: Array<{ day_of_week: number; lesson_num: number; class_section?: string }>;
  options?: Record<string, unknown>;
};

export type LessonAssignmentDraft = {
  id?: string;
  subject_id: string;
  subject_name: string;
  primary_teacher_id: string;
  co_teacher_ids: string[];
  section: string;
  joined_sections: string[];
  use_joined: boolean;
  group_id: string;
  weekly_hours: number;
  /** Haftalık desen (gün başına saat): [2,2], [3,1], [4] … */
  day_distribution: number[];
  biweekly: boolean;
  room_mode: RoomPickMode;
  room_ids: string[];
  place_first: boolean;
};

export const ROOM_MODE_LABEL: Record<RoomPickMode, string> = {
  class: 'Sınıfın dersliği',
  teacher: 'Öğretmenin derslikleri',
  shared: 'Ortak derslik',
  subject: 'Derse ait derslik',
};

/** @deprecated UI’da kullanılmıyor; geriye dönük import */
export const PERIOD_FORMAT_LABEL = {
  single: 'Tek',
  double: 'İkili',
  biweekly: 'İki haftada bir',
} as const;

/** Tablo / özet: haftalık desen (2+2+1). */
export function ascImportTeacherHint(row: LessonAssignmentRow): string | null {
  const raw = row.options?.asc_import_teachers;
  if (!Array.isArray(raw)) return null;
  const names = raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
  return names.length ? names.join(', ') : null;
}

export function assignmentDistributionLabel(row: LessonAssignmentRow): string {
  return formatDayDistribution(inferDayDistribution(row.weekly_hours, row.options, !!row.biweekly));
}

/** Atama kartı kısa rozet metinleri. */
export function assignmentCardBadgeLabels(row: LessonAssignmentRow): string[] {
  const out: string[] = [];
  const block = Number(row.options?.block_lessons ?? 0);
  if (block >= 2) out.push(`Blok ${block}`);
  if (row.biweekly) out.push('2 haftada 1');
  if (row.place_first) out.push('Önce yerleş');
  if (row.min_days_per_week != null && row.min_days_per_week >= 2) out.push(`≥${row.min_days_per_week} gün`);
  if (row.max_per_day != null && row.max_per_day > 0) out.push(`≤${row.max_per_day}/gün`);
  if (row.fixed_slots?.length) out.push(`${row.fixed_slots.length} sabit slot`);
  return out;
}

export function assignmentToDraft(
  row: LessonAssignmentRow,
  subjects: Array<{ id: string; short_code?: string | null }>,
): LessonAssignmentDraft {
  const opts = row.options ?? {};
  const co =
    row.teacher_ids && row.teacher_ids.length > 1
      ? row.teacher_ids.slice(1)
      : Array.isArray(opts.co_teacher_ids)
        ? (opts.co_teacher_ids as string[])
        : [];
  const primary = row.teacher_ids?.[0] ?? '';
  const sections = row.class_sections ?? [];
  const use_joined = sections.length > 1;
  const day_distribution = inferDayDistribution(row.weekly_hours, opts, !!row.biweekly);

  return {
    id: row.id,
    subject_id: row.subject_id ?? subjects.find((s) => s.id)?.id ?? '',
    subject_name: row.subject_name,
    primary_teacher_id: primary,
    co_teacher_ids: co,
    section: sections[0] ?? '',
    joined_sections: use_joined ? sections : [],
    use_joined,
    group_id: row.group_id ?? '',
    weekly_hours: row.weekly_hours,
    day_distribution,
    biweekly: !!row.biweekly,
    room_mode: (opts.room_mode as RoomPickMode) ?? 'class',
    room_ids: row.room_ids ?? [],
    place_first: !!row.place_first,
  };
}

export function assignmentUsesRoom(a: LessonAssignmentRow, room: RoomForAssignment): boolean {
  if (a.room_ids?.includes(room.id)) return true;
  const mode = (a.options?.room_mode as RoomPickMode | undefined) ?? 'class';
  const sections = a.class_sections ?? [];
  if (mode === 'class') {
    return sections.some((sec) => roomCoversSection(room.name, room.allowed_class_sections, sec));
  }
  if (mode === 'teacher') {
    return (a.teacher_ids ?? []).some((tid) => room.allowed_teacher_ids?.includes(tid));
  }
  if (mode === 'subject') {
    const sn = a.subject_name.trim().toLocaleLowerCase('tr');
    if (!sn) return false;
    return (
      room.allowed_subjects?.some(
        (s) => {
          const x = s.toLocaleLowerCase('tr');
          return x.includes(sn) || sn.includes(x);
        },
      ) ?? false
    );
  }
  return false;
}

export function draftToApiBody(draft: LessonAssignmentDraft, rooms?: RoomForAssignment[]) {
  const teacher_ids = [
    draft.primary_teacher_id,
    ...draft.co_teacher_ids.filter((id) => id && id !== draft.primary_teacher_id),
  ].filter(Boolean);

  const class_sections = draft.use_joined && draft.joined_sections.length
    ? draft.joined_sections
    : draft.section
      ? [draft.section]
      : [];

  const effHours = draft.biweekly ? Math.ceil(draft.weekly_hours / 2) : draft.weekly_hours;
  const dist = isValidDayDistribution(draft.day_distribution, effHours)
    ? draft.day_distribution
    : inferDayDistribution(draft.weekly_hours, {}, draft.biweekly);
  const hints = distributionToPlacementHints(dist);
  const block = hints.block_lessons >= 2 ? hints.block_lessons : undefined;

  let room_ids = draft.room_ids;
  if (!room_ids.length && draft.room_mode !== 'shared' && rooms?.length) {
    const sec = class_sections[0] ?? draft.section;
    room_ids = suggestRooms(draft.room_mode, {
      section: sec,
      subjectName: draft.subject_name,
      teacherId: draft.primary_teacher_id,
      rooms,
    });
  }

  return {
    id: draft.id,
    subject_id: draft.subject_id || null,
    subject_name: draft.subject_name.trim(),
    class_sections,
    weekly_hours: Math.max(1, draft.weekly_hours),
    teacher_ids,
    room_ids,
    group_id: draft.group_id || null,
    biweekly: draft.biweekly,
    place_first: draft.place_first,
    min_days_per_week: hints.min_days_per_week,
    max_per_day: hints.max_per_day,
    options: {
      room_mode: draft.room_mode,
      co_teacher_ids: draft.co_teacher_ids,
      co_teach: draft.co_teacher_ids.length > 0,
      day_distribution: dist,
      ...(block ? { block_lessons: block } : {}),
    },
  };
}

export { distributionOptionsForHours, formatDayDistribution };

export function suggestRooms(
  mode: RoomPickMode,
  ctx: {
    section: string;
    subjectName: string;
    teacherId: string;
    rooms: RoomForAssignment[];
  },
): string[] {
  const { rooms, section, subjectName, teacherId } = ctx;
  if (mode === 'class' && section) {
    const hit = rooms.filter((r) => roomCoversSection(r.name, r.allowed_class_sections, section));
    if (hit.length) return [hit[0]!.id];
  }
  if (mode === 'teacher' && teacherId) {
    const hit = rooms.filter((r) => r.allowed_teacher_ids?.includes(teacherId));
    if (hit.length) return [hit[0]!.id];
  }
  if (mode === 'subject' && subjectName) {
    const sn = subjectName.toLocaleLowerCase('tr');
    const hit = rooms.filter((r) =>
      r.allowed_subjects?.some((s) => s.toLocaleLowerCase('tr').includes(sn) || sn.includes(s.toLocaleLowerCase('tr'))),
    );
    if (hit.length) return [hit[0]!.id];
  }
  if (mode === 'shared' && rooms[0]) return [rooms[0].id];
  return [];
}
