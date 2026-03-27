'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';

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

const DEFAULT_MAX_LESSONS = 10;
const DEFAULT_SCHEDULE: LessonSlot[] = [
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

/** 1=Mon … 7=Sun */
export function isWeekendDow(dayOfWeek: number) {
  return dayOfWeek === 6 || dayOfWeek === 7;
}

const LUNCH_SLOT = {
  label: 'Öğle',
  timeRange: '12:30 - 13:30',
  isLunch: true as const,
};

export type TimeSlotDisplay = {
  label: string;
  timeRange: string;
  lessonNum?: number;
  isLunch?: boolean;
};

function sortSchedule(s: LessonSlot[]) {
  return [...s].sort((a, b) => a.lesson_num - b.lesson_num);
}

/** Hafta içi / hafta sonu; ikili eğitimde öğle vardiyası aynı ders no ile üst yazar (TV ile uyumlu). */
function effectiveScheduleForDay(settings: SchoolTimetableSettings | null, dayOfWeek: number): LessonSlot[] {
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

function buildTimeSlotsDisplay(
  schedule: LessonSlot[],
  educationMode: 'single' | 'double',
  cappedMax: number,
): TimeSlotDisplay[] {
  const getTimeRange = (lessonNum: number) => {
    const entry = schedule.find((s) => s.lesson_num === lessonNum) ?? DEFAULT_SCHEDULE.find((s) => s.lesson_num === lessonNum);
    return entry ? `${entry.start_time} - ${entry.end_time}` : '—';
  };

  const slots: TimeSlotDisplay[] = [];
  const LUNCH_AFTER = 4;
  for (let i = 1; i <= cappedMax; i++) {
    if (educationMode === 'single' && i === LUNCH_AFTER + 1) {
      slots.push(LUNCH_SLOT);
    }
    slots.push({ label: `${i}`, timeRange: getTimeRange(i), lessonNum: i });
  }
  return slots;
}

export function useSchoolTimetableSettings() {
  const { token, me } = useAuth();
  const [settings, setSettings] = useState<SchoolTimetableSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!token || !me?.school_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{
        duty_max_lessons: number | null;
        duty_education_mode: 'single' | 'double';
        lesson_schedule?: LessonSlot[];
        lesson_schedule_pm?: LessonSlot[];
        lesson_schedule_weekend?: LessonSlot[];
        lesson_schedule_weekend_pm?: LessonSlot[];
      }>('/duty/school-default-times', { token });
      setSettings({
        duty_max_lessons: data.duty_max_lessons ?? null,
        duty_education_mode: data.duty_education_mode ?? 'single',
        lesson_schedule: Array.isArray(data.lesson_schedule) ? data.lesson_schedule : [],
        lesson_schedule_pm: Array.isArray(data.lesson_schedule_pm) ? data.lesson_schedule_pm : [],
        lesson_schedule_weekend: Array.isArray(data.lesson_schedule_weekend) ? data.lesson_schedule_weekend : [],
        lesson_schedule_weekend_pm: Array.isArray(data.lesson_schedule_weekend_pm) ? data.lesson_schedule_weekend_pm : [],
      });
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [token, me?.school_id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const maxLessons = settings?.duty_max_lessons ?? DEFAULT_MAX_LESSONS;
  const cappedMax = Math.min(12, Math.max(6, maxLessons));

  const educationMode = settings?.duty_education_mode ?? 'single';

  const timeSlots: TimeSlotDisplay[] = useMemo(() => {
    const sched = effectiveScheduleForDay(settings, 1);
    return buildTimeSlotsDisplay(sched, educationMode, cappedMax);
  }, [settings, educationMode, cappedMax]);

  const getTimeSlotsForDay = useCallback(
    (dayOfWeek: number) => {
      const sched = effectiveScheduleForDay(settings, dayOfWeek);
      return buildTimeSlotsDisplay(sched, educationMode, cappedMax);
    },
    [settings, educationMode, cappedMax],
  );

  const getTimeRangeForDay = useCallback(
    (dayOfWeek: number, lessonNum: number) => {
      const sched = effectiveScheduleForDay(settings, dayOfWeek);
      const entry = sched.find((s) => s.lesson_num === lessonNum) ?? DEFAULT_SCHEDULE.find((s) => s.lesson_num === lessonNum);
      return entry ? `${entry.start_time} - ${entry.end_time}` : '—';
    },
    [settings],
  );

  return {
    settings,
    loading,
    refetch: fetchSettings,
    maxLessons: cappedMax,
    educationMode,
    timeSlots,
    getTimeSlotsForDay,
    getTimeRangeForDay,
    isDoubleShift: educationMode === 'double',
  };
}
