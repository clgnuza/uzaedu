/** aSc "Ders" atama — öğretmen + ders + sınıf + saat + derslik birleşimi */

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
  period_format: LessonPeriodFormat;
  room_mode: RoomPickMode;
  room_ids: string[];
  place_first: boolean;
  min_days_per_week: number;
  max_per_day: number;
};

export const PERIOD_FORMAT_LABEL: Record<LessonPeriodFormat, string> = {
  single: 'Tek',
  double: 'İkili',
  biweekly: 'İki haftada bir',
};

export const ROOM_MODE_LABEL: Record<RoomPickMode, string> = {
  class: 'Sınıfın dersliği',
  teacher: 'Öğretmenin derslikleri',
  shared: 'Ortak derslik',
  subject: 'Derse ait derslik',
};

export function assignmentToDraft(
  row: LessonAssignmentRow,
  subjects: Array<{ id: string; short_code?: string | null }>,
): LessonAssignmentDraft {
  const opts = row.options ?? {};
  const block = Number(opts.block_lessons ?? 0);
  const co =
    row.teacher_ids && row.teacher_ids.length > 1
      ? row.teacher_ids.slice(1)
      : Array.isArray(opts.co_teacher_ids)
        ? (opts.co_teacher_ids as string[])
        : [];
  const primary = row.teacher_ids?.[0] ?? '';
  let period_format: LessonPeriodFormat = 'single';
  if (row.biweekly) period_format = 'biweekly';
  else if (block >= 2) period_format = 'double';

  const sections = row.class_sections ?? [];
  const use_joined = sections.length > 1;

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
    period_format,
    room_mode: (opts.room_mode as RoomPickMode) ?? 'class',
    room_ids: row.room_ids ?? [],
    place_first: !!row.place_first,
    min_days_per_week: row.min_days_per_week ?? 2,
    max_per_day: row.max_per_day ?? 2,
  };
}

export function draftToApiBody(draft: LessonAssignmentDraft) {
  const teacher_ids = [
    draft.primary_teacher_id,
    ...draft.co_teacher_ids.filter((id) => id && id !== draft.primary_teacher_id),
  ].filter(Boolean);

  const class_sections = draft.use_joined && draft.joined_sections.length
    ? draft.joined_sections
    : draft.section
      ? [draft.section]
      : [];

  const biweekly = draft.period_format === 'biweekly';
  const block_lessons = draft.period_format === 'double' ? 2 : undefined;

  return {
    id: draft.id,
    subject_id: draft.subject_id || null,
    subject_name: draft.subject_name.trim(),
    class_sections,
    weekly_hours: Math.max(1, draft.weekly_hours),
    teacher_ids,
    room_ids: draft.room_ids,
    group_id: draft.group_id || null,
    biweekly,
    place_first: draft.place_first,
    min_days_per_week: draft.min_days_per_week,
    max_per_day: draft.max_per_day,
    options: {
      room_mode: draft.room_mode,
      co_teacher_ids: draft.co_teacher_ids,
      co_teach: draft.co_teacher_ids.length > 0,
      ...(block_lessons ? { block_lessons } : {}),
    },
  };
}

export function suggestRooms(
  mode: RoomPickMode,
  ctx: {
    section: string;
    subjectName: string;
    teacherId: string;
    rooms: Array<{
      id: string;
      name: string;
      allowed_subjects?: string[] | null;
      allowed_class_sections?: string[] | null;
      allowed_teacher_ids?: string[] | null;
    }>;
  },
): string[] {
  const { rooms, section, subjectName, teacherId } = ctx;
  if (mode === 'class' && section) {
    const hit = rooms.filter((r) => r.allowed_class_sections?.includes(section));
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
