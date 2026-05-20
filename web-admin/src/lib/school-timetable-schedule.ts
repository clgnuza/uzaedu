export type LessonSlot = {
  lesson_num: number;
  start_time: string;
  end_time: string;
};

export type SchoolTimetableSettings = {
  duty_max_lessons: number | null;
  duty_education_mode: 'single' | 'double';
  lesson_schedule: LessonSlot[];
  lesson_schedule_pm: LessonSlot[];
  lesson_schedule_weekend: LessonSlot[];
  lesson_schedule_weekend_pm: LessonSlot[];
};

export const DEFAULT_MAX_LESSONS = 10;

export const DEFAULT_SCHEDULE: LessonSlot[] = [
  { lesson_num: 1, start_time: '08:30', end_time: '09:10' },
  { lesson_num: 2, start_time: '09:20', end_time: '10:00' },
  { lesson_num: 3, start_time: '10:10', end_time: '10:50' },
  { lesson_num: 4, start_time: '11:00', end_time: '11:40' },
  { lesson_num: 5, start_time: '13:40', end_time: '14:20' },
  { lesson_num: 6, start_time: '14:30', end_time: '15:10' },
  { lesson_num: 7, start_time: '15:20', end_time: '16:00' },
  { lesson_num: 8, start_time: '16:10', end_time: '16:50' },
  { lesson_num: 9, start_time: '17:00', end_time: '17:40' },
  { lesson_num: 10, start_time: '17:50', end_time: '18:30' },
];

function sortSchedule(s: LessonSlot[]) {
  return [...s].sort((a, b) => a.lesson_num - b.lesson_num);
}

/** JS getDay() (0=Paz) → 1=Pzt … 7=Paz */
export function jsGetDayToTurkish(jsDay: number) {
  return jsDay === 0 ? 7 : jsDay;
}

/** 1=Mon … 7=Sun */
export function isWeekendDow(dayOfWeek: number) {
  return dayOfWeek === 6 || dayOfWeek === 7;
}

export function effectiveScheduleForDay(settings: SchoolTimetableSettings | null, dayOfWeek: number): LessonSlot[] {
  const mode = settings?.duty_education_mode ?? 'single';
  const isWknd = isWeekendDow(dayOfWeek);
  const wdAm = settings?.lesson_schedule?.length ? sortSchedule(settings.lesson_schedule) : DEFAULT_SCHEDULE;
  const am = isWknd
    ? settings?.lesson_schedule_weekend?.length
      ? sortSchedule(settings.lesson_schedule_weekend)
      : wdAm
    : wdAm;

  if (mode !== 'double') return am;

  const wdPm = settings?.lesson_schedule_pm?.length ? sortSchedule(settings.lesson_schedule_pm) : [];
  const pm = isWknd
    ? settings?.lesson_schedule_weekend_pm?.length
      ? sortSchedule(settings.lesson_schedule_weekend_pm)
      : wdPm
    : wdPm;

  const byNum = new Map<number, LessonSlot>();
  for (const s of am) byNum.set(s.lesson_num, { ...s });
  for (const s of pm) byNum.set(s.lesson_num, { ...s });
  return [...byNum.values()].sort((a, b) => a.lesson_num - b.lesson_num);
}

export function lessonSlotForDay(
  settings: SchoolTimetableSettings | null,
  turkishDow: number,
  lessonNum: number,
): LessonSlot | null {
  const sched = effectiveScheduleForDay(settings, turkishDow);
  return sched.find((s) => s.lesson_num === lessonNum) ?? DEFAULT_SCHEDULE.find((s) => s.lesson_num === lessonNum) ?? null;
}

function toMinutes(t: string): number {
  const s = t.trim().slice(0, 5);
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function clockRangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

export function turkishDowFromYmd(ymd: string): number {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  return jsGetDayToTurkish(d.getDay());
}

export function teacherLessonNumsOverlappingExam(
  lessonNums: number[],
  settings: SchoolTimetableSettings | null,
  turkishDow: number,
  examStart: string,
  examEnd: string,
): number[] {
  const out: number[] = [];
  for (const num of lessonNums) {
    const slot = lessonSlotForDay(settings, turkishDow, num);
    if (!slot) continue;
    if (clockRangesOverlap(examStart, examEnd, slot.start_time, slot.end_time)) out.push(num);
  }
  return out;
}
