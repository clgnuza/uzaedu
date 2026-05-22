export type TeacherConfig = {
  id: string;
  user_id: string;
  display_name?: string;
  branch?: string | null;
  mandatory_weekly_hours: number | null;
  max_extra_weekly_hours: number | null;
  max_lessons_per_day: number | null;
  min_work_days: number | null;
  max_work_days: number | null;
  allow_am_pm_gap: boolean;
  unavailable_periods: Array<{ day_of_week: number; lesson_num?: number }>;
  constraints?: { education_shift?: 'morning' | 'afternoon' | null };
};

export type TeacherDraft = Omit<TeacherConfig, 'id' | 'user_id' | 'display_name'>;
