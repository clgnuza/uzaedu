import type { LessonAssignmentRow } from '@/lib/lesson-assignment';
import {
  distributionToPlacementHints,
  inferDayDistribution,
  isValidDayDistribution,
} from '@/lib/lesson-distribution';

export function assignmentUpsertBodyWithDistribution(
  row: LessonAssignmentRow,
  day_distribution: number[],
): Record<string, unknown> {
  const effHours = row.biweekly ? Math.ceil(row.weekly_hours / 2) : row.weekly_hours;
  const dist = isValidDayDistribution(day_distribution, effHours)
    ? day_distribution
    : inferDayDistribution(row.weekly_hours, row.options, row.biweekly);
  const hints = distributionToPlacementHints(dist);
  const block = hints.block_lessons >= 2 ? hints.block_lessons : undefined;
  return {
    id: row.id,
    subject_id: row.subject_id ?? null,
    subject_name: row.subject_name,
    class_sections: row.class_sections,
    weekly_hours: row.weekly_hours,
    teacher_ids: row.teacher_ids ?? [],
    room_ids: row.room_ids ?? [],
    group_id: row.group_id ?? null,
    biweekly: row.biweekly,
    place_first: row.place_first,
    min_days_per_week: hints.min_days_per_week,
    max_per_day: hints.max_per_day,
    options: {
      ...(row.options ?? {}),
      day_distribution: dist,
      ...(block ? { block_lessons: block } : {}),
    },
  };
}
