'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import {
  DEFAULT_MAX_LESSONS,
  DEFAULT_SCHEDULE,
  effectiveScheduleForDay,
  type LessonSlot,
  type SchoolTimetableSettings,
} from '@/lib/school-timetable-schedule';

export type { LessonSlot, SchoolTimetableSettings };
export {
  jsGetDayToTurkish,
  isWeekendDow,
  effectiveScheduleForDay,
  lessonSlotForDay,
  clockRangesOverlap,
  turkishDowFromYmd,
  teacherLessonNumsOverlappingExam,
} from '@/lib/school-timetable-schedule';

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
