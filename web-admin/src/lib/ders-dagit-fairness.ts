export type TeacherLoadStatus = 'low' | 'balanced' | 'high';

export type FairnessTeacherStat = {
  teacher_id: string;
  label?: string;
  branch?: string | null;
  mandatory_weekly_hours?: number | null;
  lesson_count: number;
  work_day_count: number;
  gap_count: number;
  deviation_from_avg: number;
  load_status?: TeacherLoadStatus;
  gap_heavy?: boolean;
};

export type FairnessMetrics = {
  ready: boolean;
  message?: string;
  program_id?: string;
  program_name?: string;
  program_status?: string;
  avg_lessons_per_teacher?: number;
  min_lessons_per_teacher?: number;
  max_lessons_per_teacher?: number;
  lesson_spread?: number;
  fairness_index?: number;
  distribution_label?: string;
  teacher_count?: number;
  total_gaps?: number;
  monday_friday_slot_ratio?: number;
  hint?: string | null;
  teacher_stats?: FairnessTeacherStat[];
};

export const LOAD_STATUS_LABEL: Record<TeacherLoadStatus, string> = {
  low: 'Ortalamanın altında',
  balanced: 'Dengeli',
  high: 'Ortalamanın üstünde',
};

export const LOAD_STATUS_TONE: Record<TeacherLoadStatus, string> = {
  low: 'bg-sky-500/15 text-sky-800 ring-sky-500/30 dark:text-sky-200',
  balanced: 'bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200',
  high: 'bg-rose-500/15 text-rose-800 ring-rose-500/30 dark:text-rose-200',
};

export function barColorForLessons(count: number, min: number, max: number): string {
  if (max === min) return 'oklch(0.55 0.15 145)';
  const pos = (count - min) / (max - min);
  if (pos <= 0.33) return 'oklch(0.55 0.15 145)';
  if (pos <= 0.66) return 'oklch(0.7 0.12 85)';
  return 'oklch(0.65 0.18 25)';
}

export function fairnessIndexTone(index: number): string {
  if (index >= 80) return 'text-emerald-500';
  if (index >= 55) return 'text-amber-500';
  return 'text-rose-500';
}
