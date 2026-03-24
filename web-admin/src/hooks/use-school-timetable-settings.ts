'use client';

import { useState, useEffect, useCallback } from 'react';
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

/** Lunch slot between lesson 4 and 5 for single education. */
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
      }>('/duty/school-default-times', { token });
      setSettings({
        duty_max_lessons: data.duty_max_lessons ?? null,
        duty_education_mode: data.duty_education_mode ?? 'single',
        lesson_schedule: Array.isArray(data.lesson_schedule) ? data.lesson_schedule : [],
        lesson_schedule_pm: Array.isArray(data.lesson_schedule_pm) ? data.lesson_schedule_pm : [],
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

  /** Build display slots from school lesson_schedule or defaults. Single education: lunch row between 4 and 5. */
  const timeSlots: TimeSlotDisplay[] = (() => {
    const schedule = settings?.lesson_schedule?.length
      ? [...settings.lesson_schedule].sort((a, b) => a.lesson_num - b.lesson_num)
      : DEFAULT_SCHEDULE;

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
  })();

  return {
    settings,
    loading,
    refetch: fetchSettings,
    maxLessons: cappedMax,
    educationMode,
    timeSlots,
    isDoubleShift: educationMode === 'double',
  };
}
